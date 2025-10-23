import boto3
import json
import logging
import os
from typing import List, Dict

logger = logging.getLogger(__name__)

class AIQuestionGenerator:
    def __init__(self):
        # Initialize Amazon Bedrock client
        try:
            profile_name = os.getenv('AWS_PROFILE', 'cpisb_IsbUsersPS-039384756194')
            aws_region = os.getenv('AWS_DEFAULT_REGION', 'us-west-2')
            
            try:
                session = boto3.Session(profile_name=profile_name)
                self.bedrock_client = session.client('bedrock-runtime', region_name=aws_region)
                logger.info(f"Bedrock client initialized with profile: {profile_name}")
            except Exception:
                self.bedrock_client = boto3.client('bedrock-runtime', region_name=aws_region)
                logger.info("Bedrock client initialized with default credentials")
            
            self.ai_available = True
            logger.info("Amazon Bedrock initialized")
        except Exception as e:
            logger.warning(f"Bedrock initialization failed: {e}")
            self.bedrock_client = None
            self.ai_available = False
    
    def generate_questions(self, resume_text: str, jd_text: str = None) -> List[Dict]:
        """Generate interview questions using AI based on resume and job description"""
        
        if self.ai_available:
            try:
                return self._generate_with_bedrock(resume_text, jd_text)
            except Exception as e:
                logger.exception(f"AI question generation failed: {e}")
        
        # Fallback to smart static questions
        return self._generate_fallback_questions(resume_text, jd_text)
    
    def _generate_with_bedrock(self, resume_text: str, jd_text: str = None) -> List[Dict]:
        """Generate questions using Amazon Bedrock Claude model"""
        
        prompt = self._create_prompt(resume_text, jd_text)
        
        # Use Claude 3 Sonnet model
        body = json.dumps({
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 1500,
            "temperature": 0.7,
            "messages": [
                {
                    "role": "user",
                    "content": "You are an expert HR interviewer. Generate relevant, insightful interview questions.\n\n" + prompt
                }
            ]
        })
        
        response = self.bedrock_client.invoke_model(
            modelId='anthropic.claude-3-sonnet-20240229-v1:0',
            body=body
        )
        
        response_body = json.loads(response['body'].read())
        ai_response = response_body['content'][0]['text']
        
        # Parse the AI response to extract questions
        try:
            # Look for JSON in the response
            start = ai_response.find('[')
            end = ai_response.rfind(']') + 1
            if start != -1 and end != 0:
                questions_json = ai_response[start:end]
                questions = json.loads(questions_json)
                
                # Validate and format questions
                formatted_questions = []
                for i, q in enumerate(questions[:8]):  # Limit to 8 questions
                    formatted_questions.append({
                        "id": i + 1,
                        "question": q.get("question", "").strip(),
                        "type": q.get("type", "general").lower(),
                        "category": q.get("category", "general"),
                        "difficulty": q.get("difficulty", "medium")
                    })
                
                return formatted_questions
        except Exception as e:
            logger.warning(f"Failed to parse AI response: {e}")
        
        # If parsing fails, return fallback
        return self._generate_fallback_questions(resume_text, jd_text)
    
    def _create_prompt(self, resume_text: str, jd_text: str = None) -> str:
        """Create a detailed prompt for AI question generation"""
        
        jd_section = f"JOB DESCRIPTION:\n{jd_text[:1000]}" if jd_text else ""
        resume_section = f"RESUME:\n{resume_text[:2000]}"
        
        prompt = f"""Based on the following resume{' and job description' if jd_text else ''}, generate 8 diverse interview questions that would effectively evaluate this candidate.

{resume_section}

{jd_section}

Generate questions that cover:
1. Technical skills and experience (2-3 questions)
2. Behavioral/situational scenarios (2-3 questions) 
3. Problem-solving and critical thinking (1-2 questions)
4. Cultural fit and motivation (1-2 questions)

Return ONLY a JSON array in this exact format:
[
  {{
    "question": "Tell me about a challenging technical problem you solved recently.",
    "type": "technical",
    "category": "problem_solving",
    "difficulty": "medium"
  }},
  {{
    "question": "Describe a time when you had to work with a difficult team member.",
    "type": "behavioral", 
    "category": "teamwork",
    "difficulty": "medium"
  }}
]

Make questions specific to the candidate's background and the role requirements."""
        return prompt
    
    def _generate_fallback_questions(self, resume_text: str, jd_text: str = None) -> List[Dict]:
        """Generate smart fallback questions based on resume content"""
        
        resume_lower = resume_text.lower() if resume_text else ""
        
        # Base questions
        questions = [
            {
                "id": 1,
                "question": "Tell me about yourself and your professional journey.",
                "type": "general",
                "category": "introduction",
                "difficulty": "easy"
            },
            {
                "id": 2,
                "question": "Describe a challenging project you worked on and how you overcame obstacles.",
                "type": "behavioral",
                "category": "problem_solving", 
                "difficulty": "medium"
            },
            {
                "id": 3,
                "question": "How do you stay updated with the latest technologies and industry trends?",
                "type": "general",
                "category": "learning",
                "difficulty": "easy"
            },
            {
                "id": 4,
                "question": "Tell me about a time when you had to learn a new technology quickly.",
                "type": "behavioral",
                "category": "adaptability",
                "difficulty": "medium"
            }
        ]
        
        # Add technology-specific questions based on resume
        tech_questions = []
        
        if any(word in resume_lower for word in ['python', 'java', 'javascript', 'programming', 'software']):
            tech_questions.append({
                "id": 5,
                "question": "Walk me through your approach to debugging a complex software issue.",
                "type": "technical",
                "category": "debugging",
                "difficulty": "medium"
            })
        
        if any(word in resume_lower for word in ['aws', 'cloud', 'azure', 'gcp']):
            tech_questions.append({
                "id": 6,
                "question": "Explain your experience with cloud technologies and their benefits.",
                "type": "technical", 
                "category": "cloud",
                "difficulty": "medium"
            })
        
        if any(word in resume_lower for word in ['machine learning', 'ai', 'data science', 'ml']):
            tech_questions.append({
                "id": 7,
                "question": "Describe a machine learning project you've worked on from start to finish.",
                "type": "technical",
                "category": "data_science",
                "difficulty": "hard"
            })
        
        if any(word in resume_lower for word in ['react', 'frontend', 'ui', 'web development']):
            tech_questions.append({
                "id": 8,
                "question": "How do you ensure good user experience in your frontend applications?",
                "type": "technical",
                "category": "frontend",
                "difficulty": "medium"
            })
        
        # Add behavioral questions
        behavioral_questions = [
            {
                "id": len(questions) + len(tech_questions) + 1,
                "question": "Describe a situation where you had to work under tight deadlines.",
                "type": "behavioral",
                "category": "time_management",
                "difficulty": "medium"
            },
            {
                "id": len(questions) + len(tech_questions) + 2,
                "question": "Tell me about a time when you disagreed with your manager or team lead.",
                "type": "behavioral",
                "category": "conflict_resolution",
                "difficulty": "hard"
            }
        ]
        
        # Combine and limit to 8 questions
        all_questions = questions + tech_questions + behavioral_questions
        return all_questions[:8]

# Global instance
ai_question_generator = AIQuestionGenerator()