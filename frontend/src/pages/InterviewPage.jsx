import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Mic, MicOff, Send, ArrowLeft, Brain, Volume2, VolumeX } from 'lucide-react';

const InterviewPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { sessionId } = location.state || {};
  
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [availableVoices, setAvailableVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState('Joanna');
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);
  const [audioAutoPlayed, setAudioAutoPlayed] = useState(false);
  const audioRef = useRef(null);

  const BACKEND_URL = 'http://localhost:8000';

  useEffect(() => {
    if (!sessionId) {
      navigate('/');
      return;
    }
    generateQuestions();
    loadVoiceSettings();
  }, [sessionId]);

  const loadVoiceSettings = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/voices`);
      if (response.ok) {
        const data = await response.json();
        setAvailableVoices(data.voices);
        setSelectedVoice(data.current_voice);
      }
    } catch (error) {
      console.error('Error loading voice settings:', error);
    }
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
      } else {
        throw new Error('Failed to generate questions');
      }
    } catch (error) {
      console.error('Error generating questions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const submitAnswer = async () => {
    if (!answer.trim()) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/analyze-answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          question_id: questions[currentQuestionIndex].id,
          answer: answer
        })
      });
      
      if (response.ok) {
        const analysisData = await response.json();
        setAnalysis(analysisData);
        setShowAnalysis(true);
      } else {
        throw new Error('Failed to analyze answer');
      }
    } catch (error) {
      console.error('Error analyzing answer:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const nextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      // Stop current audio before moving to next question
      stopAudio();
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setAnswer('');
      setAnalysis(null);
      setShowAnalysis(false);
      setAudioAutoPlayed(false);
    }
  };

  const toggleRecording = () => {
    setIsRecording(!isRecording);
    // Voice recording implementation would go here
  };

  const replayWithVoice = async (voiceId) => {
    const currentQuestion = questions[currentQuestionIndex];
    if (!currentQuestion) return;

    try {
      setIsPlayingAudio(true);
      const response = await fetch(`${BACKEND_URL}/replay-question`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question_text: currentQuestion.question,
          voice_id: voiceId,
          use_ssml: true
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.has_audio && data.audio) {
          await playAudioFromBase64(data.audio);
        }
      }
    } catch (error) {
      console.error('Error replaying with voice:', error);
      setIsPlayingAudio(false);
    }
  };

  const playAudioFromBase64 = async (audioBase64) => {
    const binaryString = atob(audioBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    const audioBlob = new Blob([bytes], { type: 'audio/mpeg' });
    const audioUrl = URL.createObjectURL(audioBlob);
    
    if (audioRef.current) {
      if (audioRef.current.src) {
        URL.revokeObjectURL(audioRef.current.src);
      }
      
      audioRef.current.src = audioUrl;
      audioRef.current.load();
      
      await new Promise((resolve, reject) => {
        audioRef.current.oncanplay = resolve;
        audioRef.current.onerror = reject;
        setTimeout(reject, 3000);
      });
      
      await audioRef.current.play();
    }
  };

  const playQuestionAudio = async (autoPlay = false) => {
    const currentQuestion = questions[currentQuestionIndex];
    if (!currentQuestion.has_audio || !currentQuestion.audio) {
      if (!autoPlay) console.log('No audio available for current question');
      return;
    }

    try {
      setIsPlayingAudio(true);
      
      // Convert base64 to audio blob and play
      const binaryString = atob(currentQuestion.audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      const audioBlob = new Blob([bytes], { type: 'audio/mpeg' });
      const audioUrl = URL.createObjectURL(audioBlob);
      
      if (audioRef.current) {
        // Clean up previous audio URL
        if (audioRef.current.src) {
          URL.revokeObjectURL(audioRef.current.src);
        }
        
        audioRef.current.src = audioUrl;
        audioRef.current.load();
        
        // Wait for audio to be ready
        await new Promise((resolve, reject) => {
          audioRef.current.oncanplay = resolve;
          audioRef.current.onerror = reject;
          setTimeout(reject, 3000);
        });
        
        await audioRef.current.play();
      }
    } catch (error) {
      console.error('Audio playback error:', error);
      setIsPlayingAudio(false);
      if (!autoPlay) {
        alert('Audio playback failed. Please check your browser settings and try again.');
      }
    }
  };

  // Auto-play question audio when question changes
  useEffect(() => {
    if (questions.length > 0 && questions[currentQuestionIndex]?.has_audio) {
      setAudioAutoPlayed(false);
      // Attempt auto-play with a small delay
      const timer = setTimeout(async () => {
        try {
          await playQuestionAudio(true);
          setAudioAutoPlayed(true);
        } catch (error) {
          console.log('Auto-play failed, user interaction required');
          setAudioAutoPlayed(false);
        }
      }, 800);
      
      return () => clearTimeout(timer);
    }
  }, [currentQuestionIndex, questions]);

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsPlayingAudio(false);
  };

  if (isLoading && questions.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <Brain className="h-12 w-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-lg text-gray-600">Generating personalized interview questions...</p>
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-gray-600">No questions available. Please upload your resume first.</p>
          <button 
            onClick={() => navigate('/')}
            className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === questions.length - 1;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <button 
            onClick={() => navigate('/')}
            className="flex items-center text-gray-600 hover:text-gray-800"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Back to Upload
          </button>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900">AI Interview</h1>
            <p className="text-gray-600">Question {currentQuestionIndex + 1} of {questions.length}</p>
          </div>
          <div className="w-20"></div>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
            ></div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Question Panel */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="mb-4">
              <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                currentQuestion.type === 'technical' ? 'bg-blue-100 text-blue-800' :
                currentQuestion.type === 'behavioral' ? 'bg-green-100 text-green-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {currentQuestion.type}
              </span>
            </div>
            
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                {currentQuestion.question}
              </h2>
              
              {/* Enhanced Audio Player */}
              {currentQuestion.has_audio ? (
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className={`p-2 rounded-full mr-3 ${
                        isPlayingAudio ? 'bg-green-100 animate-pulse' : 'bg-blue-100'
                      }`}>
                        <Volume2 className={`h-5 w-5 ${
                          isPlayingAudio ? 'text-green-600' : 'text-blue-600'
                        }`} />
                      </div>
                      <div>
                        <span className="text-blue-800 font-medium block">
                          🎧 AI Voice Question
                        </span>
                        <span className="text-blue-600 text-sm">
                          {isPlayingAudio ? 'Playing question...' : 
                           audioAutoPlayed ? 'Question played automatically' :
                           'Click to hear the question'}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex space-x-2">
                      <button
                        onClick={() => playQuestionAudio(false)}
                        disabled={isPlayingAudio}
                        className={`flex items-center px-6 py-3 rounded-lg font-medium transition-all transform hover:scale-105 ${
                          isPlayingAudio 
                            ? 'bg-green-600 text-white shadow-lg' 
                            : 'bg-blue-600 text-white hover:bg-blue-700 shadow-md'
                        } disabled:opacity-50 disabled:transform-none`}
                      >
                        <Volume2 className="h-5 w-5 mr-2" />
                        {isPlayingAudio ? 'Playing...' : 'Play Question'}
                      </button>
                      
                      {isPlayingAudio && (
                        <button
                          onClick={stopAudio}
                          className="flex items-center px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all transform hover:scale-105 shadow-md"
                        >
                          <VolumeX className="h-4 w-4 mr-2" />
                          Stop
                        </button>
                      )}
                      
                      <button
                        onClick={() => setShowVoiceSettings(!showVoiceSettings)}
                        className="flex items-center px-3 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all"
                        title="Voice Settings"
                      >
                        ⚙️
                      </button>
                    </div>
                  </div>
                  
                  {/* Voice Settings Panel */}
                  {showVoiceSettings && (
                    <div className="mt-3 p-3 bg-white border border-gray-200 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">Voice Options:</span>
                        <button
                          onClick={() => setShowVoiceSettings(false)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          ✕
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {availableVoices.slice(0, 4).map((voice) => (
                          <button
                            key={voice.id}
                            onClick={() => replayWithVoice(voice.id)}
                            disabled={isPlayingAudio}
                            className={`p-2 text-xs rounded border transition-all ${
                              voice.id === selectedVoice
                                ? 'bg-blue-100 border-blue-300 text-blue-800'
                                : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                            } disabled:opacity-50`}
                          >
                            {voice.name} ({voice.gender})
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
                  <div className="flex items-center">
                    <VolumeX className="h-5 w-5 text-gray-400 mr-2" />
                    <span className="text-gray-600">Audio not available for this question</span>
                  </div>
                </div>
              )}
            </div>
            
            {/* Audio element with enhanced event handling */}
            <audio 
              ref={audioRef} 
              onEnded={() => {
                setIsPlayingAudio(false);
                console.log('Audio playback completed');
              }}
              onError={(e) => {
                console.error('Audio playback error:', e);
                setIsPlayingAudio(false);
              }}
              onPlay={() => console.log('Audio started playing')}
              onPause={() => setIsPlayingAudio(false)}
              preload="metadata"
            />

            {/* Answer Input */}
            <div className="space-y-4">
              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Type your answer here..."
                className="w-full h-40 p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                disabled={showAnalysis}
              />
              
              <div className="flex space-x-3">
                <button
                  onClick={toggleRecording}
                  className={`flex items-center px-4 py-2 rounded-lg font-medium ${
                    isRecording 
                      ? 'bg-red-600 text-white' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  disabled={showAnalysis}
                >
                  {isRecording ? <MicOff className="h-4 w-4 mr-2" /> : <Mic className="h-4 w-4 mr-2" />}
                  {isRecording ? 'Stop Recording' : 'Voice Answer'}
                </button>
                
                <button
                  onClick={submitAnswer}
                  disabled={!answer.trim() || isLoading || showAnalysis}
                  className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  <Send className="h-4 w-4 mr-2" />
                  {isLoading ? 'Analyzing...' : 'Submit Answer'}
                </button>
              </div>
            </div>
          </div>

          {/* Analysis Panel */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            {showAnalysis && analysis ? (
              <div className="space-y-6">
                <div className="text-center">
                  <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full text-2xl font-bold ${
                    analysis.score >= 8 ? 'bg-green-100 text-green-600' :
                    analysis.score >= 6 ? 'bg-yellow-100 text-yellow-600' :
                    'bg-red-100 text-red-600'
                  }`}>
                    {analysis.score}
                  </div>
                  <p className="text-sm text-gray-600 mt-2">Score out of 10</p>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Feedback</h3>
                  <p className="text-gray-700">{analysis.feedback}</p>
                </div>

                <div>
                  <h3 className="font-semibold text-green-600 mb-2">Strengths</h3>
                  <ul className="list-disc list-inside space-y-1">
                    {analysis.strengths.map((strength, index) => (
                      <li key={index} className="text-gray-700">{strength}</li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h3 className="font-semibold text-orange-600 mb-2">Areas for Improvement</h3>
                  <ul className="list-disc list-inside space-y-1">
                    {analysis.improvements.map((improvement, index) => (
                      <li key={index} className="text-gray-700">{improvement}</li>
                    ))}
                  </ul>
                </div>

                <button
                  onClick={isLastQuestion ? () => navigate('/') : nextQuestion}
                  className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                >
                  {isLastQuestion ? 'Finish Interview' : 'Next Question'}
                </button>
              </div>
            ) : (
              <div className="text-center text-gray-500 py-12">
                <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Submit your answer to see AI analysis</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InterviewPage;