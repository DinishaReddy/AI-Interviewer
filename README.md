<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>AI Interviewer - Walkthrough</title>
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      margin: 0;
      padding: 0;
      background-color: #ffffff;
      color: #222;
      line-height: 1.6;
    }
    header {
      background: #f6f8fa;
      padding: 20px;
      border-bottom: 1px solid #e1e4e8;
      position: sticky;
      top: 0;
      z-index: 100;
    }
    header h1 {
      margin: 0;
      font-size: 24px;
    }
    .container {
      max-width: 960px;
      margin: 0 auto;
      padding: 20px;
    }
    section {
      margin-bottom: 40px;
    }
    section h2 {
      font-size: 22px;
      margin-bottom: 10px;
      border-bottom: 2px solid #eaecef;
      padding-bottom: 5px;
    }
    p {
      font-size: 16px;
      color: #333;
    }
    img {
      width: 100%;
      border: 1px solid #ddd;
      border-radius: 8px;
      margin-top: 10px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.1);
    }
    .caption {
      font-size: 14px;
      color: #555;
      margin-top: 6px;
      text-align: center;
    }
    footer {
      text-align: center;
      padding: 30px 0;
      border-top: 1px solid #eee;
      color: #777;
      font-size: 14px;
    }
  </style>
</head>
<body>

<header>
  <h1>🤖 AI Interviewer Application - Walkthrough</h1>
</header>

<div class="container">
  <section>
    <h2>Home Page</h2>
    <p>
      This is the home page of the AI Interviewer Application. It introduces users to the purpose of the app 
      and provides a starting point for uploading their resume or beginning a practice interview.
    </p>
    <img src="./images/Screenshot 2025-10-24 at 1.47.18 PM.png" alt="Home Page Screenshot">
    <div class="caption">Home page – users are welcomed and can start their interview preparation.</div>
  </section>

  <section>
    <h2>Upload Resume & Job Description</h2>
    <p>
      On this screen, users upload their resume and job description. The system extracts key information such as 
      skills, experience, and job requirements using PyMuPDF and python-docx libraries.
    </p>
    <img src="./images/Screenshot 2025-10-24 at 3.46.56 PM.png" alt="Upload Resume and JD">
    <div class="caption">Upload screen – users can drag and drop files to begin analysis.</div>
  </section>

  <section>
    <h2>Mode Selection</h2>
    <p>
      After uploading files, users can choose between two modes:
      <ul>
        <li><b>Practice Mode:</b> Get instant feedback after every answer.</li>
        <li><b>Professional Mode:</b> A full 10-minute uninterrupted interview simulation.</li>
      </ul>
    </p>
    <img src="./images/Screenshot 2025-10-24 at 3.47.04 PM.png" alt="Mode Selection Screen">
    <div class="caption">Mode selection – choose Practice or Professional mode to continue.</div>
  </section>

  <section>
    <h2>Interview Screen</h2>
    <p>
      Once an interview begins, the AI asks questions based on the uploaded resume and job description. 
      The system uses Amazon Bedrock with Claude 3 Sonnet for generating questions and AWS Polly for voice output.
    </p>
    <img src="./images/Screenshot 2025-10-24 at 3.47.19 PM.png" alt="Interview Screen">
    <div class="caption">Interview session – user interacts with AI in real-time.</div>
  </section>

  <section>
    <h2>Practice Mode Feedback</h2>
    <p>
      In Practice Mode, users receive immediate feedback after each question, showing strengths and areas for improvement. 
      A summary is displayed at the end of the session.
    </p>
    <img src="./images/Screenshot 2025-10-24 at 3.47.50 PM.png" alt="Practice Mode Feedback">
    <div class="caption">Practice Mode – per-question feedback with guidance tips.</div>
  </section>

  <section>
    <h2>Professional Mode Interview</h2>
    <p>
      In Professional Mode, the interview runs for about 10 minutes without interruptions. 
      The AI can also ask follow-up questions depending on user answers.
    </p>
    <img src="./images/Screenshot 2025-10-24 at 3.48.05 PM.png" alt="Professional Interview Screen">
    <div class="caption">Professional Mode – uninterrupted interview experience.</div>
  </section>

  <section>
    <h2>Interview Feedback Summary</h2>
    <p>
      After completing the session, users get an overall summary of their performance with AI-generated insights.
    </p>
    <img src="./images/Screenshot 2025-10-24 at 3.49.24 PM.png" alt="Feedback Summary">
    <div class="caption">Performance summary – final report of interview session.</div>
  </section>

  <section>
    <h2>Performance Report - Detailed</h2>
    <p>
      Users can also review more detailed breakdowns of how they performed across different question categories.
    </p>
    <img src="./images/Screenshot 2025-10-24 at 3.49.37 PM.png" alt="Detailed Report">
    <div class="caption">Detailed breakdown – category-wise performance evaluation.</div>
  </section>

  <section>
    <h2>Overall Performance Summary</h2>
    <p>
      This final summary view presents an overview of all practice and professional interview attempts.
    </p>
    <img src="./images/Screenshot 2025-10-24 at 3.49.51 PM.png" alt="Overall Summary">
    <div class="caption">Overall summary – combined report of user's performance.</div>
  </section>

  <section>
    <h2>Interview Data Management</h2>
    <p>
      All user interviews, audio files, and logs are securely stored in AWS S3. This ensures that data remains 
      safe and can be retrieved for future analysis.
    </p>
    <img src="./images/Screenshot 2025-10-24 at 3.55.44 PM.png" alt="AWS S3 Management">
    <div class="caption">AWS S3 – secure cloud storage for interview sessions.</div>
  </section>

  <section>
    <h2>AI Question Generation</h2>
    <p>
      The backend uses Amazon Bedrock with Claude 3 Sonnet to generate intelligent and contextual interview questions.
    </p>
    <img src="./images/Screenshot 2025-10-24 at 3.58.20 PM.png" alt="AI Question Generation">
    <div class="caption">Claude 3 Sonnet – powering the question generation process.</div>
  </section>

  <section>
    <h2>Audio Response & AWS Polly</h2>
    <p>
      Text-to-speech is handled by AWS Polly using neural voices, making the interview more natural and realistic.
    </p>
    <img src="./images/Screenshot 2025-10-24 at 3.59.46 PM.png" alt="AWS Polly TTS">
    <div class="caption">AWS Polly – converting questions to realistic voice output.</div>
  </section>

  <section>
    <h2>Backend Processing</h2>
    <p>
      The backend is powered by Flask and FastAPI, handling AI logic, resume parsing, and communication with AWS services.
    </p>
    <img src="./images/Screenshot 2025-10-24 at 4.01.46 PM.png" alt="Backend Processing">
    <div class="caption">Backend architecture – Flask and FastAPI orchestrating AI and storage layers.</div>
  </section>

  <footer>
    <p>© 2025 AI Interviewer Project by Dinisha Reddy • React + Flask + AWS Bedrock + Claude 3 Sonnet</p>
  </footer>
</div>

</body>
</html>
