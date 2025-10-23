import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import UploadPage from './pages/UploadPage';
import InterviewPage from './pages/InterviewPage';
import SpeechInterviewPage from './pages/SpeechInterviewPage';

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<UploadPage />} />
          <Route path="/interview" element={<InterviewPage />} />
          <Route path="/speech-interview" element={<SpeechInterviewPage />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;