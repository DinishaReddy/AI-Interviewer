import os
import uuid
from typing import Optional, List
import tempfile
import logging
import json

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



@app.get("/health")
async def health_check():
    """Simple health check endpoint"""
    return {"status": "ok"}



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
    """Generate AI-powered interview questions with text-to-speech (no storage)"""
    try:
        # Load extracted texts from S3/local storage
        from s3_storage import load_extracted_data
        from polly_service import polly_service
        from ai_question_generator import ai_question_generator
        
        resume_data = load_extracted_data(request.session_id, "resume")
        jd_data = load_extracted_data(request.session_id, "jd")
        
        resume_text = resume_data.get('text', '')
        jd_text = jd_data.get('text', '')
        
        if not resume_text:
            raise HTTPException(status_code=400, detail="No resume data found")
        
        logger.info(f"Generating AI questions for session: {request.session_id}")
        
        # Generate questions using AI (no storage)
        questions = ai_question_generator.generate_questions(resume_text, jd_text)
        
        # Add audio for each question using AWS Polly with optimal voice
        interview_voice = polly_service.get_interview_voice()
        logger.info(f"Using voice '{interview_voice}' for interview questions")
        
        for question in questions:
            try:
                # Generate audio with neural voice
                audio_base64 = polly_service.text_to_speech(
                    question['question'], 
                    voice_id=interview_voice
                )
                question['audio'] = audio_base64
                question['has_audio'] = audio_base64 is not None
                question['voice_id'] = interview_voice
            except Exception as e:
                logger.warning(f"Failed to generate audio for question {question['id']}: {e}")
                question['audio'] = None
                question['has_audio'] = False
                question['voice_id'] = None
        
        # Count questions by type for summary
        question_summary = {
            "total": len(questions),
            "technical": len([q for q in questions if q['type'] == 'technical']),
            "behavioral": len([q for q in questions if q['type'] == 'behavioral']),
            "general": len([q for q in questions if q['type'] == 'general'])
        }
        
        logger.info(f"Generated {len(questions)} questions with audio for session: {request.session_id}")
        
        return {
            "questions": questions, 
            "session_id": request.session_id,
            "summary": question_summary,
            "message": "AI-generated questions with audio (real-time)",
            "ai_powered": ai_question_generator.ai_available
        }
        
    except Exception as e:
        logger.exception(f"Failed to generate questions: {e}")
        raise HTTPException(status_code=500, detail=str(e))

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
    """Analyze candidate's answer to interview question"""
    try:
        # Load questions and resume from S3/local storage
        from s3_storage import load_extracted_data, save_extracted_data
        
        questions = load_extracted_data(request.session_id, "questions")
        if not questions:
            raise HTTPException(status_code=400, detail="No questions found for session")
        
        # Find the specific question
        question_text = ""
        for q in questions:
            if q['id'] == request.question_id:
                question_text = q['question']
                break
        
        if not question_text:
            raise HTTPException(status_code=400, detail="Question not found")
        
        # Load resume context
        resume_data = load_extracted_data(request.session_id, "resume")
        resume_text = resume_data.get('text', '')
        
        # Placeholder for answer analysis
        analysis = {
            "score": 7,
            "feedback": "Good answer with relevant details.",
            "strengths": ["Clear communication", "Relevant experience"],
            "improvements": ["Could provide more specific examples"]
        }
        
        # Save analysis to S3 and local storage
        analysis_data = {
            "question_id": request.question_id,
            "question": question_text,
            "answer": request.answer,
            "analysis": analysis
        }
        save_extracted_data(request.session_id, f"analysis_{request.question_id}", analysis_data)
        
        return analysis
        
    except Exception as e:
        logger.exception(f"Failed to analyze answer: {e}")
        raise HTTPException(status_code=500, detail=str(e))

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