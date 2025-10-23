# AI Interviewer Backend

FastAPI backend server for processing resume and job description files with robust text extraction and AWS S3 storage.

## Features

- **File Upload**: Accepts PDF and DOCX files for resumes and job descriptions
- **Robust Text Extraction**: Multi-layered approach using PyMuPDF, pdfminer.six, and OCR fallback
- **AWS S3 Storage**: Uploads original files and extracted text to S3
- **CORS Support**: Configured for frontend at http://localhost:5173

## Setup

### Prerequisites

1. **Python 3.8+**
2. **AWS Credentials**: Configure AWS credentials using one of these methods:
   - AWS CLI: `aws configure`
   - Environment variables: `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`
   - IAM roles (if running on EC2)
3. **Tesseract OCR** (for OCR fallback):
   ```bash
   # macOS
   brew install tesseract
   
   # Ubuntu/Debian
   sudo apt-get install tesseract-ocr
   
   # Windows
   # Download from: https://github.com/UB-Mannheim/tesseract/wiki
   ```

### Installation

1. **Install dependencies**:
   ```bash
   cd server
   pip install -r requirements.txt
   ```

2. **Set environment variables** (optional):
   ```bash
   export S3_BUCKET=your-bucket-name  # defaults to 'ai-interviewer-data'
   ```

3. **Create S3 bucket** (if it doesn't exist):
   ```bash
   aws s3 mb s3://ai-interviewer-data
   ```

## Running the Server

```bash
cd server
python app.py
```

Or using uvicorn directly:
```bash
uvicorn app:app --host 0.0.0.0 --port 8000 --reload
```

The server will be available at: http://localhost:8000

## API Endpoints

### Health Check
```
GET /health
```
Returns: `{"status": "ok"}`

### File Upload
```
POST /upload
Content-Type: multipart/form-data
```

**Fields:**
- `resumeFile` (required): PDF or DOCX file
- `jdFile` (optional): PDF or DOCX file
- `jdText` (optional): Plain text string

**Validation:**
- `resumeFile` is required
- At least one of `jdFile` or `jdText` must be provided
- Files must be PDF (.pdf) or DOCX (.docx) format

**Response:**
```json
{
  "message": "Files uploaded and processed successfully",
  "upload_id": "uuid-string",
  "s3_urls": {
    "resume": "https://bucket.s3.amazonaws.com/uploads/uuid/resume.pdf",
    "jd": "https://bucket.s3.amazonaws.com/uploads/uuid/jd.pdf",
    "jd_text": "https://bucket.s3.amazonaws.com/uploads/uuid/jd_text.txt",
    "extracted_resume_text": "https://bucket.s3.amazonaws.com/uploads/uuid/extracted_resume_text.txt",
    "extracted_jd_text": "https://bucket.s3.amazonaws.com/uploads/uuid/extracted_jd_text.txt"
  }
}
```

## Text Extraction Process

The backend uses a robust 3-tier approach for PDF text extraction:

1. **PyMuPDF (Primary)**: Fast extraction for text-based PDFs
2. **pdfminer.six (Fallback)**: Better handling of complex layouts
3. **OCR with Tesseract (Last Resort)**: For image-based or scanned PDFs

For DOCX files, it uses python-docx to extract text from all paragraphs.

## S3 Storage Structure

Files are stored with the following structure:
```
uploads/{uuid}/
├── resume.pdf                    # Original resume file
├── jd.pdf                       # Original JD file (if provided)
├── jd_text.txt                  # JD text (if provided as text)
├── extracted_resume_text.txt     # Extracted resume text
└── extracted_jd_text.txt        # Extracted JD text
```

## Error Handling

- **400 Bad Request**: Invalid file format or missing required fields
- **500 Internal Server Error**: S3 upload failures or text extraction errors

## Security Notes

- No AWS credentials are hardcoded in the application
- Uses boto3 default credential chain for AWS authentication
- CORS is configured only for the specific frontend URL
- File uploads are validated for allowed extensions