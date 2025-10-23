import boto3
import json
import time
import uuid
import os
import logging
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)

class TranscribeService:
    def __init__(self):
        try:
            # Use same AWS profile as other services
            profile_name = os.getenv('AWS_PROFILE', 'cpisb_IsbUsersPS-039384756194')
            aws_region = os.getenv('AWS_DEFAULT_REGION', 'us-west-2')
            
            try:
                session = boto3.Session(profile_name=profile_name)
                self.transcribe_client = session.client('transcribe', region_name=aws_region)
                self.s3_client = session.client('s3', region_name=aws_region)
                logger.info(f"Transcribe client initialized with profile: {profile_name}")
            except Exception:
                self.transcribe_client = boto3.client('transcribe', region_name=aws_region)
                self.s3_client = boto3.client('s3', region_name=aws_region)
                logger.info("Transcribe client initialized with default credentials")
            
            self.bucket_name = os.getenv('S3_BUCKET_NAME', 'ai-interviewer-data-bucket')
            self.available = True
            
        except Exception as e:
            logger.warning(f"Transcribe service initialization failed: {e}")
            self.transcribe_client = None
            self.s3_client = None
            self.available = False
    
    def transcribe_audio(self, audio_file_path: str, session_id: str) -> dict:
        """Transcribe audio file to text using Amazon Transcribe"""
        if not self.available:
            return {
                "transcription": "Speech-to-text service unavailable. Please type your answer.",
                "confidence": 0.0,
                "status": "service_unavailable"
            }
        
        try:
            # Generate unique job name
            job_name = f"interview-{session_id}-{uuid.uuid4().hex[:8]}"
            
            # Upload audio to S3 first
            s3_key = f"audio/{job_name}.wav"
            audio_uri = self._upload_audio_to_s3(audio_file_path, s3_key)
            
            if not audio_uri:
                return {
                    "transcription": "Audio upload failed. Please type your answer.",
                    "confidence": 0.0,
                    "status": "upload_failed"
                }
            
            # Start transcription job
            response = self.transcribe_client.start_transcription_job(
                TranscriptionJobName=job_name,
                Media={'MediaFileUri': audio_uri},
                MediaFormat='wav',
                LanguageCode='en-US',
                Settings={
                    'ShowSpeakerLabels': False,
                    'MaxSpeakerLabels': 1
                }
            )
            
            # Wait for completion (with timeout)
            max_wait_time = 30  # 30 seconds max
            wait_time = 0
            
            while wait_time < max_wait_time:
                status_response = self.transcribe_client.get_transcription_job(
                    TranscriptionJobName=job_name
                )
                
                status = status_response['TranscriptionJob']['TranscriptionJobStatus']
                
                if status == 'COMPLETED':
                    # Get transcription result
                    transcript_uri = status_response['TranscriptionJob']['Transcript']['TranscriptFileUri']
                    transcription_text = self._get_transcription_text(transcript_uri)
                    
                    # Cleanup
                    self._cleanup_transcription_job(job_name, s3_key)
                    
                    return {
                        "transcription": transcription_text,
                        "confidence": 0.9,  # Transcribe doesn't provide word-level confidence easily
                        "status": "success"
                    }
                
                elif status == 'FAILED':
                    error_reason = status_response['TranscriptionJob'].get('FailureReason', 'Unknown error')
                    logger.error(f"Transcription failed: {error_reason}")
                    self._cleanup_transcription_job(job_name, s3_key)
                    
                    return {
                        "transcription": "Audio transcription failed. Please type your answer.",
                        "confidence": 0.0,
                        "status": "transcription_failed"
                    }
                
                # Wait before checking again
                time.sleep(2)
                wait_time += 2
            
            # Timeout reached
            logger.warning(f"Transcription job {job_name} timed out")
            self._cleanup_transcription_job(job_name, s3_key)
            
            return {
                "transcription": "Audio processing timed out. Please type your answer.",
                "confidence": 0.0,
                "status": "timeout"
            }
            
        except Exception as e:
            logger.exception(f"Transcription error: {e}")
            return {
                "transcription": "Audio processing error. Please type your answer.",
                "confidence": 0.0,
                "status": "error"
            }
    
    def _upload_audio_to_s3(self, file_path: str, s3_key: str) -> str:
        """Upload audio file to S3 and return URI"""
        try:
            with open(file_path, 'rb') as f:
                self.s3_client.upload_fileobj(
                    f, 
                    self.bucket_name, 
                    s3_key,
                    ExtraArgs={'ContentType': 'audio/wav'}
                )
            
            audio_uri = f"s3://{self.bucket_name}/{s3_key}"
            logger.info(f"Audio uploaded to: {audio_uri}")
            return audio_uri
            
        except Exception as e:
            logger.exception(f"S3 upload failed: {e}")
            return None
    
    def _get_transcription_text(self, transcript_uri: str) -> str:
        """Download and parse transcription result"""
        try:
            import requests
            response = requests.get(transcript_uri)
            transcript_data = response.json()
            
            # Extract the transcription text
            transcripts = transcript_data['results']['transcripts']
            if transcripts:
                return transcripts[0]['transcript'].strip()
            else:
                return "No speech detected in audio."
                
        except Exception as e:
            logger.exception(f"Failed to get transcription text: {e}")
            return "Failed to process transcription result."
    
    def _cleanup_transcription_job(self, job_name: str, s3_key: str):
        """Clean up transcription job and S3 files"""
        try:
            # Delete transcription job
            self.transcribe_client.delete_transcription_job(TranscriptionJobName=job_name)
        except Exception as e:
            logger.warning(f"Failed to delete transcription job: {e}")
        
        try:
            # Delete audio file from S3
            self.s3_client.delete_object(Bucket=self.bucket_name, Key=s3_key)
        except Exception as e:
            logger.warning(f"Failed to delete S3 object: {e}")

# Global instance
transcribe_service = TranscribeService()