# S3 Setup Guide for AI Interviewer

This guide will help you set up AWS S3 storage for your AI Interviewer application to store uploaded resumes.

## Prerequisites

1. **AWS Account**: You need an active AWS account
2. **AWS CLI**: Already installed ✅
3. **Python Dependencies**: Install required packages

```bash
pip install -r requirements.txt
```

## Step 1: Get AWS Credentials

1. **Login to AWS Console**: Go to [AWS Console](https://console.aws.amazon.com/)
2. **Navigate to IAM**: Services → IAM → Users
3. **Create or Select User**: 
   - If creating new: Click "Add user" → Enter username → Select "Programmatic access"
   - If using existing: Click on your username
4. **Get Credentials**: 
   - Go to "Security credentials" tab
   - Click "Create access key"
   - **Important**: Download and save the Access Key ID and Secret Access Key

## Step 2: Configure AWS Credentials

Choose one of these methods:

### Method 1: Using AWS CLI (Recommended)
```bash
aws configure
```
Enter when prompted:
- **AWS Access Key ID**: Your access key from Step 1
- **AWS Secret Access Key**: Your secret key from Step 1  
- **Default region name**: `us-east-1`
- **Default output format**: `json`

### Method 2: Using Environment Variables
```bash
export AWS_ACCESS_KEY_ID=your_access_key_here
export AWS_SECRET_ACCESS_KEY=your_secret_key_here
export AWS_DEFAULT_REGION=us-east-1
```

### Method 3: Using .env File
1. Copy the example file:
```bash
cp .env.example .env
```
2. Edit `.env` file and add your credentials:
```
AWS_ACCESS_KEY_ID=your_access_key_here
AWS_SECRET_ACCESS_KEY=your_secret_key_here
AWS_DEFAULT_REGION=us-east-1
```

## Step 3: Create S3 Bucket

Run the setup script:
```bash
python setup_s3.py
```

This will:
- ✅ Verify your AWS credentials
- ✅ Create the S3 bucket: `ai-interviewer-data-bucket`
- ✅ Configure CORS settings
- ✅ Test S3 upload functionality

## Step 4: Verify Setup

After successful setup, your resume files will be stored in:
- **S3 Bucket**: `s3://ai-interviewer-data-bucket/sessions/{session_id}/`
- **Local Fallback**: `./extracted_files/` (if S3 fails)

## File Storage Structure

```
s3://ai-interviewer-data-bucket/
└── sessions/
    └── {session_id}/
        ├── original_resume.pdf          # Original uploaded file
        ├── resume.json                  # Extracted text
        ├── structured_resume.json       # Parsed resume sections
        ├── jd.json                     # Job description (if provided)
        └── questions.json              # Generated questions
```

## Troubleshooting

### Issue: "InvalidClientTokenId" Error
**Solution**: Your AWS credentials are invalid or expired
- Double-check your Access Key ID and Secret Access Key
- Make sure the IAM user has S3 permissions

### Issue: "BucketAlreadyExists" Error  
**Solution**: The bucket name is taken globally
- The script will try to use the existing bucket if you own it
- If not, it will suggest an alternative name

### Issue: S3 Upload Fails
**Solution**: The app will automatically fall back to local storage
- Check your internet connection
- Verify S3 permissions for your IAM user

### Issue: Missing Dependencies
**Solution**: Install required packages
```bash
pip install python-dotenv boto3 botocore
```

## IAM Permissions Required

Your AWS user needs these S3 permissions:
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:CreateBucket",
                "s3:PutObject",
                "s3:GetObject",
                "s3:PutBucketCors"
            ],
            "Resource": [
                "arn:aws:s3:::ai-interviewer-data-bucket",
                "arn:aws:s3:::ai-interviewer-data-bucket/*"
            ]
        }
    ]
}
```

## Testing

After setup, test the functionality:
1. Start your server: `python app.py`
2. Upload a resume through the web interface
3. Check the logs for "✅ Resume data saved to S3 and local storage"
4. Verify files appear in your S3 bucket

## Support

If you encounter issues:
1. Check the server logs for detailed error messages
2. Run `python setup_s3.py` again to verify configuration
3. Ensure your AWS credentials have proper S3 permissions

---

🎉 **Success!** Your AI Interviewer now stores resume files securely in AWS S3!