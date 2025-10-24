# AI Interviewer

An AI-powered interview system that generates personalized questions based on resumes and job descriptions, with text-to-speech capabilities.

## Features

- 📄 **Resume & JD Processing**: Upload PDF/DOCX files or paste text
- 🤖 **AI Question Generation**: Uses Amazon Bedrock (Claude 3 Sonnet) for personalized questions
- 🎤 **Text-to-Speech**: AWS Polly integration with neural voices
- 💾 **Dual Storage**: AWS S3 + local fallback for reliability
- 🎯 **Smart Fallback**: Intelligent static questions when AI is unavailable
- 🔊 **Audio Controls**: Auto-play, manual controls, and voice selection

## Architecture

### Backend (FastAPI)
- **File Processing**: PyMuPDF, python-docx for text extraction
- **AI Generation**: Amazon Bedrock with Claude 3 Sonnet
- **Text-to-Speech**: AWS Polly with neural engine
- **Storage**: AWS S3 with local backup
- **Authentication**: AWS SSO profile-based

### Frontend (React)
- **File Upload**: Drag-and-drop interface
- **Audio Player**: Enhanced controls with voice settings
- **Real-time**: Live question generation and audio playback
- **Responsive**: Mobile-friendly design

## Setup

### Prerequisites
- Python 3.11+
- Node.js 18+
- AWS CLI configured with SSO profile

### Backend Setup
```bash
cd server
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### Frontend Setup
```bash
cd frontend
npm install
```

### Environment Configuration
Create `server/.env`:
```
AWS_PROFILE=your-aws-profile
AWS_DEFAULT_REGION=us-west-2
```

## Running the Application

### Start Backend
```bash
cd server
uvicorn app:app --reload --port 8000
```

### Start Frontend
```bash
cd frontend
npm start
```

Access the application at `http://localhost:3000`

## AWS Services Used

- **Amazon Bedrock**: AI question generation with Claude 3 Sonnet
- **AWS Polly**: Neural text-to-speech synthesis
- **Amazon S3**: Secure file storage with dual strategy
- **AWS SSO**: Profile-based authentication

## Project Structure

```
AI-Interviewer/
├── server/                 # FastAPI backend
│   ├── app.py             # Main application
│   ├── ai_question_generator.py
│   ├── polly_service.py
│   ├── s3_storage.py
│   └── requirements.txt
├── frontend/              # React frontend
│   ├── src/
│   │   ├── pages/
│   │   └── components/
│   └── package.json
└── README.md
```

## Key Features Implemented

### 🎯 AI Question Generation
- Analyzes resume content and job descriptions
- Generates 8 personalized questions across categories:
  - Technical skills (2-3 questions)
  - Behavioral scenarios (2-3 questions)
  - Problem-solving (1-2 questions)
  - Cultural fit (1-2 questions)

### 🔊 Text-to-Speech Integration
- AWS Polly neural voices (Joanna, Matthew, Amy, Brian)
- Auto-play functionality with manual controls
- Voice selection panel for different AI voices
- Base64 audio embedding for seamless playback

### 💾 Robust Storage Strategy
- Primary: AWS S3 with profile-based authentication
- Fallback: Local file system for reliability
- Session-based organization with unique IDs

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details
