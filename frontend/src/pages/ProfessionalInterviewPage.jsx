import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Mic, MicOff, Send, ArrowLeft, Brain, Volume2, VolumeX, Trophy, Clock, Sparkles } from 'lucide-react';
import AIAvatar from '../components/AIAvatar';

const ProfessionalInterviewPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { sessionId, selectedAvatar: avatarFromState } = location.state || {};
  
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [questionHistory, setQuestionHistory] = useState([]);
  const [answer, setAnswer] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [accumulatedText, setAccumulatedText] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(avatarFromState || 'professional');
  const [interviewStartTime, setInterviewStartTime] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(5 * 60); // 5 minutes in seconds
  const [isInterviewComplete, setIsInterviewComplete] = useState(false);
  const audioRef = useRef(null);
  const recognitionRef = useRef(null);
  const speechRef = useRef(null);
  const isPlayingRef = useRef(false);
  const timerRef = useRef(null);

  const BACKEND_URL = 'http://localhost:8000';

  useEffect(() => {
    if (!sessionId) {
      navigate('/');
      return;
    }
    startProfessionalInterview();
  }, [sessionId]);

  // Timer countdown
  useEffect(() => {
    if (interviewStartTime && !isInterviewComplete) {
      timerRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            completeInterview();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [interviewStartTime, isInterviewComplete]);



  const startProfessionalInterview = async () => {
    const firstQuestion = {
      id: 1,
      question: "Hello! Welcome to your professional interview. I'm excited to learn more about you today. Could you please start by telling me about yourself, your background, and what brings you here?",
      type: "introduction"
    };
    
    setCurrentQuestion(firstQuestion);
    setQuestionHistory([firstQuestion]);
    setInterviewStartTime(Date.now());
    
    // Auto-play first question
    setTimeout(() => {
      playQuestionAudio(firstQuestion.question);
    }, 1000);
  };

  const generateNextQuestion = async (userAnswer, previousQuestion) => {
    try {
      const response = await fetch(`${BACKEND_URL}/generate-followup-question`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          previous_question: previousQuestion.question,
          user_answer: userAnswer,
          question_history: questionHistory.map(q => ({ question: q.question, type: q.type })),
          interview_duration: Math.floor((Date.now() - interviewStartTime) / 1000)
        })
      });

      if (response.ok) {
        const data = await response.json();
        return {
          id: questionHistory.length + 1,
          question: data.next_question,
          type: data.question_type || 'followup'
        };
      } else {
        throw new Error('Failed to generate question');
      }
    } catch (error) {
      console.error('Error generating next question:', error);
      return null;
    }
  };

  const submitAnswer = async () => {
    if (!answer.trim() || isLoading) return;
    
    setIsLoading(true);
    
    try {
      // Store the current answer
      const updatedHistory = questionHistory.map(q => 
        q.id === currentQuestion.id ? { ...q, answer: answer.trim() } : q
      );
      setQuestionHistory(updatedHistory);

      // Check if interview should end (5 minutes or enough questions)
      const elapsedMinutes = (Date.now() - interviewStartTime) / (1000 * 60);
      if (elapsedMinutes >= 4.5 || questionHistory.length >= 5) {
        completeInterview();
        return;
      }

      // Generate next question
      const nextQuestion = await generateNextQuestion(answer.trim(), currentQuestion);
      
      if (nextQuestion) {
        setCurrentQuestion(nextQuestion);
        setQuestionHistory(prev => [...prev, nextQuestion]);
        setAnswer('');
        setAccumulatedText('');
        
        // Auto-play next question
        setTimeout(() => {
          playQuestionAudio(nextQuestion.question);
        }, 500);
      } else {
        completeInterview();
      }
    } catch (error) {
      console.error('Error submitting answer:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const completeInterview = () => {
    setIsInterviewComplete(true);
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    // Generate final summary and navigate to report
    generateFinalSummary();
  };

  const generateFinalSummary = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/analyze-professional-interview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          question_history: questionHistory,
          total_duration: Math.floor((Date.now() - interviewStartTime) / 1000)
        })
      });

      if (response.ok) {
        const summaryData = await response.json();
        navigate('/interview-report', { 
          state: { 
            ...summaryData, 
            status: 'complete', 
            message: 'Professional Interview Complete' 
          } 
        });
      } else {
        throw new Error('Failed to generate summary');
      }
    } catch (error) {
      console.error('Error generating summary:', error);
      // Fallback summary
      navigate('/interview-report', { 
        state: { 
          overall_score: 7,
          total_questions: questionHistory.length,
          answered_questions: questionHistory.filter(q => q.answer).length,
          technical_strengths: ['Completed professional interview'],
          soft_skill_strengths: ['Engaged in conversation'],
          technical_improvements: ['Continue developing technical skills'],
          soft_skill_improvements: ['Practice interview communication'],
          status: 'complete',
          message: 'Professional Interview Complete'
        }
      });
    }
  };

  const playQuestionAudio = async (questionText) => {
    if ('speechSynthesis' in window && !isPlayingRef.current) {
      speechSynthesis.cancel();
      
      setTimeout(() => {
        const utterance = new SpeechSynthesisUtterance(questionText);
        utterance.rate = 0.9;
        utterance.pitch = 1.0;
        utterance.volume = 0.9;
        
        const voices = speechSynthesis.getVoices();
        const maleVoice = voices.find(voice => 
          voice.name.includes('Daniel') || voice.name.includes('Alex') || voice.name.includes('Tom') || 
          (voice.lang.includes('en') && voice.name.toLowerCase().includes('male'))
        ) || voices.find(voice => voice.lang.includes('en-US') && !voice.name.toLowerCase().includes('female'));
        
        if (maleVoice) {
          utterance.voice = maleVoice;
        }
        
        speechRef.current = utterance;
        isPlayingRef.current = true;
        
        utterance.onstart = () => {
          setIsPlayingAudio(true);
        };
        
        utterance.onend = () => {
          setIsPlayingAudio(false);
          isPlayingRef.current = false;
        };
        
        speechSynthesis.speak(utterance);
      }, 100);
    }
  };

  const startRecording = () => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      
      recognitionRef.current = recognition;
      setAccumulatedText('');
      
      recognition.onstart = () => {
        setIsRecording(true);
        setAnswer('🎤 Listening... Speak now!');
      };
      
      recognition.onresult = (event) => {
        let finalTranscript = '';
        let interimTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' '; // Add space after each final segment
          } else {
            interimTranscript += transcript;
          }
        }
        
        if (finalTranscript) {
          setAccumulatedText(prev => (prev + finalTranscript).trim());
        }
        
        const currentAccumulated = accumulatedText + finalTranscript;
        setAnswer((currentAccumulated + interimTranscript).trim());
      };
      
      recognition.onerror = () => {
        setIsRecording(false);
        if (!accumulatedText) {
          setAnswer('');
        }
      };
      
      recognition.start();
      setMediaRecorder({ stop: () => recognition.stop() });
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
      setMediaRecorder(null);
      
      if (accumulatedText) {
        setAnswer(accumulatedText);
      }
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!currentQuestion) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="p-4 bg-purple-100 rounded-full mb-4 mx-auto w-fit">
            <Brain className="h-12 w-12 text-purple-600 animate-pulse" />
          </div>
          <p className="text-gray-600">Starting your professional interview...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <button
            onClick={() => navigate('/mode-selection', { state: { sessionId } })}
            className="flex items-center text-gray-600 hover:text-gray-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back to Mode Selection
          </button>
          
          <div className="flex items-center gap-4">
            <div className="bg-white px-4 py-2 rounded-lg shadow">
              <span className="text-purple-800 font-medium">Professional Interview</span>
            </div>
            <div className={`px-4 py-2 rounded-lg shadow font-medium ${
              timeRemaining <= 300 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
            }`}>
              {formatTime(timeRemaining)}
            </div>
          </div>
        </div>

        {/* Main Interview Card */}
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-2">
              Question {questionHistory.length}
            </h2>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-gradient-to-r from-purple-500 to-blue-600 h-2 rounded-full transition-all duration-500"
                style={{ width: `${Math.min((questionHistory.length / 5) * 100, 100)}%` }}
              />
            </div>
          </div>

          {/* AI Avatar and Question */}
          <div className="flex items-start gap-6 mb-6">
            <AIAvatar 
              type={selectedAvatar}
              isAnimated={isPlayingAudio}
              size="large"
            />
            
            <div className="flex-1">
              <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 relative">
                <div className="absolute left-0 top-4 w-0 h-0 border-t-8 border-t-transparent border-b-8 border-b-transparent border-r-8 border-r-white transform -translate-x-2"></div>
                
                <div className="flex justify-between items-start">
                  <p className="text-lg text-gray-800 leading-relaxed flex-1 pr-4">
                    {currentQuestion.question}
                  </p>
                  <button
                    onClick={() => playQuestionAudio(currentQuestion.question)}
                    className="p-2 rounded-full bg-purple-100 hover:bg-purple-200 transition-colors"
                  >
                    <Volume2 className="w-5 h-5 text-purple-600" />
                  </button>
                </div>
                
                {isPlayingAudio && (
                  <div className="mt-3 flex items-center gap-2">
                    <div className="flex gap-1">
                      {[...Array(5)].map((_, i) => (
                        <div key={i} className="w-1 h-4 bg-purple-400 rounded animate-pulse" style={{animationDelay: `${i * 150}ms`}}></div>
                      ))}
                    </div>
                    <span className="text-sm text-purple-600 font-medium">Speaking...</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Answer Input */}
          <div className="space-y-4">
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Type your answer here or use voice recording..."
              className={`w-full h-32 p-4 border-2 rounded-xl transition-all duration-300 resize-none ${
                isRecording 
                  ? 'border-red-300 bg-red-50 shadow-red-100 shadow-lg' 
                  : 'border-gray-300 focus:border-purple-500 focus:shadow-purple-100 focus:shadow-lg'
              }`}
              disabled={isRecording}
            />
            
            <div className="flex gap-4">
              <button
                onClick={isRecording ? stopRecording : startRecording}
                className={`flex items-center px-6 py-3 rounded-xl font-medium transition-all duration-300 transform hover:scale-105 ${
                  isRecording 
                    ? 'bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700' 
                    : 'bg-gradient-to-r from-gray-600 to-gray-700 text-white hover:from-gray-700 hover:to-gray-800'
                }`}
              >
                {isRecording ? (
                  <>
                    <MicOff className="w-5 h-5 mr-2" />
                    Stop Recording
                  </>
                ) : (
                  <>
                    <Mic className="w-5 h-5 mr-2" />
                    Start Recording
                  </>
                )}
              </button>

              <button
                onClick={submitAnswer}
                disabled={!answer.trim() || isLoading || isRecording}
                className="flex-1 bg-gradient-to-r from-purple-600 to-blue-700 text-white py-3 px-6 rounded-xl hover:from-purple-700 hover:to-blue-800 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 flex items-center justify-center font-medium"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-3"></div>
                    <Brain className="w-5 h-5 mr-2 animate-pulse" />
                    Generating Next Question...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 mr-2" />
                    Submit Answer
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Complete Interview Button */}
          <div className="mt-6 text-center">
            <button
              onClick={completeInterview}
              className="bg-gradient-to-r from-green-500 to-green-600 text-white py-2 px-6 rounded-lg hover:from-green-600 hover:to-green-700 transition-all duration-300 font-medium flex items-center mx-auto"
            >
              <Trophy className="w-4 h-4 mr-2" />
              Complete Interview
            </button>
          </div>
        </div>
      </div>
      
      <audio ref={audioRef} />
    </div>
  );
};

export default ProfessionalInterviewPage;