import boto3
import json
import os
import logging
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)

# Load environment variables if dotenv is available
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # dotenv not installed, use system environment variables

# Initialize S3 client
try:
    # Get AWS region from environment or use default
    aws_region = os.getenv('AWS_DEFAULT_REGION', 'us-west-2')
    
    # Try to use AWS profile for SSO
    profile_name = os.getenv('AWS_PROFILE', 'cpisb_IsbUsersPS-039384756194')
    
    try:
        # Try with profile first (for SSO)
        session = boto3.Session(profile_name=profile_name)
        s3_client = session.client('s3', region_name=aws_region)
        logger.info(f"S3 client initialized with profile: {profile_name}")
    except Exception:
        # Fallback to default credentials
        s3_client = boto3.client('s3', region_name=aws_region)
        logger.info(f"S3 client initialized with default credentials")
    
    # Get S3 bucket name from environment or use default
    S3_BUCKET = os.getenv('S3_BUCKET_NAME', 'ai-interviewer-data-bucket')
    
    logger.info(f"S3 client initialized for region: {aws_region}, bucket: {S3_BUCKET}")
except Exception as e:
    logger.warning(f"S3 client initialization failed: {e}")
    s3_client = None
    S3_BUCKET = None

def upload_to_s3(file_content, s3_key: str, content_type: str = 'application/json') -> bool:
    """Upload content to S3"""
    if not s3_client:
        return False
    
    try:
        s3_client.put_object(
            Bucket=S3_BUCKET,
            Key=s3_key,
            Body=file_content,
            ContentType=content_type
        )
        logger.info(f"Uploaded to S3: s3://{S3_BUCKET}/{s3_key}")
        return True
    except Exception as e:
        logger.exception(f"Failed to upload to S3: {e}")
        return False

def upload_resume_file_to_s3(session_id: str, file_content: bytes, filename: str) -> str:
    """Upload original resume file to S3"""
    file_ext = os.path.splitext(filename)[1].lower()
    content_type = 'application/pdf' if file_ext == '.pdf' else 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    
    s3_key = f"sessions/{session_id}/original_resume{file_ext}"
    
    if upload_to_s3(file_content, s3_key, content_type):
        return f"s3://{S3_BUCKET}/{s3_key}"
    return None

def download_from_s3(s3_key: str) -> str:
    """Download content from S3"""
    if not s3_client:
        return None
    
    try:
        response = s3_client.get_object(Bucket=S3_BUCKET, Key=s3_key)
        content = response['Body'].read().decode('utf-8')
        logger.info(f"Downloaded from S3: s3://{S3_BUCKET}/{s3_key}")
        return content
    except Exception as e:
        logger.exception(f"Failed to download from S3: {e}")
        return None

def save_extracted_data(session_id: str, data_type: str, content: dict) -> str:
    """Save extracted data to both local and S3"""
    # Local storage (fallback)
    local_path = f"extracted_files/{data_type}_{session_id}.json"
    os.makedirs("extracted_files", exist_ok=True)
    
    try:
        with open(local_path, 'w', encoding='utf-8') as f:
            json.dump(content, f, ensure_ascii=False, indent=2)
        logger.info(f"Saved locally: {local_path}")
    except Exception as e:
        logger.exception(f"Failed to save locally: {e}")
    
    # S3 storage
    s3_key = f"sessions/{session_id}/{data_type}.json"
    json_content = json.dumps(content, ensure_ascii=False, indent=2)
    
    if upload_to_s3(json_content, s3_key):
        return f"s3://{S3_BUCKET}/{s3_key}"
    else:
        return local_path

def load_extracted_data(session_id: str, data_type: str) -> dict:
    """Load extracted data from S3 or local fallback"""
    # Try S3 first
    s3_key = f"sessions/{session_id}/{data_type}.json"
    s3_content = download_from_s3(s3_key)
    
    if s3_content:
        try:
            return json.loads(s3_content)
        except Exception as e:
            logger.exception(f"Failed to parse S3 content: {e}")
    
    # Fallback to local storage
    local_path = f"extracted_files/{data_type}_{session_id}.json"
    if os.path.exists(local_path):
        try:
            with open(local_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            logger.exception(f"Failed to load local file: {e}")
    
    # Try legacy local paths
    legacy_paths = [
        f"extracted_files/extracted_{data_type}_text.json",
        f"extracted_files/structured_{data_type}.json",
        f"extracted_files/{data_type}.json"
    ]
    
    for path in legacy_paths:
        if os.path.exists(path):
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception as e:
                continue
    
    return {}