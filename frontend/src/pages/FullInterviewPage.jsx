import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Mic, MicOff, ArrowLeft, Clock, CheckCircle } from 'lucide-react';

const FullInterviewPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { sessionId, interviewMode } = location.state || {};
  
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(20 * 60); // 20 minutes
  const [isInterviewComplete, setIsInterviewComplete] = useState(false);
  const [finalReport, setFinalReport] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const timerRef = useRef(null);
  const BACKEND_URL = 'http://localhost:8000';

  useEffect(() => {
    if (!sessionId || interviewMode !== 'full') {
      navigate('/');
      return;
    }
    generateQuestions();
    startTimer();
    
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startTimer = () => {
    timerRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          completeInterview();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const generateQuestions = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/generate-questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId })
      });
      
      if (response.ok) {
        const data = await response.json();
        setQuestions(data.questions);
      }
    } catch (error) {
      console.error('Error generating questions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const submitAnswer = () => {
    if (!currentAnswer.trim()) return;
    
    const newAnswers = [...answers, {
      questionId: questions[currentQuestionIndex].id,
      question: questions[currentQuestionIndex].question,
      answer: currentAnswer,
      timestamp: new Date().toISOString()
    }];
    
    setAnswers(newAnswers);
    setCurrentAnswer('');
    
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      completeInterview();
    }
  };

  const completeInterview = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsInterviewComplete(true);
    setIsLoading(true);
    
    try {
      const response = await fetch(`${BACKEND_URL}/complete-interview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          answers: answers,
          duration: (20 * 60) - timeRemaining
        })
      });
      
      if (response.ok) {
        const report = await response.json();
        setFinalReport(report);
      }
    } catch (error) {
      console.error('Error generating final report:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isInterviewComplete) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-xl shadow-lg p-8">
            <div className="text-center mb-8">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h1 className="text-3xl font-bold text-gray-800 mb-2">
                Interview Complete!
              </h1>
              <p className="text-gray-600">
                Here's your comprehensive interview report
              </p>
            </div>
            
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-4 text-gray-600">Generating your report...</p>
              </div>
            ) : finalReport ? (
              <div className="space-y-6">
                <div className="bg-gray-50 p-6 rounded-lg">
                  <h3 className="text-xl font-semibold mb-4">Overall Performance</h3>
                  <p className="text-gray-700">{finalReport.summary}</p>
                </div>
                
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="bg-green-50 p-6 rounded-lg">
                    <h4 className="font-semibold text-green-800 mb-2">Strengths</h4>
                    <ul className="space-y-1">
                      {finalReport.strengths?.map((strength, index) => (
                        <li key={index} className="text-green-700">• {strength}</li>
                      ))}
                    </ul>
                  </div>
                  
                  <div className="bg-orange-50 p-6 rounded-lg">
                    <h4 className="font-semibold text-orange-800 mb-2">Areas for Improvement</h4>
                    <ul className="space-y-1">
                      {finalReport.improvements?.map((improvement, index) => (
                        <li key={index} className="text-orange-700">• {improvement}</li>
                      ))}
                    </ul>
                  </div>
                </div>
                
                <button
                  onClick={() => navigate('/')}
                  className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Start New Interview
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <button
            onClick={() => navigate('/mode-selection', { state: { sessionId } })}
            className="flex items-center text-gray-600 hover:text-gray-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back
          </button>
          
          <div className="flex items-center bg-white px-4 py-2 rounded-lg shadow">
            <Clock className="w-5 h-5 text-blue-600 mr-2" />
            <span className="font-mono text-lg font-semibold text-gray-800">
              {formatTime(timeRemaining)}
            </span>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-800">
                Question {currentQuestionIndex + 1} of {questions.length}
              </h2>
              <div className="bg-blue-100 px-3 py-1 rounded-full">
                <span className="text-blue-800 text-sm font-medium">Full Interview Mode</span>
              </div>
            </div>
            
            <div className="w-full bg-gray-200 rounded-full h-2 mb-6">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
              ></div>
            </div>
          </div>

          {questions.length > 0 && (
            <div className="mb-8">
              <div className="bg-gray-50 p-6 rounded-lg mb-6">
                <p className="text-lg text-gray-800 leading-relaxed">
                  {questions[currentQuestionIndex]?.question}
                </p>
              </div>

              <div className="space-y-4">
                <textarea
                  value={currentAnswer}
                  onChange={(e) => setCurrentAnswer(e.target.value)}
                  placeholder="Type your answer here..."
                  className="w-full h-32 p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />

                <div className="flex gap-4">
                  <button
                    onClick={() => setIsRecording(!isRecording)}
                    className={`flex items-center px-4 py-2 rounded-lg transition-colors ${
                      isRecording 
                        ? 'bg-red-600 text-white hover:bg-red-700' 
                        : 'bg-gray-600 text-white hover:bg-gray-700'
                    }`}
                  >
                    {isRecording ? <MicOff className="w-5 h-5 mr-2" /> : <Mic className="w-5 h-5 mr-2" />}
                    {isRecording ? 'Stop Recording' : 'Start Recording'}
                  </button>

                  <button
                    onClick={submitAnswer}
                    disabled={!currentAnswer.trim()}
                    className="flex-1 bg-blue-600 text-white py-2 px-6 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                  >
                    {currentQuestionIndex === questions.length - 1 ? 'Complete Interview' : 'Next Question'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FullInterviewPage;