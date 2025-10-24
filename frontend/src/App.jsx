import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import UploadPage from './pages/UploadPage';
import InterviewModeSelection from './pages/InterviewModeSelection';
import InterviewPage from './pages/InterviewPage';
import FullInterviewPage from './pages/FullInterviewPage';
import SpeechInterviewPage from './pages/SpeechInterviewPage';
import InterviewReport from './pages/InterviewReport';
import ProfessionalInterviewPage from './pages/ProfessionalInterviewPage';

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/upload" element={<UploadPage />} />
          <Route path="/mode-selection" element={<InterviewModeSelection />} />
          <Route path="/interview" element={<InterviewPage />} />
          <Route path="/full-interview" element={<FullInterviewPage />} />
          <Route path="/speech-interview" element={<SpeechInterviewPage />} />
          <Route path="/interview-report" element={<InterviewReport />} />
          <Route path="/professional-interview" element={<ProfessionalInterviewPage />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;