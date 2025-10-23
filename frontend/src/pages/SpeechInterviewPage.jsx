import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Mic, MicOff, Play, Pause, Volume2, ArrowLeft, Brain, Clock, TrendingUp } from 'lucide-react';

const SpeechInterviewPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { sessionId } = location.state || {};
  
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [answer, setAnswer] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlayingQuestion, setIsPlayingQuestion] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [sessionProgress, setSessionProgress] = useState({ completed: 0, total: 0, average_score: 0 });
  const [responseStartTime, setResponseStartTime] = useState(null);
  const [currentAudio, setCurrentAudio] = useState(null);
  
  const audioRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const BACKEND_URL = 'http://localhost:8000';

  useEffect(() => {
    if (!sessionId) {
      navigate('/');
      return;
    }
    startSpeechInterview();
  }, [sessionId]);

  const startSpeechInterview = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/speech-interview/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          session_id: sessionId,
          difficulty_level: "baseline"
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setCurrentQuestion(data.first_question);
        setCurrentAudio(data.audio_file);
        setSessionProgress({ 
          completed: 0, 
          total: data.total_questions, 
          average_score: 0 
        });
        
        // Audio is optional - user can click to play if available
      } else {
        throw new Error('Failed to start speech interview');
      }
    } catch (error) {
      console.error('Error starting speech interview:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const playQuestionAudio = () => {
    // Audio feature coming soon - for now just focus on the question text
    console.log('Audio playback will be available with AWS Polly integration');
  };
  
  // Audio playback is manual - user clicks to play

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];
      
      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };
      
      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        await transcribeAudio(audioBlob);
      };
      
      mediaRecorderRef.current.start();
      setIsRecording(true);
      setResponseStartTime(Date.now());
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Microphone access denied. Please use text input.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      // Stop all tracks to release microphone
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  const transcribeAudio = async (audioBlob) => {
    try {
      const formData = new FormData();
      formData.append('file', audioBlob, 'recording.wav');
      formData.append('session_id', sessionId);
      
      // Show processing message
      setAnswer('🔄 Processing your audio...');
      
      const response = await fetch(`${BACKEND_URL}/speech-interview/transcribe`, {
        method: 'POST',
        body: formData
      });
      
      if (response.ok) {
        const data = await response.json();
        setAnswer(data.transcription);
        
        // Log audio info for debugging
        console.log('Audio processed:', data);
      } else {
        setAnswer('❌ Upload failed. Please type your answer below.');
      }
    } catch (error) {
      console.error('Error transcribing audio:', error);
      setAnswer('❌ Network error. Please type your answer below.');
    }
  };

  const submitAnswer = async () => {
    if (!answer.trim()) return;
    
    const responseTime = responseStartTime ? (Date.now() - responseStartTime) / 1000 : 0;
    
    setIsLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/speech-interview/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          question_id: currentQuestion.id,
          answer: answer,
          response_time: responseTime
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setAnalysis(data.analysis);
        setSessionProgress(data.session_progress);
        setShowAnalysis(true);
        
        // Prepare next question
        if (!data.is_complete) {
          setTimeout(() => {
            setCurrentQuestion(data.next_question);
            setCurrentAudio(data.next_audio);
            setAnswer('');
            setAnalysis(null);
            setShowAnalysis(false);
            setResponseStartTime(null);
          }, 4000); // Show analysis for 4 seconds
        } else {
          // Interview complete
          setTimeout(() => {
            alert(`Interview Complete! Final Average Score: ${data.session_progress.average_score.toFixed(1)}/10`);
            navigate('/');
          }, 3000);
        }
      } else {
        throw new Error('Failed to analyze answer');
      }
    } catch (error) {
      console.error('Error analyzing answer:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getScoreColor = (score) => {
    if (score >= 8) return 'text-green-600 bg-green-100';
    if (score >= 6) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  if (isLoading && !currentQuestion) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <Brain className="h-12 w-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-lg text-gray-600">Initializing AI Speech Interview...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-6xl mx-auto">
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
            <h1 className="text-2xl font-bold text-gray-900">AI Speech Interview</h1>
            <p className="text-gray-600">Question {sessionProgress.completed + 1} of {sessionProgress.total}</p>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-600">Average Score</div>
            <div className={`text-2xl font-bold ${getScoreColor(sessionProgress.average_score)}`}>
              {sessionProgress.average_score.toFixed(1)}
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div 
              className="bg-blue-600 h-3 rounded-full transition-all duration-300"
              style={{ width: `${(sessionProgress.completed / sessionProgress.total) * 100}%` }}
            ></div>
          </div>
        </div>

        {/* Welcome Message */}
        {currentQuestion && sessionProgress.completed === 0 && !showAnalysis && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-8">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 rounded-full">
                <Brain className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-blue-900">Welcome to Your AI Interview!</h3>
                <p className="text-blue-700">Read the questions below and record your answers or type them directly. Let's begin!</p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Question Panel */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-lg p-6">
            {currentQuestion && (
              <>
                <div className="flex items-center justify-between mb-4">
                  <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                    currentQuestion.type === 'technical' ? 'bg-blue-100 text-blue-800' :
                    currentQuestion.type === 'behavioral' ? 'bg-green-100 text-green-800' :
                    currentQuestion.type === 'situational' ? 'bg-purple-100 text-purple-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {currentQuestion.type} • {currentQuestion.category_weight || '25%'}
                  </span>
                  
                  <div className="flex items-center space-x-2">
                    {isPlayingQuestion && (
                      <span className="text-sm text-blue-600 animate-pulse">
                        🔊 Playing...
                      </span>
                    )}
                    <button
                      onClick={playQuestionAudio}
                      className="flex items-center px-3 py-2 rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed"
                      disabled={true}
                    >
                      <Volume2 className="h-4 w-4 mr-2" />
                      Audio Coming Soon
                    </button>
                  </div>
                </div>
                
                <h2 className="text-xl font-semibold text-gray-900 mb-6">
                  {currentQuestion.question}
                </h2>

                {/* Audio Player */}
                <audio 
                  ref={audioRef}
                  onEnded={() => setIsPlayingQuestion(false)}
                  className="hidden"
                />

                {/* Answer Input */}
                <div className="space-y-4">
                  <div className="space-y-4">
                    <div className="flex items-center space-x-4">
                      <button
                        onClick={isRecording ? stopRecording : startRecording}
                        className={`flex items-center px-6 py-3 rounded-lg font-medium transition-all ${
                          isRecording 
                            ? 'bg-red-600 text-white animate-pulse shadow-lg' 
                            : 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-lg'
                        }`}
                        disabled={showAnalysis}
                      >
                        {isRecording ? <MicOff className="h-5 w-5 mr-2" /> : <Mic className="h-5 w-5 mr-2" />}
                        {isRecording ? '🔴 Stop Recording' : '🎤 Start Recording'}
                      </button>
                      
                      {isRecording && (
                        <div className="flex items-center text-red-600 animate-pulse">
                          <div className="w-3 h-3 bg-red-600 rounded-full mr-2 animate-ping"></div>
                          <span className="font-medium">Recording in progress...</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg">
                      📝 <strong>Instructions:</strong> Click "Start Recording" → speak your answer clearly → click "Stop Recording" → edit the text below if needed → submit your answer
                    </div>
                  </div>
                  
                  <textarea
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    placeholder="Your answer will appear here when you speak, or you can type directly..."
                    className="w-full h-32 p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    disabled={showAnalysis || isRecording}
                  />
                  
                  <button
                    onClick={submitAnswer}
                    disabled={!answer.trim() || isLoading || showAnalysis}
                    className="w-full py-3 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
                  >
                    {isLoading ? 'Analyzing Response...' : 'Submit Answer'}
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Analysis Panel */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            {showAnalysis && analysis ? (
              <div className="space-y-6">
                {/* Overall Score */}
                <div className="text-center">
                  <div className={`inline-flex items-center justify-center w-20 h-20 rounded-full text-3xl font-bold ${getScoreColor(analysis.overall_score)}`}>
                    {analysis.overall_score}
                  </div>
                  <p className="text-sm text-gray-600 mt-2">Overall Score</p>
                </div>

                {/* Detailed Scores */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Technical Accuracy</span>
                    <span className={`px-2 py-1 rounded text-sm ${getScoreColor(analysis.technical_accuracy.score)}`}>
                      {analysis.technical_accuracy.score}/10
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Communication</span>
                    <span className={`px-2 py-1 rounded text-sm ${getScoreColor(analysis.communication_skills.score)}`}>
                      {analysis.communication_skills.score}/10
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Confidence</span>
                    <span className={`px-2 py-1 rounded text-sm ${
                      analysis.confidence_assessment.level === 'high' ? 'bg-green-100 text-green-600' :
                      analysis.confidence_assessment.level === 'moderate' ? 'bg-yellow-100 text-yellow-600' :
                      'bg-red-100 text-red-600'
                    }`}>
                      {analysis.confidence_assessment.level}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Job Relevance</span>
                    <span className={`px-2 py-1 rounded text-sm ${getScoreColor(analysis.job_relevance.score)}`}>
                      {analysis.job_relevance.score}/10
                    </span>
                  </div>
                </div>

                {/* Strengths */}
                <div>
                  <h3 className="font-semibold text-green-600 mb-2 flex items-center">
                    <TrendingUp className="h-4 w-4 mr-1" />
                    Strengths
                  </h3>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    {analysis.strengths.map((strength, index) => (
                      <li key={index} className="text-gray-700">{strength}</li>
                    ))}
                  </ul>
                </div>

                {/* Improvements */}
                <div>
                  <h3 className="font-semibold text-orange-600 mb-2">Areas for Improvement</h3>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    {analysis.improvements.map((improvement, index) => (
                      <li key={index} className="text-gray-700">{improvement}</li>
                    ))}
                  </ul>
                </div>

                {/* Time Assessment */}
                {analysis.time_awareness && (
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600">
                      Response Time: {analysis.time_awareness.actual_assessment}
                    </p>
                    <p className="text-xs text-gray-500">
                      Ideal: {analysis.time_awareness.ideal_range}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center text-gray-500 py-12">
                <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Submit your answer to see comprehensive AI analysis</p>
                <div className="mt-4 text-xs text-gray-400">
                  <p>• Technical accuracy evaluation</p>
                  <p>• Communication skills assessment</p>
                  <p>• Confidence level analysis</p>
                  <p>• Job relevance scoring</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SpeechInterviewPage;