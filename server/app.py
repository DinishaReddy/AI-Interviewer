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
from ai_interview import generate_interview_questions, analyze_answer
from speech_interview import generate_adaptive_questions, text_to_speech, comprehensive_answer_analysis, determine_next_difficulty
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
    allow_origins=["http://localhost:3000", "http://localhost:5173"],  # Frontend URLs
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



@app.get("/health")
async def health_check():
    """Simple health check endpoint"""
    return {"status": "ok"}



def extract_text_from_pdf(file_path: str) -> str:
    """Extract text from PDF using PyMuPDF"""
    try:
        # Ensure file exists before opening
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")
            
        with fitz.open(file_path) as doc:
            text = "".join(page.get_text("text", flags=1+2+8) for page in doc)
        logger.info(f"Successfully extracted text from PDF: {len(text)} characters")
        return text.strip()
    except Exception as e:
        logger.exception(f"PDF text extraction failed for file: {file_path}")
        raise

def extract_text_from_docx(file_path: str) -> str:
    """Extract text from DOCX file by joining all paragraphs"""
    try:
        # Ensure file exists before opening
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")
            
        doc = Document(file_path)
        text = "\n".join(p.text for p in doc.paragraphs)
        logger.info(f"Successfully extracted text from DOCX: {len(text)} characters")
        return text.strip()
    except Exception as e:
        logger.exception(f"DOCX text extraction failed for file: {file_path}")
        raise

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
    resumeFile: UploadFile = File(...),  # Required resume file
    jdFile: Optional[UploadFile] = File(None),  # Optional JD file
    jdText: Optional[str] = Form(None)  # Optional JD text
):
    """
    Upload and process resume and job description files.
    Extracts text and stores everything in S3.
    """
    logger.info(f"Upload request received - Resume: {resumeFile.filename if resumeFile else None}, JD File: {jdFile.filename if jdFile else None}, JD Text length: {len(jdText) if jdText else 0}")
    
    # Validation: resumeFile is required
    if not resumeFile:
        raise HTTPException(status_code=400, detail="resumeFile is required")
    
    # Handle empty JD fields gracefully - make JD optional
    if not jdFile and (not jdText or not jdText.strip()):
        logger.info("No JD provided, processing resume only")
        # This is allowed - continue processing with resume only
    
    # Validate file extensions
    allowed_extensions = ['.pdf', '.docx']
    resume_ext = os.path.splitext(resumeFile.filename)[1].lower()
    if resume_ext not in allowed_extensions:
        raise HTTPException(status_code=400, detail="Resume file must be PDF or DOCX")
    
    if jdFile:
        jd_ext = os.path.splitext(jdFile.filename)[1].lower()
        if jd_ext not in allowed_extensions:
            raise HTTPException(status_code=400, detail="JD file must be PDF or DOCX")
    
    # Create unique session ID
    session_id = str(uuid.uuid4())
    
    # Dictionary to store local file paths for response
    file_paths = {}
    
    try:
        # Process resume file
        resume_content = await resumeFile.read()
        logger.info(f"Read resume file: {resumeFile.filename}, size: {len(resume_content)} bytes")
        
        # Save resume file temporarily for text extraction
        with tempfile.NamedTemporaryFile(suffix=resume_ext, delete=False) as tmp_file:
            tmp_file.write(resume_content)
            tmp_file.flush()  # Ensure data is written to disk
            resume_temp_path = tmp_file.name
        
        logger.info(f"Saved resume to temporary file: {resume_temp_path}")
        
        try:
            # Extract text from resume with detailed error handling
            try:
                if resume_ext == '.pdf':
                    resume_text = extract_text_from_pdf(resume_temp_path)
                else:  # .docx
                    resume_text = extract_text_from_docx(resume_temp_path)
            except Exception as e:
                logger.exception(f"Failed to extract text from resume file {resumeFile.filename}")
                raise HTTPException(status_code=500, detail=f"Resume text extraction failed: {str(e)}")
            
            # Save original resume file to S3
            from s3_storage import save_extracted_data, upload_resume_file_to_s3
            
            # Upload original resume file to S3
            original_resume_s3_path = upload_resume_file_to_s3(session_id, resume_content, resumeFile.filename)
            if original_resume_s3_path:
                file_paths['original_resume'] = original_resume_s3_path
            
            # Save extracted resume text to S3 and local
            resume_data = {"text": resume_text}
            resume_path = save_extracted_data(session_id, "resume", resume_data)
            file_paths['extracted_resume_text'] = resume_path
            
            # Parse resume into structured sections
            structured_resume = parse_resume_sections(resume_text)
            
            # Save structured resume to S3 and local
            structured_path = save_extracted_data(session_id, "structured_resume", structured_resume)
            file_paths['structured_resume'] = structured_path
            
            print("✅ Resume data saved to S3 and local storage")
            
        finally:
            # Clean up temporary resume file
            os.unlink(resume_temp_path)
        
        # Process JD file if provided
        if jdFile and jdFile.filename:
            try:
                jd_content = await jdFile.read()
                jd_ext = os.path.splitext(jdFile.filename)[1].lower()
                logger.info(f"Read JD file: {jdFile.filename}, size: {len(jd_content)} bytes")
                
                # Save JD file temporarily for text extraction
                with tempfile.NamedTemporaryFile(suffix=jd_ext, delete=False) as tmp_file:
                    tmp_file.write(jd_content)
                    tmp_file.flush()  # Ensure data is written to disk
                    jd_temp_path = tmp_file.name
                
                logger.info(f"Saved JD file to temporary file: {jd_temp_path}")
                
                try:
                    # Extract text from JD file with detailed error handling
                    try:
                        if jd_ext == '.pdf':
                            jd_text_extracted = extract_text_from_pdf(jd_temp_path)
                        else:  # .docx
                            jd_text_extracted = extract_text_from_docx(jd_temp_path)
                    except Exception as e:
                        logger.exception(f"Failed to extract text from JD file {jdFile.filename}")
                        raise HTTPException(status_code=500, detail=f"JD text extraction failed: {str(e)}")
                    
                    # Save extracted JD text to S3 and local
                    jd_data = {"text": jd_text_extracted}
                    jd_path = save_extracted_data(session_id, "jd", jd_data)
                    file_paths['extracted_jd_text'] = jd_path
                    print("✅ JD data saved to S3 and local storage")
                    
                finally:
                    # Clean up temporary JD file
                    if os.path.exists(jd_temp_path):
                        os.unlink(jd_temp_path)
            except Exception as e:
                logger.exception(f"Error processing JD file: {jdFile.filename if jdFile else 'None'}")
                # Don't fail the entire request if JD processing fails
                logger.warning("JD file processing failed, continuing with resume only")
        
        # Process JD text if provided directly
        elif jdText and jdText.strip():
            try:
                # Save JD text directly to S3 and local
                jd_data = {"text": jdText.strip()}
                jd_path = save_extracted_data(session_id, "jd", jd_data)
                file_paths['extracted_jd_text'] = jd_path
                print("✅ JD text saved to S3 and local storage")
            except Exception as e:
                logger.exception("Error saving JD text")
                # Don't fail the entire request if JD text saving fails
                logger.warning("JD text saving failed, continuing with resume only")
        
        logger.info(f"Successfully processed upload session: {session_id}, files created: {list(file_paths.keys())}")
        response_data = {
            "message": "Files processed and text extracted successfully",
            "session_id": session_id,
            "file_paths": file_paths
        }
        logger.info(f"Returning response: {response_data}")
        return response_data
        
    except HTTPException:
        # Re-raise HTTP exceptions (already handled above)
        raise
    except Exception as e:
        logger.exception(f"Unexpected error during upload processing for session {session_id}")
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")

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
        
        # Analyze answer using AI
        analysis = analyze_answer(question_text, request.answer, resume_text)
        
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
        
        # Generate adaptive questions with fallback
        questions = generate_adaptive_questions(resume_text, jd_text, request.difficulty_level)
        
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
        if first_question:
            audio_file = text_to_speech(first_question['question'], request.session_id)
        
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
        
        # Comprehensive analysis
        analysis = comprehensive_answer_analysis(
            current_question['question'], 
            request.answer, 
            resume_text, 
            request.response_time
        )
        
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
        
        # Determine next question difficulty
        next_difficulty = determine_next_difficulty(analysis, session_data['question_history'])
        
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

@app.post("/speech-interview/transcribe")
async def transcribe_audio(file: UploadFile = File(...), session_id: str = Form(...)):
    """Transcribe uploaded audio to text using Amazon Transcribe"""
    try:
        # Save uploaded audio temporarily
        audio_file = f"extracted_files/temp_audio_{session_id}_{uuid.uuid4().hex[:8]}.wav"
        
        async with aiofiles.open(audio_file, 'wb') as f:
            content = await file.read()
            await f.write(content)
        
        # Get file size to verify audio was captured
        file_size = os.path.getsize(audio_file)
        logger.info(f"Audio file saved: {audio_file}, size: {file_size} bytes")
        
        if file_size < 1000:  # Very small file
            os.unlink(audio_file)
            return {
                "transcription": "⚠️ Audio recording too short. Please record again or type your answer.",
                "confidence": 0.0,
                "status": "short_audio"
            }
        
        # Use AWS Transcribe to convert speech to text
        from aws_transcribe import transcribe_audio_with_aws
        result = transcribe_audio_with_aws(audio_file, session_id)
        
        # Cleanup temp file
        os.unlink(audio_file)
        
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