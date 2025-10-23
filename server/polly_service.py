import boto3
import os
import logging
from botocore.exceptions import ClientError
import tempfile
import base64

logger = logging.getLogger(__name__)

class PollyService:
    def __init__(self):
        try:
            # Use same profile configuration as S3
            profile_name = os.getenv('AWS_PROFILE', 'cpisb_IsbUsersPS-039384756194')
            aws_region = os.getenv('AWS_DEFAULT_REGION', 'us-west-2')
            
            try:
                session = boto3.Session(profile_name=profile_name)
                self.polly_client = session.client('polly', region_name=aws_region)
                logger.info(f"Polly client initialized with profile: {profile_name}")
            except Exception:
                self.polly_client = boto3.client('polly', region_name=aws_region)
                logger.info("Polly client initialized with default credentials")
                
        except Exception as e:
            logger.warning(f"Polly client initialization failed: {e}")
            self.polly_client = None
    
    def text_to_speech(self, text: str, voice_id: str = 'Joanna', use_ssml: bool = False) -> str:
        """Convert text to speech and return base64 encoded audio"""
        if not self.polly_client:
            logger.warning("Polly client not available")
            return None
            
        if not text or not text.strip():
            logger.warning("Empty text provided for speech synthesis")
            return None
            
        try:
            # Clean text for speech synthesis
            clean_text = self._clean_text_for_speech(text)
            
            response = self.polly_client.synthesize_speech(
                Text=clean_text,
                OutputFormat='mp3',
                VoiceId=voice_id,
                Engine='neural'
            )
            
            # Read audio stream and encode as base64
            audio_data = response['AudioStream'].read()
            audio_base64 = base64.b64encode(audio_data).decode('utf-8')
            
            logger.info(f"Generated speech for text: {text[:50]}... (voice: {voice_id}, size: {len(audio_data)} bytes)")
            return audio_base64
            
        except Exception as e:
            logger.exception(f"Failed to generate speech: {e}")
            return None
    
    def _clean_text_for_speech(self, text: str) -> str:
        """Clean text for better speech synthesis"""
        # Simple text cleaning for neural engine compatibility
        clean_text = text.strip()
        clean_text = clean_text.replace('"', '')
        clean_text = clean_text.replace("'", "")
        return clean_text
    
    def get_available_voices(self) -> list:
        """Get list of available voices"""
        if not self.polly_client:
            return []
            
        try:
            response = self.polly_client.describe_voices(Engine='neural')
            voices = [{
                'id': voice['Id'],
                'name': voice['Name'],
                'gender': voice['Gender'],
                'language': voice['LanguageCode']
            } for voice in response['Voices'] if voice['LanguageCode'].startswith('en')]
            
            return voices
        except Exception as e:
            logger.exception(f"Failed to get voices: {e}")
            return []

    def get_interview_voice(self) -> str:
        """Get the best voice for interview questions"""
        # Preferred voices for interview context (professional, clear)
        preferred_voices = ['Joanna', 'Matthew', 'Amy', 'Brian']
        
        try:
            available_voices = self.get_available_voices()
            available_ids = [v['id'] for v in available_voices]
            
            # Return first available preferred voice
            for voice in preferred_voices:
                if voice in available_ids:
                    return voice
            
            # Fallback to first English neural voice
            if available_voices:
                return available_voices[0]['id']
                
        except Exception as e:
            logger.warning(f"Could not determine best voice: {e}")
        
        return 'Joanna'  # Final fallback

# Global instance
polly_service = PollyService()