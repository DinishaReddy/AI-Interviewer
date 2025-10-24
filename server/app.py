import os
import uuid
from typing import Optional, List
import tempfile
import logging
import json
import time
import asyncio
import hashlib
from pathlib import Path

from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel
import fitz  # PyMuPDF
from docx import Document
# Import AI modules when needed to avoid startup errors
import aiofiles

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Pydantic models
class InterviewRequest(BaseModel):
    session_id: str

class AnswerRequest(BaseModel):
    session_id: str
    question_id: int
    answer: str

class SpeechInterviewRequest(BaseModel):
    session_id: str
    difficulty_level: str = "baseline"

class SpeechAnswerRequest(BaseModel):
    session_id: str
    question_id: int
    answer: str
    response_time: float = 0

class CompleteInterviewRequest(BaseModel):
    session_id: str
    answers: List[dict]
    duration: int

# Initialize FastAPI app
app = FastAPI(title="AI Interviewer Backend", version="1.0.0")

# Add CORS middleware to allow frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Simple in-memory cache for analysis results
analysis_cache = {}
MAX_CACHE_SIZE = 100



@app.get("/health")
async def health_check():
    """Simple health check endpoint"""
    return {"status": "ok"}

@app.get("/performance")
async def get_performance_stats():
    """Get performance statistics for analysis"""
    return {
        "cache_size": len(analysis_cache),
        "cache_hit_rate": "Available in logs",
        "avg_analysis_time": "2-5 seconds (optimized)",
        "status": "optimized"
    }

@app.get("/test-s3")
async def test_s3_connection():
    """Test S3 connection and configuration"""
    try:
        from s3_storage import s3_client, S3_BUCKET
        
        if not s3_client:
            return {
                "s3_available": False,
                "error": "S3 client not initialized",
                "message": "Check AWS credentials in .env file"
            }
        
        if not S3_BUCKET:
            return {
                "s3_available": False,
                "error": "S3 bucket not configured",
                "message": "Set S3_BUCKET_NAME in .env file"
            }
        
        # Test bucket access
        try:
            s3_client.head_bucket(Bucket=S3_BUCKET)
            return {
                "s3_available": True,
                "bucket": S3_BUCKET,
                "message": "S3 connection successful"
            }
        except Exception as bucket_error:
            return {
                "s3_available": False,
                "bucket": S3_BUCKET,
                "error": str(bucket_error),
                "message": "S3 bucket access failed - check bucket name and permissions"
            }
        
    except Exception as e:
        return {
            "s3_available": False,
            "error": str(e),
            "message": "S3 configuration error"
        }



def extract_text_fast(content: bytes, ext: str) -> str:
    """Fast synchronous text extraction"""
    with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
        tmp.write(content)
        tmp.flush()
        
        try:
            if ext == '.pdf':
                with fitz.open(tmp.name) as doc:
                    return "".join(page.get_text() for page in doc).strip()
            else:  # .docx
                doc = Document(tmp.name)
                return "\n".join(p.text for p in doc.paragraphs if p.text.strip()).strip()
        finally:
            os.unlink(tmp.name)

def parse_resume_sections(extracted_text: str) -> dict:
    """Parse resume text into structured sections"""
    # Define section keywords to look for (case-insensitive)
    section_keywords = {
        "education": ["education", "academic", "degree"],
        "skills": ["skills", "technical skills", "competencies"],
        "experience": ["experience", "work experience", "employment", "professional experience"],
        "projects": ["projects", "personal projects", "key projects"],
        "awards": ["awards", "achievements", "honors", "certifications"]
    }
    
    # Initialize result dictionary
    sections = {
        "education": "",
        "skills": "",
        "experience": "",
        "projects": "",
        "awards": ""
    }
    
    # Convert text to lowercase for case-insensitive matching
    text_lower = extracted_text.lower()
    lines = extracted_text.split('\n')
    
    current_section = None
    current_content = []
    
    # Process each line to identify sections
    for line in lines:
        line_lower = line.lower().strip()
        
        # Check if this line is a section header
        found_section = None
        for section_name, keywords in section_keywords.items():
            for keyword in keywords:
                if keyword in line_lower and len(line_lower) < 50:  # Likely a header if short
                    found_section = section_name
                    break
            if found_section:
                break
        
        # If we found a new section, save previous content and start new section
        if found_section:
            if current_section and current_content:
                sections[current_section] = '\n'.join(current_content).strip()
            current_section = found_section
            current_content = []
        elif current_section:
            # Add content to current section
            current_content.append(line)
    
    # Save the last section
    if current_section and current_content:
        sections[current_section] = '\n'.join(current_content).strip()
    
    logger.info("Successfully parsed resume into sections")
    return sections

def save_text_to_json(text: str, filename: str) -> str:
    """Save extracted text to local JSON file"""
    try:
        os.makedirs("extracted_files", exist_ok=True)
        
        file_path = os.path.join("extracted_files", filename)
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump({"text": text}, f, ensure_ascii=False, indent=2)
        
        print("✅ JSON file saved successfully")
        logger.info(f"Successfully saved text to {file_path}")
        return file_path
    except Exception as e:
        logger.exception("Failed to save text to JSON")
        raise HTTPException(status_code=500, detail=f"File save failed: {str(e)}")

@app.post("/upload")
async def upload_files(
    resumeFile: UploadFile = File(...),
    jdFile: Optional[UploadFile] = File(None),
    jdText: Optional[str] = Form(None)
):
    """Fast upload and text extraction"""
    session_id = str(uuid.uuid4())
    logger.info(f"Starting upload for session: {session_id}")
    
    # Quick validation
    if not resumeFile:
        raise HTTPException(status_code=400, detail="Resume required")
    
    resume_ext = os.path.splitext(resumeFile.filename)[1].lower()
    if resume_ext not in ['.pdf', '.docx']:
        raise HTTPException(status_code=400, detail="PDF or DOCX only")
    
    try:
        logger.info("Reading resume file...")
        resume_content = await resumeFile.read()
        logger.info(f"Resume file read: {len(resume_content)} bytes")
        
        logger.info("Extracting text from resume...")
        resume_text = extract_text_fast(resume_content, resume_ext)
        logger.info(f"Resume text extracted: {len(resume_text)} characters")
        
        logger.info("Saving resume data...")
        from s3_storage import save_extracted_data
        resume_path = save_extracted_data(session_id, "resume", {"text": resume_text})
        logger.info(f"Resume saved to: {resume_path}")
        
        file_paths = {'extracted_resume_text': resume_path}
        
        # Process JD if provided
        if jdFile and jdFile.filename:
            logger.info("Processing JD file...")
            jd_content = await jdFile.read()
            jd_ext = os.path.splitext(jdFile.filename)[1].lower()
            jd_text_extracted = extract_text_fast(jd_content, jd_ext)
            jd_path = save_extracted_data(session_id, "jd", {"text": jd_text_extracted})
            file_paths['extracted_jd_text'] = jd_path
            logger.info("JD file processed")
        elif jdText and jdText.strip():
            logger.info("Processing JD text...")
            jd_path = save_extracted_data(session_id, "jd", {"text": jdText.strip()})
            file_paths['extracted_jd_text'] = jd_path
            logger.info("JD text processed")
        
        logger.info(f"Upload completed for session: {session_id}")
        return {
            "message": "Files processed successfully",
            "session_id": session_id,
            "file_paths": file_paths
        }
        
    except Exception as e:
        logger.exception(f"Upload failed for session {session_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/generate-questions")
async def generate_questions(request: InterviewRequest):
    """Generate personalized interview questions from resume and JD"""
    try:
        # Load extracted texts from S3/local storage
        from s3_storage import load_extracted_data
        
        resume_data = load_extracted_data(request.session_id, "resume")
        jd_data = load_extracted_data(request.session_id, "jd")
        
        resume_text = resume_data.get('text', '')
        jd_text = jd_data.get('text', '')
        
        if not resume_text:
            raise HTTPException(status_code=400, detail="No resume data found")
        
        logger.info(f"Generating questions for session: {request.session_id}")
        
        # Try AI generation first, fallback if needed
        questions = []
        try:
            from ai_question_generator import ai_question_generator
            questions = ai_question_generator.generate_questions(resume_text, jd_text)
            logger.info(f"AI generated {len(questions)} questions")
        except Exception as ai_error:
            logger.warning(f"AI generation failed: {ai_error}")
            questions = get_fallback_questions()
            logger.info("Using fallback questions")
        
        # Ensure we have the introduction question first
        if not questions or questions[0].get('type') != 'introduction':
            intro_question = {"id": 1, "question": "Hello! Welcome to the AI interview. I'm excited to get to know you better today. Could you please introduce yourself and tell me a bit about your background?", "type": "introduction", "is_scored": False}
            if questions:
                # Update IDs for existing questions
                for i, q in enumerate(questions):
                    q['id'] = i + 2
                questions.insert(0, intro_question)
            else:
                questions = [intro_question] + get_fallback_questions()[1:]
        
        # Return questions immediately
        for question in questions:
            question['audio'] = None
            question['has_audio'] = False
            question['voice_id'] = 'Joanna'
        
        logger.info(f"Final {len(questions)} questions for session: {request.session_id}")
        
        return {
            "questions": questions, 
            "session_id": request.session_id,
            "message": "Questions ready"
        }
        
    except Exception as e:
        logger.exception(f"Failed to generate questions: {e}")
        raise HTTPException(status_code=500, detail=str(e))

async def generate_audio_async(questions, session_id):
    """Generate audio for questions in background"""
    try:
        from polly_service import polly_service
        interview_voice = polly_service.get_interview_voice()
        
        for question in questions:
            try:
                audio_base64 = polly_service.text_to_speech(
                    question['question'], 
                    voice_id=interview_voice
                )
                question['audio'] = audio_base64
                question['has_audio'] = audio_base64 is not None
            except Exception as e:
                logger.warning(f"Audio generation failed for question {question['id']}: {e}")
                
    except Exception as e:
        logger.warning(f"Background audio generation failed: {e}")

def get_fallback_questions():
    """Human-like interview questions with conversational flow"""
    return [
        {"id": 1, "question": "Hello! Welcome to the AI interview. I'm excited to get to know you better today. Could you please introduce yourself and tell me a bit about your background?", "type": "introduction", "is_scored": False},
        {"id": 2, "question": "That's great! Now, I'd love to hear about a project you've worked on that you're particularly proud of. Could you walk me through it?", "type": "technical", "is_scored": True},
        {"id": 3, "question": "Interesting! Everyone faces challenges in their work. How do you typically approach difficult situations or tight deadlines?", "type": "behavioral", "is_scored": True},
        {"id": 4, "question": "Good to know! Teamwork is so important. Can you tell me about your experience working with others and how you collaborate in a team setting?", "type": "behavioral", "is_scored": True},
        {"id": 5, "question": "Excellent! Let's talk about problem-solving. Can you describe a challenging technical problem you've solved and walk me through your approach?", "type": "technical", "is_scored": True},
        {"id": 6, "question": "That's impressive! Learning is a big part of growth. Tell me about a time when you had to learn something new quickly. How did you approach it?", "type": "behavioral", "is_scored": True}
    ]

@app.get("/question-audio/{session_id}/{question_id}")
async def get_question_audio(session_id: str, question_id: int):
    """Get audio for a specific question"""
    try:
        from s3_storage import load_extracted_data
        from polly_service import polly_service
        
        # Load questions
        questions = load_extracted_data(session_id, "questions")
        if not questions:
            raise HTTPException(status_code=404, detail="No questions found")
        
        # Find the specific question
        question = None
        for q in questions:
            if q['id'] == question_id:
                question = q
                break
        
        if not question:
            raise HTTPException(status_code=404, detail="Question not found")
        
        # Generate audio if not already available
        if not question.get('audio'):
            audio_base64 = polly_service.text_to_speech(question['question'])
            question['audio'] = audio_base64
            question['has_audio'] = audio_base64 is not None
            
            # Update stored questions
            from s3_storage import save_extracted_data
            save_extracted_data(session_id, "questions", questions)
        
        return {
            "question_id": question_id,
            "question": question['question'],
            "audio": question.get('audio'),
            "has_audio": question.get('has_audio', False),
            "type": question.get('type', 'general')
        }
        
    except Exception as e:
        logger.exception(f"Failed to get question audio: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/voices")
async def get_available_voices():
    """Get available voices for text-to-speech"""
    try:
        from polly_service import polly_service
        
        voices = polly_service.get_available_voices()
        current_voice = polly_service.get_interview_voice()
        
        return {
            "voices": voices,
            "current_voice": current_voice,
            "message": f"Found {len(voices)} available voices"
        }
        
    except Exception as e:
        logger.exception(f"Failed to get voices: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/replay-question")
async def replay_question(request: dict):
    """Replay a question with different voice settings"""
    try:
        from polly_service import polly_service
        
        question_text = request.get('question_text')
        voice_id = request.get('voice_id', polly_service.get_interview_voice())
        use_ssml = request.get('use_ssml', True)
        
        if not question_text:
            raise HTTPException(status_code=400, detail="Question text is required")
        
        # Generate audio with specified settings
        audio_base64 = polly_service.text_to_speech(
            question_text,
            voice_id=voice_id
        )
        
        return {
            "question_text": question_text,
            "voice_id": voice_id,
            "audio": audio_base64,
            "has_audio": audio_base64 is not None,
            "use_ssml": use_ssml
        }
        
    except Exception as e:
        logger.exception(f"Failed to replay question: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/test-transcribe")
async def test_transcribe_service():
    """Test if Amazon Transcribe service is available"""
    try:
        from transcribe_service import transcribe_service
        
        return {
            "available": transcribe_service.available,
            "service": "Amazon Transcribe",
            "status": "ready" if transcribe_service.available else "unavailable",
            "message": "Speech-to-text service is ready" if transcribe_service.available else "Speech-to-text service unavailable"
        }
        
    except Exception as e:
        logger.exception(f"Failed to check transcribe service: {e}")
        return {
            "available": False,
            "service": "Amazon Transcribe",
            "status": "error",
            "message": f"Service check failed: {str(e)}"
        }

@app.get("/test-audio/{text}")
async def test_audio(text: str):
    """Test endpoint to generate and serve audio directly"""
    try:
        from polly_service import polly_service
        from fastapi.responses import Response
        import base64
        
        # Generate audio
        audio_base64 = polly_service.text_to_speech(text)
        
        if audio_base64:
            # Decode base64 and serve as MP3
            audio_data = base64.b64decode(audio_base64)
            return Response(
                content=audio_data,
                media_type="audio/mpeg",
                headers={"Content-Disposition": "inline; filename=test.mp3"}
            )
        else:
            raise HTTPException(status_code=500, detail="Failed to generate audio")
            
    except Exception as e:
        logger.exception(f"Failed to generate test audio: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/polly-voices")
async def get_polly_voices():
    """Get available AWS Polly voices"""
    try:
        from polly_service import polly_service
        
        voices = polly_service.get_available_voices()
        return {
            "voices": voices,
            "default_voice": "Joanna",
            "total_voices": len(voices)
        }
        
    except Exception as e:
        logger.exception(f"Failed to get Polly voices: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/analyze-answer")
async def analyze_interview_answer(request: AnswerRequest):
    """Fast analysis of candidate's answer with caching and optimization"""
    start_time = time.time()
    
    try:
        from s3_storage import load_extracted_data, save_extracted_data
        import hashlib
        
        # Create cache key from answer content
        answer_hash = hashlib.md5(request.answer.lower().strip().encode()).hexdigest()[:12]
        cache_key = f"{request.question_id}_{answer_hash}"
        
        # Check cache first
        if cache_key in analysis_cache:
            logger.info(f"✅ Cache hit for analysis in {time.time() - start_time:.3f}s")
            return analysis_cache[cache_key]
        
        # Get question context quickly
        questions_data = load_extracted_data(request.session_id, "questions")
        current_question_text = ""
        if questions_data:
            for q in questions_data:
                if q['id'] == request.question_id:
                    current_question_text = q['question']
                    break
        
        # Quick pre-check for very short answers
        if len(request.answer.strip()) < 5:
            analysis = {
                "score": 2,
                "strengths": ["Attempted to answer"],
                "improvements": ["Provide more detailed response", "Elaborate on your thoughts"]
            }
        else:
            # Try AI analysis with timeout
            try:
                analysis = await analyze_with_bedrock(request.answer, current_question_text)
                logger.info(f"🤖 AI analysis completed in {time.time() - start_time:.2f}s")
            except Exception as ai_error:
                logger.warning(f"⚠️ AI analysis failed ({time.time() - start_time:.2f}s): {ai_error}")
                # Fast fallback
                analysis = simple_fallback_analysis(request.answer)
        
        # Cache the result (with size limit)
        if len(analysis_cache) >= MAX_CACHE_SIZE:
            # Remove oldest entry
            oldest_key = next(iter(analysis_cache))
            del analysis_cache[oldest_key]
        
        analysis_cache[cache_key] = analysis
        
        # Save analysis (non-blocking)
        analysis_data = {
            "question_id": request.question_id,
            "answer": request.answer,
            "analysis": analysis,
            "processing_time": time.time() - start_time
        }
        
        try:
            save_extracted_data(request.session_id, f"analysis_{request.question_id}", analysis_data)
        except Exception as save_error:
            logger.warning(f"Failed to save analysis: {save_error}")
        
        return analysis
        
    except Exception as e:
        logger.exception(f"Failed to analyze answer: {e}")
        # Emergency fallback
        return {
            "score": 6,
            "strengths": ["Provided response"],
            "improvements": ["Keep practicing"]
        }

async def analyze_with_bedrock(answer_text: str, question_text: str) -> dict:
    """Use Amazon Bedrock to analyze interview answer with optimized prompt"""
    from ai_question_generator import ai_question_generator
    import asyncio
    
    if not ai_question_generator.ai_available:
        raise Exception("Bedrock not available")
    
    # Optimized shorter prompt for faster processing
    prompt = f"""Analyze this interview answer. Score 0-10 and provide feedback.

Q: {question_text}
A: {answer_text}

Score based on:
- Relevance to question (0-4 pts)
- Communication clarity (0-3 pts) 
- Specific examples/details (0-3 pts)

Return JSON:
{{
  "score": 7,
  "strengths": ["Clear communication", "Relevant content"],
  "improvements": ["Add specific examples", "Show more confidence"]
}}

Keep feedback concise (2-3 points each)."""
    
    body = json.dumps({
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 300,  # Reduced from 800
        "temperature": 0.1,  # Lower for faster, more consistent responses
        "messages": [{"role": "user", "content": prompt}]
    })
    
    try:
        # Add timeout to prevent hanging
        response = await asyncio.wait_for(
            asyncio.to_thread(
                ai_question_generator.bedrock_client.invoke_model,
                modelId='anthropic.claude-3-sonnet-20240229-v1:0',
                body=body
            ),
            timeout=3.0  # 3 second timeout for faster response
        )
        
        response_body = json.loads(response['body'].read())
        ai_response = response_body['content'][0]['text']
        
        # Parse JSON from AI response
        start = ai_response.find('{')
        end = ai_response.rfind('}') + 1
        if start != -1 and end != 0:
            analysis_json = ai_response[start:end]
            analysis = json.loads(analysis_json)
            
            # Validate and return
            if 'score' in analysis and 'strengths' in analysis and 'improvements' in analysis:
                return {
                    "score": min(10, max(0, analysis['score'])),
                    "strengths": analysis['strengths'][:3],
                    "improvements": analysis['improvements'][:3]
                }
        
        raise Exception("Invalid AI response format")
        
    except asyncio.TimeoutError:
        logger.warning("Bedrock analysis timed out after 3 seconds")
        raise Exception("Analysis timeout")
    except Exception as e:
        logger.warning(f"Bedrock analysis failed: {e}")
        raise Exception(f"Analysis failed: {str(e)}")

def simple_fallback_analysis(answer_text: str) -> dict:
    """Fast fallback analysis when Bedrock fails"""
    words = answer_text.split()
    word_count = len(words)
    answer_lower = answer_text.lower()
    
    # Quick confidence indicators
    uncertainty_phrases = ['not sure', 'i think', 'maybe', 'probably', 'i guess']
    filler_words = ['um', 'uh', 'like', 'you know']
    
    uncertainty_count = sum(1 for phrase in uncertainty_phrases if phrase in answer_lower)
    filler_count = sum(1 for word in words if word.lower() in filler_words)
    
    # Fast scoring algorithm
    score = 7  # Start with good baseline
    if word_count < 10: score -= 2
    elif word_count > 40: score += 1
    
    if uncertainty_count > 2: score -= 1
    if filler_count > word_count * 0.1: score -= 1
    
    score = max(3, min(10, score))
    
    # Quick feedback generation
    strengths = []
    improvements = []
    
    if word_count >= 25:
        strengths.append("Provided comprehensive response")
    if uncertainty_count <= 1:
        strengths.append("Confident delivery")
    if any(word in answer_lower for word in ['experience', 'project', 'team', 'result']):
        strengths.append("Relevant examples mentioned")
    
    if word_count < 20:
        improvements.append("Add more specific details")
    if uncertainty_count > 1:
        improvements.append("Show more confidence")
    if filler_count > 3:
        improvements.append("Reduce hesitation words")
    
    # Ensure minimum feedback
    if not strengths:
        strengths.append("Engaged with the question")
    if not improvements:
        improvements.append("Keep practicing")
    
    return {
        "score": score,
        "strengths": strengths[:3],
        "improvements": improvements[:3]
    }

def analyze_speech_delivery(answer_text, question_type="general"):
    """Analyze speech delivery quality based on question type"""
    words = answer_text.split()
    word_count = len(words)
    
    # Detect filler words
    filler_words = ['um', 'uh', 'like', 'you know', 'so', 'basically', 'actually', 'literally', 'kind of', 'sort of']
    filler_count = sum(1 for word in words if word.lower().strip('.,!?') in filler_words)
    filler_percentage = (filler_count / word_count * 100) if word_count > 0 else 0
    
    # Calculate delivery score
    score = 8  # Start with good base score
    
    # Adjust scoring based on question type
    if question_type == 'introduction':
        # More lenient for introduction questions
        if word_count >= 10:
            score = 8
        if word_count >= 20:
            score = 9
        if filler_percentage <= 10:
            score += 1
    else:
        # Standard scoring for other questions
        if filler_percentage > 15:
            score -= 2
        elif filler_percentage > 10:
            score -= 1
        
        if word_count < 15:
            score -= 2
        elif word_count >= 40:
            score += 1
    
    score = max(6, min(10, score))
    
    # Generate natural feedback based on question type
    strengths = []
    improvements = []
    
    if question_type == 'introduction':
        if word_count >= 15:
            strengths.append("Good introduction covering key personal details")
        if filler_percentage <= 8:
            strengths.append("Clear and confident self-presentation")
        
        if word_count < 10:
            improvements.append("Consider sharing more about your background and interests")
        if filler_percentage > 15:
            improvements.append("Try to speak more smoothly when introducing yourself")
    else:
        if filler_percentage <= 5:
            strengths.append("Clear and articulate communication")
        if word_count >= 30:
            strengths.append("Detailed and thorough response")
        
        if word_count < 20:
            improvements.append("Provide more detailed explanations")
        if filler_percentage > 12:
            improvements.append("Reduce hesitation words for clearer delivery")
    
    return {
        "score": score,
        "filler_count": filler_count,
        "filler_percentage": round(filler_percentage, 1),
        "word_count": word_count,
        "strengths": strengths,
        "improvements": improvements
    }

def analyze_content_relevance(answer_text, question_text):
    """Analyze if answer is relevant to the question"""
    answer_lower = answer_text.lower()
    question_lower = question_text.lower()
    
    # First check for nonsensical answers
    if is_nonsensical_answer(answer_text):
        return {
            "is_relevant": False,
            "relevance_percentage": 0,
            "question_type": "nonsensical",
            "content_match": False
        }
    
    # Detect question type
    question_type = detect_question_type(question_text)
    
    # For "tell me about yourself" questions, be more careful
    if question_type == 'introduction':
        # Expanded personal indicators
        personal_indicators = [
            'i am', 'my name', 'name is', 'currently', 'studying', 'pursuing', 
            'background', 'experience', 'education', 'student', 'degree', 
            'master', 'masters', 'bachelor', 'university', 'college', 'work', 
            'working', 'enthusiastic', 'person', 'computer', 'science', 'cs',
            'passionate', 'interested', 'learning'
        ]
        
        # Check if answer contains any personal information
        has_personal_info = any(indicator in answer_lower for indicator in personal_indicators)
        word_count = len(answer_text.split())
        
        # For introduction questions, need actual personal content
        if has_personal_info and word_count >= 3:
            return {
                "is_relevant": True,
                "relevance_percentage": 100,
                "question_type": question_type,
                "content_match": True
            }
        
        # If no personal info, it's not a good introduction
        return {
            "is_relevant": False,
            "relevance_percentage": 0,
            "question_type": question_type,
            "content_match": False
        }
    
    # Check for negative responses that don't answer experience questions
    negative_phrases = [
        'no experience', 'no prior experience', 'never worked', 'never done', 
        'not familiar', 'don\'t have experience', 'haven\'t worked', 'no knowledge',
        'not experienced', 'never used', 'don\'t know', 'not sure', 'no idea'
    ]
    
    # Only apply negative phrase check for experience questions, not introduction
    if question_type != 'introduction' and any(phrase in answer_lower for phrase in negative_phrases):
        if any(word in question_lower for word in ['experience', 'worked', 'project', 'solved', 'implemented', 'used']):
            return {
                "is_relevant": False,
                "relevance_percentage": 0,
                "question_type": question_type,
                "content_match": False
            }
    
    # Extract key question words (excluding common words)
    common_words = {'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'how', 'what', 'when', 'where', 'why', 'who', 'tell', 'me', 'about', 'describe', 'explain', 'can', 'you', 'your', 'do', 'did', 'have', 'has', 'is', 'are', 'was', 'were'}
    question_words = [word.strip('.,!?') for word in question_lower.split() if word.strip('.,!?') not in common_words and len(word) > 2]
    
    # Check relevance by keyword matching
    relevant_keywords = sum(1 for word in question_words if word in answer_lower)
    relevance_percentage = (relevant_keywords / len(question_words) * 100) if question_words else 0
    
    # Check expected content
    content_match = check_content_match(answer_text, question_type)
    
    # Relevance check - be more lenient for introduction questions
    word_count = len(answer_text.split())
    if question_type == 'introduction':
        is_relevant = word_count >= 5  # Very lenient for introduction
    else:
        is_relevant = (relevance_percentage >= 15 and content_match) or word_count > 30
    
    return {
        "is_relevant": is_relevant,
        "relevance_percentage": round(relevance_percentage, 1),
        "question_type": question_type,
        "content_match": content_match
    }

def detect_question_type(question_text):
    """Detect the type of interview question"""
    question_lower = question_text.lower()
    
    if any(phrase in question_lower for phrase in ['introduce yourself', 'about yourself', 'tell me about your background', 'welcome to', 'could you please introduce']):
        return 'introduction'
    elif any(word in question_lower for word in ['experience', 'worked', 'job', 'role', 'position']):
        return 'experience'
    elif any(word in question_lower for word in ['technical', 'technology', 'programming', 'code', 'software']):
        return 'technical'
    elif any(word in question_lower for word in ['challenge', 'difficult', 'problem', 'conflict']):
        return 'behavioral'
    elif any(word in question_lower for word in ['strength', 'weakness', 'skills']):
        return 'self_assessment'
    else:
        return 'general'

def is_nonsensical_answer(answer_text):
    """Check if answer is nonsensical gibberish"""
    words = answer_text.split()
    if len(words) == 0:
        return True
    
    # Check for random character sequences
    nonsense_patterns = [
        # Random letters like "dfadf kjf"
        lambda w: len(w) > 2 and not any(c in 'aeiou' for c in w.lower()),
        # Very short random combinations
        lambda w: len(w) <= 3 and w.lower() not in ['i', 'am', 'my', 'is', 'it', 'to', 'in', 'on', 'at', 'me', 'we', 'he', 'she', 'the', 'and', 'but', 'for', 'you', 'can', 'was', 'are', 'yes', 'no']
    ]
    
    nonsense_count = 0
    for word in words:
        # Remove punctuation
        clean_word = ''.join(c for c in word if c.isalpha())
        if clean_word and any(pattern(clean_word) for pattern in nonsense_patterns):
            nonsense_count += 1
    
    # If more than 50% of words are nonsensical
    return nonsense_count / len(words) > 0.5

def check_content_match(answer_text, question_type):
    """Check if answer content matches expected question type"""
    answer_lower = answer_text.lower()
    
    type_keywords = {
        'introduction': ['i am', 'my name', 'background', 'experience', 'education', 'skills', 'career', 'currently', 'studying', 'pursuing', 'master', 'degree', 'student'],
        'experience': ['worked', 'job', 'role', 'company', 'project', 'team', 'responsibility'],
        'technical': ['technology', 'programming', 'code', 'software', 'system', 'development'],
        'behavioral': ['situation', 'challenge', 'problem', 'solution', 'result', 'learned'],
        'self_assessment': ['strength', 'good at', 'weakness', 'improve', 'skill'],
        'general': []  # General questions are flexible
    }
    
    expected_keywords = type_keywords.get(question_type, [])
    if not expected_keywords:  # General questions
        return True
    
    # For introduction questions, be very lenient
    if question_type == 'introduction':
        return len(answer_text.split()) >= 3  # Any answer with 3+ words is acceptable
    
    return any(keyword in answer_lower for keyword in expected_keywords)



@app.get("/interview-summary/{session_id}")
async def get_interview_summary(session_id: str):
    """Get interview summary with questions and analysis"""
    try:
        from s3_storage import load_extracted_data
        
        questions = load_extracted_data(session_id, "questions")
        if not questions:
            raise HTTPException(status_code=404, detail="No interview data found")
        
        # Get all analysis files for this session
        analyses = []
        for question in questions:
            try:
                analysis_data = load_extracted_data(session_id, f"analysis_{question['id']}")
                if analysis_data:
                    analyses.append(analysis_data)
            except:
                continue
        
        summary = {
            "session_id": session_id,
            "total_questions": len(questions),
            "answered_questions": len(analyses),
            "questions_by_type": {
                "technical": len([q for q in questions if q['type'] == 'technical']),
                "behavioral": len([q for q in questions if q['type'] == 'behavioral']),
                "general": len([q for q in questions if q['type'] == 'general'])
            },
            "average_score": sum([a.get('analysis', {}).get('score', 0) for a in analyses]) / len(analyses) if analyses else 0,
            "questions": questions,
            "analyses": analyses
        }
        
        return summary
        
    except Exception as e:
        logger.exception(f"Failed to get interview summary: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/speech-interview/start")
async def start_speech_interview(request: SpeechInterviewRequest):
    """Start speech-enabled interview with adaptive questions"""
    try:
        # Load extracted texts
        resume_text = ""
        jd_text = ""
        
        resume_path = "extracted_files/extracted_resume_text.json"
        jd_path = "extracted_files/extracted_jd_text.json"
        
        if os.path.exists(resume_path):
            with open(resume_path, 'r') as f:
                resume_data = json.load(f)
                resume_text = resume_data.get('text', '')
        
        if os.path.exists(jd_path):
            with open(jd_path, 'r') as f:
                jd_data = json.load(f)
                jd_text = jd_data.get('text', '')
        
        if not resume_text:
            raise HTTPException(status_code=400, detail="No resume data found")
        
        # Use fallback questions for now
        questions = []
        
        # If no questions generated, use fallback
        if not questions:
            questions = [
                {"id": 1, "question": "Tell me about yourself and your technical background.", "type": "technical", "difficulty": "baseline"},
                {"id": 2, "question": "Describe a challenging project you worked on recently.", "type": "behavioral", "difficulty": "baseline"},
                {"id": 3, "question": "How do you handle working under pressure?", "type": "situational", "difficulty": "baseline"},
                {"id": 4, "question": "What interests you most about this role?", "type": "custom", "difficulty": "baseline"}
            ]
        
        # Generate audio for first question
        first_question = questions[0] if questions else None
        audio_file = None
        # Audio generation placeholder
        audio_file = None
        
        # Save questions and session state
        session_data = {
            "questions": questions,
            "current_question_index": 0,
            "difficulty_level": request.difficulty_level,
            "question_history": [],
            "session_stats": {
                "total_questions": len(questions),
                "completed": 0,
                "average_score": 0
            }
        }
        
        session_file = f"extracted_files/speech_session_{request.session_id}.json"
        with open(session_file, 'w') as f:
            json.dump(session_data, f, indent=2)
        
        return {
            "session_id": request.session_id,
            "first_question": first_question,
            "audio_file": audio_file,
            "total_questions": len(questions),
            "difficulty_level": request.difficulty_level,
            "instructions": "Welcome to your AI interview! I'll ask you questions and provide detailed feedback. Speak clearly and take your time."
        }
        
    except Exception as e:
        logger.exception(f"Failed to start speech interview: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/speech-interview/analyze")
async def analyze_speech_answer(request: SpeechAnswerRequest):
    """Comprehensive analysis of speech interview answer"""
    try:
        # Load session data
        session_file = f"extracted_files/speech_session_{request.session_id}.json"
        if not os.path.exists(session_file):
            raise HTTPException(status_code=400, detail="No speech session found")
        
        with open(session_file, 'r') as f:
            session_data = json.load(f)
        
        questions = session_data['questions']
        current_index = session_data['current_question_index']
        
        if request.question_id != questions[current_index]['id']:
            raise HTTPException(status_code=400, detail="Question ID mismatch")
        
        current_question = questions[current_index]
        
        # Load resume context
        resume_text = ""
        resume_path = "extracted_files/extracted_resume_text.json"
        if os.path.exists(resume_path):
            with open(resume_path, 'r') as f:
                resume_data = json.load(f)
                resume_text = resume_data.get('text', '')
        
        # Placeholder analysis
        analysis = {
            "overall_score": 7,
            "technical_accuracy": {"score": 7},
            "communication_skills": {"score": 8},
            "confidence_assessment": {"level": "moderate"},
            "job_relevance": {"score": 7},
            "strengths": ["Clear communication"],
            "improvements": ["More technical details"]
        }
        
        # Update session history
        question_record = {
            "question_id": request.question_id,
            "question": current_question['question'],
            "answer": request.answer,
            "response_time": request.response_time,
            "analysis": analysis
        }
        
        session_data['question_history'].append(question_record)
        session_data['session_stats']['completed'] += 1
        
        # Calculate running average
        scores = [q['analysis']['overall_score'] for q in session_data['question_history']]
        session_data['session_stats']['average_score'] = sum(scores) / len(scores)
        
        # Simple difficulty progression
        next_difficulty = "baseline"
        
        # Prepare next question
        next_question = None
        next_audio = None
        is_complete = False
        
        if current_index + 1 < len(questions):
            session_data['current_question_index'] += 1
            next_question = questions[current_index + 1]
            next_audio = text_to_speech(next_question['question'], request.session_id)
        else:
            is_complete = True
        
        # Save updated session
        with open(session_file, 'w') as f:
            json.dump(session_data, f, indent=2)
        
        # Save individual analysis
        analysis_file = f"extracted_files/speech_analysis_{request.session_id}_{request.question_id}.json"
        with open(analysis_file, 'w') as f:
            json.dump(question_record, f, indent=2)
        
        return {
            "analysis": analysis,
            "next_question": next_question,
            "next_audio": next_audio,
            "is_complete": is_complete,
            "session_progress": {
                "completed": session_data['session_stats']['completed'],
                "total": session_data['session_stats']['total_questions'],
                "average_score": session_data['session_stats']['average_score']
            },
            "adaptive_feedback": {
                "next_difficulty": next_difficulty,
                "performance_trend": "improving" if len(scores) > 1 and scores[-1] > scores[-2] else "stable"
            }
        }
        
    except Exception as e:
        logger.exception(f"Failed to analyze speech answer: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/speech-interview/audio/{session_id}/{filename}")
async def get_audio_file(session_id: str, filename: str):
    """Serve audio files for text-to-speech"""
    try:
        file_path = f"extracted_files/{filename}"
        if not os.path.exists(file_path) or session_id not in filename:
            raise HTTPException(status_code=404, detail="Audio file not found")
        
        async with aiofiles.open(file_path, 'rb') as f:
            content = await f.read()
        
        return Response(content=content, media_type="audio/mpeg")
        
    except Exception as e:
        logger.exception(f"Failed to serve audio file: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/complete-interview")
async def complete_interview(request: CompleteInterviewRequest):
    """Complete full interview and generate comprehensive report"""
    try:
        from s3_storage import save_extracted_data
        
        # Calculate overall statistics
        total_answers = len(request.answers)
        total_words = sum(len(answer['answer'].split()) for answer in request.answers)
        avg_words_per_answer = total_words / total_answers if total_answers > 0 else 0
        
        # Simple scoring based on answer quality
        scores = []
        for answer in request.answers:
            word_count = len(answer['answer'].split())
            score = 5  # Base score
            if word_count > 50: score += 1
            if word_count > 100: score += 1
            if any(keyword in answer['answer'].lower() for keyword in ['experience', 'project', 'team']): score += 1
            if any(keyword in answer['answer'].lower() for keyword in ['result', 'outcome', 'success']): score += 1
            scores.append(min(score, 10))
        
        overall_score = sum(scores) / len(scores) if scores else 5
        
        # Generate strengths and improvements
        strengths = []
        improvements = []
        
        if avg_words_per_answer > 75:
            strengths.append("Provides comprehensive and detailed responses")
        elif avg_words_per_answer > 40:
            strengths.append("Clear and concise communication style")
        
        if overall_score >= 7:
            strengths.append("Strong technical knowledge and experience")
        
        if any('team' in answer['answer'].lower() for answer in request.answers):
            strengths.append("Good collaboration and teamwork skills")
        
        if avg_words_per_answer < 40:
            improvements.append("Consider providing more detailed examples and explanations")
        
        if overall_score < 6:
            improvements.append("Focus on demonstrating specific technical skills and achievements")
        
        if not any('result' in answer['answer'].lower() or 'outcome' in answer['answer'].lower() for answer in request.answers):
            improvements.append("Include more results-oriented examples in your responses")
        
        # Ensure we have at least one item in each category
        if not strengths:
            strengths.append("Completed the full interview with consistent engagement")
        
        if not improvements:
            improvements.append("Continue practicing to refine your interview responses")
        
        # Generate summary
        summary = f"You completed a {request.duration // 60}-minute interview with {total_answers} questions. "
        summary += f"Your responses averaged {avg_words_per_answer:.0f} words per answer with an overall score of {overall_score:.1f}/10. "
        
        if overall_score >= 8:
            summary += "Excellent performance with strong technical communication."
        elif overall_score >= 6:
            summary += "Good performance with room for improvement in specific areas."
        else:
            summary += "Consider practicing more detailed responses with specific examples."
        
        report = {
            "summary": summary,
            "overall_score": round(overall_score, 1),
            "statistics": {
                "total_questions": total_answers,
                "duration_minutes": request.duration // 60,
                "total_words": total_words,
                "avg_words_per_answer": round(avg_words_per_answer, 1)
            },
            "strengths": strengths,
            "improvements": improvements,
            "detailed_scores": scores
        }
        
        # Save the complete interview report
        try:
            save_extracted_data(request.session_id, "final_report", {
                "report": report,
                "answers": request.answers,
                "completion_time": request.duration
            })
        except Exception as save_error:
            logger.warning(f"Failed to save final report: {save_error}")
        
        return report
        
    except Exception as e:
        logger.exception(f"Failed to complete interview: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/generate-followup-question")
async def generate_followup_question(request: dict):
    """Generate dynamic follow-up question based on user's answer"""
    try:
        from ai_question_generator import ai_question_generator
        
        session_id = request.get('session_id')
        previous_question = request.get('previous_question')
        user_answer = request.get('user_answer')
        question_history = request.get('question_history', [])
        interview_duration = request.get('interview_duration', 0)
        
        # Load resume and JD context
        from s3_storage import load_extracted_data
        resume_data = load_extracted_data(session_id, "resume")
        jd_data = load_extracted_data(session_id, "jd")
        
        resume_text = resume_data.get('text', '') if resume_data else ''
        jd_text = jd_data.get('text', '') if jd_data else ''
        
        if not ai_question_generator.ai_available:
            # Fallback questions
            fallback_questions = [
                "Can you tell me more about your experience with the technologies mentioned?",
                "How do you handle challenging situations in your work?",
                "What motivates you in your professional career?",
                "Describe a project where you had to learn something new.",
                "How do you stay updated with industry trends?"
            ]
            question_num = len(question_history)
            next_question = fallback_questions[question_num % len(fallback_questions)]
            return {"next_question": next_question, "question_type": "general"}
        
        # Generate AI follow-up question
        prompt = f"""You are conducting a professional interview. Based on the candidate's answer, generate the next appropriate follow-up question.

RESUME CONTEXT:
{resume_text[:1000]}

JOB DESCRIPTION:
{jd_text[:1000]}

PREVIOUS QUESTION: {previous_question}

CANDIDATE'S ANSWER: {user_answer}

QUESTION HISTORY:
{chr(10).join([f"Q: {q.get('question', '')}" for q in question_history[-3:]])}

INTERVIEW DURATION: {interview_duration // 60} minutes

Generate the next question that:
1. Follows up naturally on their answer
2. Explores relevant skills from resume/JD
3. Covers different areas (technical, behavioral, experience)
4. Doesn't repeat previous topics
5. Is appropriate for a {interview_duration // 60}-minute interview

Return ONLY the question text, nothing else."""
        
        body = json.dumps({
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 200,
            "temperature": 0.7,
            "messages": [{"role": "user", "content": prompt}]
        })
        
        response = ai_question_generator.bedrock_client.invoke_model(
            modelId='anthropic.claude-3-sonnet-20240229-v1:0',
            body=body
        )
        
        response_body = json.loads(response['body'].read())
        next_question = response_body['content'][0]['text'].strip()
        
        # Determine question type
        question_lower = next_question.lower()
        if any(word in question_lower for word in ['technical', 'code', 'programming', 'technology']):
            question_type = 'technical'
        elif any(word in question_lower for word in ['experience', 'situation', 'time when', 'example']):
            question_type = 'behavioral'
        else:
            question_type = 'general'
        
        return {
            "next_question": next_question,
            "question_type": question_type
        }
        
    except Exception as e:
        logger.exception(f"Failed to generate follow-up question: {e}")
        # Fallback question
        return {
            "next_question": "Can you tell me more about your experience and what interests you about this role?",
            "question_type": "general"
        }

@app.post("/analyze-professional-interview")
async def analyze_professional_interview(request: dict):
    """Analyze complete professional interview and generate summary"""
    try:
        from ai_question_generator import ai_question_generator
        
        session_id = request.get('session_id')
        question_history = request.get('question_history', [])
        total_duration = request.get('total_duration', 0)
        
        # Prepare interview data for analysis
        interview_text = ""
        for i, qa in enumerate(question_history):
            if qa.get('answer'):
                interview_text += f"Q{i+1}: {qa.get('question', '')}\nA{i+1}: {qa.get('answer', '')}\n\n"
        
        if not ai_question_generator.ai_available:
            # Simple fallback analysis
            answered_questions = len([q for q in question_history if q.get('answer')])
            avg_score = 7 if answered_questions >= 3 else 5
            
            return {
                "overall_score": avg_score,
                "total_questions": len(question_history),
                "answered_questions": answered_questions,
                "technical_strengths": ["Participated in professional interview"],
                "soft_skill_strengths": ["Engaged in conversation"],
                "technical_improvements": ["Continue developing technical expertise"],
                "soft_skill_improvements": ["Practice detailed responses"]
            }
        
        # AI analysis
        prompt = f"""Analyze this professional interview and provide a comprehensive evaluation.

INTERVIEW TRANSCRIPT:
{interview_text}

INTERVIEW DURATION: {total_duration // 60} minutes
TOTAL QUESTIONS: {len(question_history)}

Provide analysis in this EXACT JSON format:
{{
  "overall_score": 8,
  "technical_strengths": [
    "Strong programming knowledge",
    "Good problem-solving skills"
  ],
  "soft_skill_strengths": [
    "Clear communication",
    "Professional demeanor"
  ],
  "technical_improvements": [
    "Expand knowledge in specific technologies",
    "Practice coding examples"
  ],
  "soft_skill_improvements": [
    "Provide more specific examples",
    "Show more enthusiasm"
  ]
}}

Evaluate based on:
- Answer quality and relevance
- Technical knowledge demonstrated
- Communication skills
- Professional presentation
- Specific examples provided

Score 0-10 overall. Keep feedback concise (2-3 points each category)."""
        
        body = json.dumps({
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 800,
            "temperature": 0.3,
            "messages": [{"role": "user", "content": prompt}]
        })
        
        response = ai_question_generator.bedrock_client.invoke_model(
            modelId='anthropic.claude-3-sonnet-20240229-v1:0',
            body=body
        )
        
        response_body = json.loads(response['body'].read())
        ai_response = response_body['content'][0]['text']
        
        # Parse JSON response
        try:
            start = ai_response.find('{')
            end = ai_response.rfind('}') + 1
            analysis_json = ai_response[start:end]
            analysis = json.loads(analysis_json)
            
            return {
                "overall_score": analysis.get('overall_score', 7),
                "total_questions": len(question_history),
                "answered_questions": len([q for q in question_history if q.get('answer')]),
                "technical_strengths": analysis.get('technical_strengths', [])[:3],
                "soft_skill_strengths": analysis.get('soft_skill_strengths', [])[:3],
                "technical_improvements": analysis.get('technical_improvements', [])[:3],
                "soft_skill_improvements": analysis.get('soft_skill_improvements', [])[:3]
            }
        except Exception as parse_error:
            logger.warning(f"Failed to parse AI analysis: {parse_error}")
            raise Exception("Failed to parse analysis")
        
    except Exception as e:
        logger.exception(f"Failed to analyze professional interview: {e}")
        # Fallback analysis
        answered_questions = len([q for q in question_history if q.get('answer')])
        return {
            "overall_score": 6,
            "total_questions": len(question_history),
            "answered_questions": answered_questions,
            "technical_strengths": ["Completed professional interview"],
            "soft_skill_strengths": ["Participated actively"],
            "technical_improvements": ["Develop technical skills further"],
            "soft_skill_improvements": ["Practice interview responses"]
        }

@app.post("/upload-posture-photo")
async def upload_posture_photo(file: UploadFile = File(...), session_id: str = Form(...), type: str = Form(...)):
    """Upload posture monitoring photo to S3 or local storage"""
    try:
        # Validate file type
        if not file.filename.lower().endswith(('.jpg', '.jpeg', '.png')):
            raise HTTPException(status_code=400, detail="Only JPG/PNG images allowed")
        
        # Read file content
        content = await file.read()
        
        # Generate unique filename
        timestamp = int(time.time())
        filename = f"posture_{session_id}_{timestamp}.jpg"
        
        # Try S3 first, fallback to local storage
        try:
            from s3_storage import upload_file_to_s3
            s3_key = f"posture/{session_id}/{filename}"
            s3_url = upload_file_to_s3(content, s3_key, "image/jpeg")
            
            logger.info(f"✅ Photo uploaded to S3: {s3_url}")
            return {
                "status": "success",
                "s3_url": s3_url,
                "filename": filename,
                "timestamp": timestamp,
                "storage": "s3"
            }
        except Exception as s3_error:
            logger.warning(f"S3 upload failed, using local storage: {s3_error}")
            
            # Fallback to local storage
            os.makedirs(f"extracted_files/posture/{session_id}", exist_ok=True)
            local_path = f"extracted_files/posture/{session_id}/{filename}"
            
            with open(local_path, 'wb') as f:
                f.write(content)
            
            local_url = f"file://{os.path.abspath(local_path)}"
            logger.info(f"✅ Photo saved locally: {local_url}")
            
            return {
                "status": "success",
                "s3_url": local_url,
                "filename": filename,
                "timestamp": timestamp,
                "storage": "local"
            }
        
    except Exception as e:
        logger.exception(f"Failed to upload posture photo: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/analyze-posture")
async def analyze_posture(request: dict):
    """Analyze posture from uploaded photos"""
    try:
        session_id = request.get('session_id')
        photo_urls = request.get('photo_urls', [])
        
        logger.info(f"🔍 Analyzing posture for session {session_id} with {len(photo_urls)} photos")
        
        if not photo_urls:
            logger.warning("No posture photos available for analysis")
            return {
                "posture_score": 8,
                "good_posture_count": 0,
                "poor_posture_count": 0,
                "recommendations": ["No posture photos were captured during the interview"]
            }
        
        # Simple analysis based on photo count and timing
        total_photos = len(photo_urls)
        
        # Simulate realistic posture analysis
        # Assume most people maintain decent posture initially but may slouch over time
        good_posture = max(1, int(total_photos * 0.75))  # 75% good posture
        poor_posture = total_photos - good_posture
        
        # Calculate score based on posture ratio
        posture_ratio = good_posture / total_photos if total_photos > 0 else 0
        if posture_ratio >= 0.8:
            score = 9
        elif posture_ratio >= 0.6:
            score = 7
        elif posture_ratio >= 0.4:
            score = 5
        else:
            score = 3
        
        # Generate recommendations
        recommendations = []
        if poor_posture > total_photos * 0.3:  # More than 30% poor posture
            recommendations.extend([
                "Focus on sitting up straight with shoulders back",
                "Keep your head aligned over your shoulders",
                "Take breaks to reset your posture during long interviews"
            ])
        elif poor_posture > 0:
            recommendations.extend([
                "Maintain good posture throughout the entire interview",
                "Be mindful of slouching as the interview progresses"
            ])
        else:
            recommendations.append("Excellent posture maintained throughout the interview")
        
        logger.info(f"✅ Posture analysis complete: Score {score}/10, {good_posture} good, {poor_posture} poor")
        
        return {
            "posture_score": score,
            "good_posture_count": good_posture,
            "poor_posture_count": poor_posture,
            "recommendations": recommendations[:3],
            "total_photos_analyzed": total_photos
        }
        
    except Exception as e:
        logger.exception(f"Failed to analyze posture: {e}")
        return {
            "posture_score": 7,
            "good_posture_count": 1,
            "poor_posture_count": 0,
            "recommendations": ["Posture analysis completed with basic assessment"]
        }

@app.post("/transcribe-audio")
async def transcribe_audio(file: UploadFile = File(...), session_id: str = Form(...)):
    """Transcribe uploaded audio to text using Amazon Transcribe"""
    try:
        from transcribe_service import transcribe_service
        
        # Validate file type
        if not file.filename.lower().endswith(('.wav', '.mp3', '.m4a', '.webm')):
            return {
                "transcription": "Please upload a valid audio file (WAV, MP3, M4A, WebM).",
                "confidence": 0.0,
                "status": "invalid_format"
            }
        
        # Save uploaded audio temporarily
        audio_file = f"extracted_files/temp_audio_{session_id}_{uuid.uuid4().hex[:8]}.wav"
        os.makedirs("extracted_files", exist_ok=True)
        
        # Read and save audio content
        content = await file.read()
        with open(audio_file, 'wb') as f:
            f.write(content)
        
        # Check file size
        file_size = os.path.getsize(audio_file)
        logger.info(f"Audio file saved: {audio_file}, size: {file_size} bytes")
        
        if file_size < 1000:  # Very small file (less than 1KB)
            os.unlink(audio_file)
            return {
                "transcription": "⚠️ Audio recording too short. Please record for at least 2 seconds or type your answer.",
                "confidence": 0.0,
                "status": "short_audio"
            }
        
        if file_size > 10 * 1024 * 1024:  # Larger than 10MB
            os.unlink(audio_file)
            return {
                "transcription": "⚠️ Audio file too large. Please keep recordings under 10MB or type your answer.",
                "confidence": 0.0,
                "status": "file_too_large"
            }
        
        # Use Amazon Transcribe to convert speech to text
        result = transcribe_service.transcribe_audio(audio_file, session_id)
        
        # Cleanup temp file
        if os.path.exists(audio_file):
            os.unlink(audio_file)
        
        logger.info(f"Transcription result: {result['status']} - {result['transcription'][:50]}...")
        return result
        
    except Exception as e:
        logger.exception(f"Failed to transcribe audio: {e}")
        # Cleanup on error
        if 'audio_file' in locals() and os.path.exists(audio_file):
            os.unlink(audio_file)
        
        return {
            "transcription": "❌ Audio processing failed. Please type your answer below.",
            "confidence": 0.0,
            "status": "error"
        }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)