import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Mic, MicOff, Send, ArrowLeft, Brain, Volume2, VolumeX, Play, Pause, RotateCcw, Sparkles, Trophy, Target, Clock, Zap, Star } from 'lucide-react';
import AIAvatar from '../components/AIAvatar';

const InterviewPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { sessionId, interviewMode, selectedAvatar: avatarFromState } = location.state || {};
  
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [accumulatedText, setAccumulatedText] = useState('');
  const [showCelebration, setShowCelebration] = useState(false);
  const [typingAnimation, setTypingAnimation] = useState(false);
  const [showHints, setShowHints] = useState(false);
  const [answerStartTime, setAnswerStartTime] = useState(null);
  const [responseTime, setResponseTime] = useState(0);
  const [showFloatingElements, setShowFloatingElements] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState(avatarFromState || 'professional');
  const [playedQuestions, setPlayedQuestions] = useState(new Set());
  const [allAnalyses, setAllAnalyses] = useState([]);
  const [posturePhotos, setPosturePhotos] = useState([]);
  const [cameraStream, setCameraStream] = useState(null);
  const [postureAnalysis, setPostureAnalysis] = useState(null);
  const [cameraStatus, setCameraStatus] = useState('initializing');
  const [photoCount, setPhotoCount] = useState(0);
  const [lastPhotoTime, setLastPhotoTime] = useState(null);

  const audioRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const recognitionRef = useRef(null);
  const speechRef = useRef(null);
  const isPlayingRef = useRef(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const postureIntervalRef = useRef(null);

  const BACKEND_URL = 'http://localhost:8000';

  useEffect(() => {
    if (!sessionId || interviewMode !== 'mock') {
      navigate('/');
      return;
    }
    startInterviewImmediately();
    // Only setup camera for professional interviews
    if (interviewMode === 'professional') {
      setupCamera();
    }
  }, [sessionId, interviewMode]);
  
  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
      if (postureIntervalRef.current) {
        clearInterval(postureIntervalRef.current);
      }
    };
  }, [cameraStream]);
  
  // Auto-play first question when questions load
  useEffect(() => {
    if (questions.length > 0 && currentQuestionIndex === 0 && !isPlayingRef.current) {
      stopAudio();
      setTimeout(() => {
        if (!isPlayingAudio && !isPlayingRef.current) {
          playQuestionAudio();
        }
      }, 1000);
    }
  }, [questions]);
  
  // Reset answer start time when question changes
  useEffect(() => {
    setAnswerStartTime(null);
    setResponseTime(0);
  }, [currentQuestionIndex]);

  const setupCamera = async () => {
    try {
      setCameraStatus('requesting');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 640, height: 480 } 
      });
      setCameraStream(stream);
      setCameraStatus('active');
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          setCameraStatus('ready');
        };
      }
      
      // Start capturing photos every 30 seconds
      postureIntervalRef.current = setInterval(capturePosturePhoto, 30000);
      console.log('✅ Posture monitoring started - photos every 30 seconds');
    } catch (error) {
      console.error('❌ Camera access denied:', error);
      setCameraStatus('denied');
    }
  };

  const capturePosturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) {
      console.warn('⚠️ Video or canvas not ready for photo capture');
      return;
    }
    
    const canvas = canvasRef.current;
    const video = videoRef.current;
    const ctx = canvas.getContext('2d');
    
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      console.warn('⚠️ Video not ready, skipping photo capture');
      return;
    }
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    
    const currentTime = new Date().toLocaleTimeString();
    console.log(`📸 Capturing posture photo at ${currentTime}`);
    
    canvas.toBlob(async (blob) => {
      if (blob) {
        const timestamp = Date.now();
        const filename = `posture_${sessionId}_${timestamp}.jpg`;
        
        try {
          // Upload to S3
          const formData = new FormData();
          formData.append('file', blob, filename);
          formData.append('session_id', sessionId);
          formData.append('type', 'posture');
          
          console.log(`⬆️ Uploading photo: ${filename}`);
          const response = await fetch(`${BACKEND_URL}/upload-posture-photo`, {
            method: 'POST',
            body: formData
          });
          
          if (response.ok) {
            const result = await response.json();
            setPosturePhotos(prev => [...prev, {
              filename,
              s3_url: result.s3_url,
              timestamp
            }]);
            setPhotoCount(prev => prev + 1);
            setLastPhotoTime(currentTime);
            console.log(`✅ Photo uploaded successfully: ${result.s3_url}`);
          } else {
            console.error('❌ Failed to upload photo:', response.statusText);
          }
        } catch (error) {
          console.error('❌ Failed to upload posture photo:', error);
        }
      }
    }, 'image/jpeg', 0.8);
  };

  const startInterviewImmediately = async () => {
    // Start with the predefined first question immediately
    const firstQuestion = {
      id: 1, 
      question: "Hello! Welcome to the AI interview. I'm excited to get to know you better today. Could you please introduce yourself and tell me a bit about your background?", 
      type: "introduction", 
      is_scored: false
    };
    
    setQuestions([firstQuestion]);
    setIsLoading(false);
    
    // Generate remaining questions in background
    generateRemainingQuestions();
  };

  const generateRemainingQuestions = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/generate-questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId })
      });
      
      if (response.ok) {
        const data = await response.json();
        // Update questions with the complete list from backend
        setQuestions(data.questions);
      } else {
        throw new Error('Failed to generate questions');
      }
    } catch (error) {
      console.error('Error generating questions:', error);
      // Keep the first question and add fallback questions
      setQuestions([
        {id: 1, question: "Hello! Welcome to the AI interview. I'm excited to get to know you better today. Could you please introduce yourself and tell me a bit about your background?", type: "introduction", is_scored: false},
        {id: 2, question: "Could you walk me through a project you've worked on that you're particularly proud of?", type: "technical", is_scored: true},
        {id: 3, question: "How do you typically approach difficult situations or tight deadlines?", type: "behavioral", is_scored: true},
        {id: 4, question: "Tell me about a time when you had to learn a new technology quickly.", type: "behavioral", is_scored: true},
        {id: 5, question: "What interests you most about this role and our company?", type: "general", is_scored: true}
      ]);
    }
  };

  const analyzeAnswerWithAI = async (answerText, questionId) => {
    const startTime = Date.now();
    
    try {
      // Much shorter timeout for faster response
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      const response = await Promise.race([
        fetch(`${BACKEND_URL}/analyze-answer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: sessionId,
            question_id: questionId,
            answer: answerText
          }),
          signal: controller.signal
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), 3000)
        )
      ]);
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const analysis = await response.json();
        const processingTime = (Date.now() - startTime) / 1000;
        console.log(`✅ Analysis completed in ${processingTime.toFixed(2)}s`);
        return analysis;
      } else {
        throw new Error(`Analysis failed: ${response.status}`);
      }
    } catch (error) {
      const processingTime = (Date.now() - startTime) / 1000;
      console.warn(`⚠️ Using fast fallback after ${processingTime.toFixed(2)}s:`, error.message);
      
      // Instant fallback analysis
      return generateInstantFeedback(answerText);
    }
  };

  const generateInstantFeedback = (answerText) => {
    const words = answerText.split();
    const wordCount = words.length;
    const answerLower = answerText.toLowerCase();
    
    // Quick scoring
    let score = 6; // Base score
    if (wordCount > 30) score += 1;
    if (wordCount > 50) score += 1;
    if (answerLower.includes('experience') || answerLower.includes('project')) score += 1;
    
    // Quick feedback
    const strengths = [];
    const improvements = [];
    
    if (wordCount > 25) strengths.push('Detailed response');
    if (answerLower.includes('team') || answerLower.includes('project')) strengths.push('Relevant examples');
    if (!strengths.length) strengths.push('Engaged with question');
    
    if (wordCount < 20) improvements.push('Add more detail');
    if (!answerLower.includes('example')) improvements.push('Include specific examples');
    if (!improvements.length) improvements.push('Keep practicing');
    
    return {
      score: Math.min(9, Math.max(4, score)),
      strengths: strengths.slice(0, 2),
      improvements: improvements.slice(0, 2)
    };
  };

  const submitAnswer = () => {
    if (!answer.trim()) return;
    
    setIsLoading(true);
    
    // Calculate response time
    if (answerStartTime) {
      const time = (Date.now() - answerStartTime) / 1000;
      setResponseTime(time);
    }
    
    // Get AI analysis from backend
    const getAnalysis = async () => {
      const currentQuestion = questions[currentQuestionIndex];
      const analysis = await analyzeAnswerWithAI(answer, currentQuestion?.id || currentQuestionIndex + 1);
      
      setAnalysis(analysis);
      setShowAnalysis(true);
      setIsLoading(false);
      
      // Store analysis for final summary
      storeAnalysis(currentQuestion?.id || currentQuestionIndex + 1, answer, analysis);
      
      // Show celebration for good scores
      if (analysis.score >= 7) {
        setShowCelebration(true);
        setTimeout(() => setShowCelebration(false), 3000);
      }
      
      // Trigger floating elements
      setShowFloatingElements(true);
      setTimeout(() => setShowFloatingElements(false), 2000);
    };
    
    getAnalysis();
  };

  const generateFinalSummary = async () => {
    setIsLoading(true);
    
    // Stop posture monitoring
    if (postureIntervalRef.current) {
      clearInterval(postureIntervalRef.current);
    }
    
    try {
      // Analyze posture photos if available
      let postureAnalysisResult = null;
      if (posturePhotos.length > 0) {
        try {
          const response = await fetch(`${BACKEND_URL}/analyze-posture`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              session_id: sessionId,
              photo_urls: posturePhotos.map(p => p.s3_url)
            })
          });
          
          if (response.ok) {
            postureAnalysisResult = await response.json();
            setPostureAnalysis(postureAnalysisResult);
          }
        } catch (error) {
          console.error('Posture analysis failed:', error);
        }
      }
      
      // Generate local summary from stored analyses
      const scoredAnalyses = allAnalyses.filter(a => a.analysis && a.analysis.score !== undefined);
      const totalQuestions = questions.filter(q => q.is_scored !== false).length || 4; // Default to 4 if no questions loaded
      const answeredQuestions = scoredAnalyses.length;
      
      console.log('Summary data:', { scoredAnalyses, totalQuestions, answeredQuestions });
      
      let summaryData;
      
      // Check if no questions were answered
      if (answeredQuestions === 0) {
        summaryData = {
          overall_score: 0,
          total_questions: totalQuestions,
          answered_questions: 0,
          technical_strengths: [],
          soft_skill_strengths: [],
          technical_improvements: ['Complete the interview to get personalized feedback'],
          soft_skill_improvements: ['Answer questions to receive detailed analysis'],
          posture_analysis: postureAnalysisResult,
          session_id: sessionId || 'unknown',
          status: 'no_questions_answered',
          message: 'No Questions Answered'
        };
      }
      // Check if interview was stopped in the middle
      else if (answeredQuestions < totalQuestions) {
        const totalScore = scoredAnalyses.reduce((sum, a) => sum + a.analysis.score, 0);
        const averageScore = (totalScore / answeredQuestions).toFixed(1);
        
        // Collect all strengths and improvements
        const allStrengths = [];
        const allImprovements = [];
        
        scoredAnalyses.forEach(a => {
          if (a.analysis.strengths) allStrengths.push(...a.analysis.strengths);
          if (a.analysis.improvements) allImprovements.push(...a.analysis.improvements);
        });
        
        // Categorize skills
        const technicalStrengths = allStrengths.filter(s => 
          s.toLowerCase().includes('technical') || s.toLowerCase().includes('programming') || 
          s.toLowerCase().includes('code') || s.toLowerCase().includes('development')
        );
        
        const softSkillStrengths = allStrengths.filter(s => 
          s.toLowerCase().includes('communication') || s.toLowerCase().includes('confidence') || 
          s.toLowerCase().includes('delivery') || s.toLowerCase().includes('clear')
        );
        
        const technicalImprovements = allImprovements.filter(i => 
          i.toLowerCase().includes('technical') || i.toLowerCase().includes('programming') || 
          i.toLowerCase().includes('code') || i.toLowerCase().includes('examples')
        );
        
        const softSkillImprovements = allImprovements.filter(i => 
          i.toLowerCase().includes('confidence') || i.toLowerCase().includes('communication') || 
          i.toLowerCase().includes('delivery') || i.toLowerCase().includes('filler')
        );
        
        summaryData = {
          overall_score: parseFloat(averageScore),
          total_questions: totalQuestions,
          answered_questions: answeredQuestions,
          technical_strengths: technicalStrengths.slice(0, 3),
          soft_skill_strengths: softSkillStrengths.slice(0, 3),
          technical_improvements: technicalImprovements.slice(0, 3),
          soft_skill_improvements: softSkillImprovements.slice(0, 3),
          posture_analysis: postureAnalysisResult,
          session_id: sessionId,
          status: 'incomplete',
          message: 'Interview Stopped Early'
        };
      }
      // Complete interview
      else {
        const totalScore = scoredAnalyses.reduce((sum, a) => sum + a.analysis.score, 0);
        const averageScore = (totalScore / answeredQuestions).toFixed(1);
        
        // Collect all strengths and improvements
        const allStrengths = [];
        const allImprovements = [];
        
        scoredAnalyses.forEach(a => {
          if (a.analysis.strengths) allStrengths.push(...a.analysis.strengths);
          if (a.analysis.improvements) allImprovements.push(...a.analysis.improvements);
        });
        
        // Categorize skills
        const technicalStrengths = allStrengths.filter(s => 
          s.toLowerCase().includes('technical') || s.toLowerCase().includes('programming') || 
          s.toLowerCase().includes('code') || s.toLowerCase().includes('development')
        );
        
        const softSkillStrengths = allStrengths.filter(s => 
          s.toLowerCase().includes('communication') || s.toLowerCase().includes('confidence') || 
          s.toLowerCase().includes('delivery') || s.toLowerCase().includes('clear')
        );
        
        const technicalImprovements = allImprovements.filter(i => 
          i.toLowerCase().includes('technical') || i.toLowerCase().includes('programming') || 
          i.toLowerCase().includes('code') || i.toLowerCase().includes('examples')
        );
        
        const softSkillImprovements = allImprovements.filter(i => 
          i.toLowerCase().includes('confidence') || i.toLowerCase().includes('communication') || 
          i.toLowerCase().includes('delivery') || i.toLowerCase().includes('filler')
        );
        
        summaryData = {
          overall_score: parseFloat(averageScore),
          total_questions: totalQuestions,
          answered_questions: answeredQuestions,
          technical_strengths: technicalStrengths.slice(0, 3),
          soft_skill_strengths: softSkillStrengths.slice(0, 3),
          technical_improvements: technicalImprovements.slice(0, 3),
          soft_skill_improvements: softSkillImprovements.slice(0, 3),
          posture_analysis: postureAnalysisResult,
          session_id: sessionId,
          status: 'complete',
          message: 'Interview Complete'
        };
      }
      
      // Navigate to report page with summary data
      navigate('/interview-report', { state: summaryData });
      
    } catch (error) {
      console.error('Failed to generate summary:', error);
    } finally {
      setIsLoading(false);
    }
  };



  // Store analysis for final summary
  const storeAnalysis = (questionId, answer, analysis) => {
    setAllAnalyses(prev => {
      const updated = prev.filter(a => a.question_id !== questionId);
      return [...updated, { question_id: questionId, answer, analysis }];
    });
  };

  const nextQuestion = async () => {
    if (currentQuestionIndex < questions.length - 1) {
      stopAudio();
      clearSilenceTimer();
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setAnswer('');
      setAccumulatedText('');
      setAnalysis(null);
      setShowAnalysis(false);
      
      // Auto-play next question after a short delay
      setTimeout(() => {
        if (!isPlayingAudio && !isPlayingRef.current) {
          playQuestionAudio();
        }
      }, 500);
    } else {
      // Check if more questions are available from backend
      await checkForMoreQuestions();
      if (currentQuestionIndex < questions.length - 1) {
        nextQuestion();
      }
    }
  };

  const checkForMoreQuestions = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/questions/${sessionId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.questions.length > questions.length) {
          setQuestions(data.questions);
        }
      }
    } catch (error) {
      console.error('Error checking for more questions:', error);
    }
  };

  const startRecording = async () => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      startBrowserSpeechRecognition();
    } else {
      startAudioRecording();
    }
  };

  const startBrowserSpeechRecognition = () => {
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
      startSilenceTimer();
      if (!answerStartTime) {
        setAnswerStartTime(Date.now());
      }
    };
    
    recognition.onresult = (event) => {
      let finalTranscript = '';
      let interimTranscript = '';
      
      // Reset silence timer when speech is detected
      resetSilenceTimer();
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }
      
      // Accumulate final text, show interim text
      if (finalTranscript) {
        setAccumulatedText(prev => prev + finalTranscript);
      }
      
      const currentAccumulated = accumulatedText + finalTranscript;
      setAnswer(currentAccumulated + interimTranscript);
      
      // Start silence timer after speech ends
      if (finalTranscript) {
        startSilenceTimer();
      }
    };
    
    recognition.onspeechend = () => {
      startSilenceTimer();
    };
    
    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      clearSilenceTimer();
      
      if (event.error === 'no-speech') {
        // Keep accumulated text for no-speech error
        if (!accumulatedText) {
          setAnswer('');
        }
      } else if (event.error === 'not-allowed') {
        setAnswer('');
        setIsRecording(false);
      } else {
        setAnswer('');
        setTimeout(() => startAudioRecording(), 1000);
        setIsRecording(false);
      }
    };
    
    recognition.onend = () => {
      clearSilenceTimer();
      if (isRecording) {
        // Restart recognition if still recording (unless manually stopped)
        setTimeout(() => {
          if (isRecording && recognitionRef.current) {
            try {
              recognition.start();
            } catch (error) {
              console.log('Recognition restart failed:', error);
            }
          }
        }, 100);
      }
    };
    
    recognition.start();
    setMediaRecorder({ stop: () => {
      clearSilenceTimer();
      recognition.stop();
    }});
  };
  
  const startSilenceTimer = () => {
    clearSilenceTimer();
    silenceTimerRef.current = setTimeout(() => {
      console.log('15 seconds of silence, stopping recording');
      stopRecording();
    }, 15000); // 15 seconds
  };
  
  const resetSilenceTimer = () => {
    clearSilenceTimer();
    startSilenceTimer();
  };
  
  const clearSilenceTimer = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  };

  const startAudioRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      const chunks = [];
      
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };
      
      recorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        await transcribeAudio(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };
      
      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      setAnswer('🎤 Recording audio... Speak now!');
      
    } catch (error) {
      console.error('Error accessing microphone:', error);
      setAnswer('');
    }
  };
  
  const stopRecording = () => {
    clearSilenceTimer();
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
      setMediaRecorder(null);
      recognitionRef.current = null;
      
      // Keep accumulated text in the answer field
      if (accumulatedText) {
        setAnswer(accumulatedText);
      }
    }
  };

  useEffect(() => {
    checkMicrophonePermission();
    
    // Cleanup on unmount
    return () => {
      clearSilenceTimer();
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);
  
  // Update accumulated text when it changes
  useEffect(() => {
    if (accumulatedText && !isRecording) {
      setAnswer(accumulatedText);
    }
  }, [accumulatedText, isRecording]);

  const checkMicrophonePermission = async () => {
    try {
      if (navigator.permissions) {
        const permission = await navigator.permissions.query({ name: 'microphone' });
        console.log('Microphone permission:', permission.state);
      }
    } catch (error) {
      console.log('Permission API not supported');
    }
  };
  
  const transcribeAudio = async (audioBlob) => {
    setIsTranscribing(true);
    setAnswer('🎤 Processing your speech...');
    
    try {
      const formData = new FormData();
      formData.append('file', audioBlob, 'recording.webm');
      formData.append('session_id', sessionId);
      
      const response = await fetch(`${BACKEND_URL}/transcribe-audio`, {
        method: 'POST',
        body: formData
      });
      
      if (response.ok) {
        const result = await response.json();
        
        if (result.status === 'success') {
          setAnswer(result.transcription);
        } else {
          setAnswer('');
        }
      } else {
        setAnswer('');
      }
      
    } catch (error) {
      console.error('Transcription error:', error);
      setAnswer('');
    } finally {
      setIsTranscribing(false);
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

  const playQuestionAudio = async () => {
    const currentQuestion = questions[currentQuestionIndex];
    if (!currentQuestion) return;
    
    const questionKey = `${currentQuestionIndex}-${currentQuestion.id}`;
    
    // Check if this question has already been played
    if (playedQuestions.has(questionKey)) {
      return; // Don't play if already played
    }
    
    // Stop any currently playing audio first
    stopAudio();
    
    try {
      setIsPlayingAudio(true);
      
      // Mark this question as played using index + id
      setPlayedQuestions(prev => new Set([...prev, questionKey]));
      
      // Use browser TTS with the EXACT question text displayed
      const questionTextToSpeak = currentQuestion.question;
      console.log('Playing audio for question:', questionTextToSpeak);
      await playTextToSpeech(questionTextToSpeak);
    } catch (error) {
      console.error('Error playing audio:', error);
      setIsPlayingAudio(false);
    }
  };
  
  const playTextToSpeech = async (text) => {
    return new Promise((resolve, reject) => {
      if ('speechSynthesis' in window && !isPlayingRef.current) {
        // Cancel any existing speech
        speechSynthesis.cancel();
        
        // Small delay to ensure cancellation is processed
        setTimeout(() => {
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.rate = 0.9;
          utterance.pitch = 1.0;
          utterance.volume = 0.9;
          
          const voices = speechSynthesis.getVoices();
          const femaleVoice = voices.find(voice => 
            (voice.name.includes('Samantha') || 
             voice.name.includes('Karen') || 
             voice.name.includes('Victoria') ||
             voice.name.includes('Tessa') ||
             voice.name.includes('Fiona')) && voice.lang.includes('en')
          ) || voices.find(voice => voice.lang.includes('en') && voice.name.toLowerCase().includes('female'));
          
          if (femaleVoice) {
            utterance.voice = femaleVoice;
          }
          
          speechRef.current = utterance;
          isPlayingRef.current = true;
          
          utterance.onstart = () => {
            isPlayingRef.current = true;
            setIsPlayingAudio(true);
          };
          
          utterance.onend = () => {
            setIsPlayingAudio(false);
            isPlayingRef.current = false;
            speechRef.current = null;
            resolve();
          };
          
          utterance.onerror = (error) => {
            setIsPlayingAudio(false);
            isPlayingRef.current = false;
            speechRef.current = null;
            reject(error);
          };
          
          speechSynthesis.speak(utterance);
        }, 100);
      } else {
        setIsPlayingAudio(false);
        reject(new Error('Speech synthesis not supported or already playing'));
      }
    });
  };

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if ('speechSynthesis' in window) {
      speechSynthesis.cancel();
    }
    isPlayingRef.current = false;
    speechRef.current = null;
    setIsPlayingAudio(false);
  };

  if (isLoading && questions.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="p-4 bg-blue-100 rounded-full mb-4 mx-auto w-fit">
            <Brain className="h-12 w-12 text-blue-600 animate-pulse" />
          </div>
          <p className="text-gray-600">Starting your interview...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 relative overflow-hidden">
      {/* Floating Background Elements */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className={`absolute w-3 h-3 bg-gradient-to-r from-blue-400 to-purple-500 rounded-full opacity-30 animate-pulse ${
              showFloatingElements ? 'animate-ping' : ''
            }`}
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${i * 0.3}s`,
              animationDuration: `${2 + Math.random() * 3}s`
            }}
          />
        ))}
      </div>
      
      {/* Celebration Confetti */}
      {showCelebration && (
        <div className="fixed inset-0 pointer-events-none z-50">
          {[...Array(30)].map((_, i) => {
            const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8'];
            const shapes = ['🎉', '⭐', '✨', '🎊', '💫'];
            const isEmoji = Math.random() > 0.6;
            
            return (
              <div
                key={i}
                className={`absolute ${isEmoji ? 'text-2xl' : 'w-4 h-4 rounded-full'} animate-bounce`}
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  backgroundColor: isEmoji ? 'transparent' : colors[Math.floor(Math.random() * colors.length)],
                  animationDelay: `${Math.random() * 2}s`,
                  animationDuration: `${1 + Math.random() * 2}s`,
                  transform: `rotate(${Math.random() * 360}deg)`
                }}
              >
                {isEmoji ? shapes[Math.floor(Math.random() * shapes.length)] : ''}
              </div>
            );
          })}
        </div>
      )}
      
      <div className="max-w-4xl mx-auto relative z-10">
        <div className="flex justify-between items-center mb-6">
          <button
            onClick={() => navigate('/mode-selection', { state: { sessionId } })}
            className="flex items-center text-gray-600 hover:text-gray-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back to Mode Selection
          </button>
          
          {/* Posture Monitoring Status - Only for Professional Interviews */}
          {interviewMode === 'professional' && (
            <div className="flex items-center space-x-4">
              <div className="flex items-center px-3 py-1 rounded-full text-sm font-medium">
                <div className={`w-2 h-2 rounded-full mr-2 ${
                  cameraStatus === 'ready' ? 'bg-green-400 animate-pulse' :
                  cameraStatus === 'active' ? 'bg-yellow-400 animate-pulse' :
                  cameraStatus === 'denied' ? 'bg-red-400' :
                  'bg-gray-400'
                }`}></div>
                <span className="text-gray-600">
                  📷 {cameraStatus === 'ready' ? 'Monitoring' : 
                       cameraStatus === 'active' ? 'Starting' :
                       cameraStatus === 'denied' ? 'Camera Denied' :
                       'Initializing'}
                </span>
              </div>
              
              {photoCount > 0 && (
                <div className="flex items-center px-3 py-1 bg-green-50 rounded-full text-sm font-medium text-green-700">
                  📸 {photoCount} photos
                  {lastPhotoTime && (
                    <span className="ml-2 text-xs text-green-600">Last: {lastPhotoTime}</span>
                  )}
                </div>
              )}
              
              {/* Test button for manual photo capture */}
              {process.env.NODE_ENV === 'development' && cameraStatus === 'ready' && (
                <button
                  onClick={capturePosturePhoto}
                  className="px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-full text-sm font-medium transition-colors"
                  title="Test photo capture"
                >
                  📷 Test
                </button>
              )}
            </div>
          )}
          
          <button
            onClick={generateFinalSummary}
            className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-6 py-2 rounded-lg shadow hover:from-indigo-600 hover:to-purple-700 transition-all duration-300 transform hover:scale-105 font-medium flex items-center"
          >
            <Trophy className="w-4 h-4 mr-2" />
            Finish Interview
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-8">
          {questions.length > 0 && (
            <>
              <div className="mb-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold text-gray-800">
                    {(() => {
                      const currentQuestion = questions[currentQuestionIndex];
                      if (currentQuestion?.is_scored === false) {
                        return "Introduction";
                      }
                      const scoredQuestionNumber = questions.slice(0, currentQuestionIndex + 1).filter(q => q.is_scored !== false).length;
                      const totalScoredQuestions = 4; // 4 scored questions + 1 introduction = 5 total
                      return `Question ${scoredQuestionNumber} of ${totalScoredQuestions}`;
                    })()} 
                  </h2>
                </div>
                
                <div className="relative w-full bg-gray-200 rounded-full h-3 mb-6 overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-500 ease-out relative"
                    style={{ 
                      width: questions[currentQuestionIndex]?.is_scored === false ? 
                        '0%' : 
                        `${(questions.slice(0, currentQuestionIndex + 1).filter(q => q.is_scored !== false).length / questions.filter(q => q.is_scored !== false).length) * 100}%`
                    }}
                  >
                    <div className="absolute inset-0 bg-white opacity-30 animate-pulse"></div>
                  </div>
                  {/* Progress indicators */}
                  <div className="absolute top-0 left-0 w-full h-full flex items-center">
                    {questions.filter(q => q.is_scored !== false).map((_, index) => (
                      <div
                        key={index}
                        className={`w-3 h-3 rounded-full border-2 border-white transition-all duration-300 ${
                          index < questions.slice(0, currentQuestionIndex + 1).filter(q => q.is_scored !== false).length
                            ? 'bg-blue-600 scale-110'
                            : 'bg-gray-300'
                        }`}
                        style={{ marginLeft: index === 0 ? '0' : `${100 / questions.filter(q => q.is_scored !== false).length - 3}%` }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="mb-8">
                {/* AI Interviewer Avatar */}
                <div className="flex items-start gap-6 mb-6">
                  <AIAvatar 
                    type={selectedAvatar}
                    isAnimated={isPlayingAudio}
                    size="large"
                  />
                  
                  <div className="flex-1">
                    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 relative">
                      {/* Speech bubble tail */}
                      <div className="absolute left-0 top-4 w-0 h-0 border-t-8 border-t-transparent border-b-8 border-b-transparent border-r-8 border-r-white transform -translate-x-2"></div>
                      
                      <div className="flex justify-between items-start">
                        <p className="text-lg text-gray-800 leading-relaxed flex-1 pr-4">
                          {questions[currentQuestionIndex]?.question}
                        </p>
                        <button
                          onClick={isPlayingAudio ? stopAudio : playQuestionAudio}
                          disabled={playedQuestions.has(`${currentQuestionIndex}-${questions[currentQuestionIndex]?.id}`)}
                          className={`p-2 rounded-full transition-colors flex-shrink-0 ${
                            playedQuestions.has(`${currentQuestionIndex}-${questions[currentQuestionIndex]?.id}`)
                              ? 'bg-gray-100 cursor-not-allowed'
                              : 'bg-blue-100 hover:bg-blue-200'
                          }`}
                        >
                          {isPlayingAudio ? (
                            <VolumeX className="w-5 h-5 text-blue-600" />
                          ) : playedQuestions.has(`${currentQuestionIndex}-${questions[currentQuestionIndex]?.id}`) ? (
                            <Volume2 className="w-5 h-5 text-gray-400" />
                          ) : (
                            <Volume2 className="w-5 h-5 text-blue-600" />
                          )}
                        </button>
                      </div>
                      
                      {isPlayingAudio && (
                        <div className="mt-3 flex items-center gap-2">
                          <div className="flex gap-1">
                            <div className="w-1 h-4 bg-blue-400 rounded animate-pulse" style={{animationDelay: '0ms'}}></div>
                            <div className="w-1 h-6 bg-blue-500 rounded animate-pulse" style={{animationDelay: '150ms'}}></div>
                            <div className="w-1 h-3 bg-blue-400 rounded animate-pulse" style={{animationDelay: '300ms'}}></div>
                            <div className="w-1 h-5 bg-blue-500 rounded animate-pulse" style={{animationDelay: '450ms'}}></div>
                            <div className="w-1 h-4 bg-blue-400 rounded animate-pulse" style={{animationDelay: '600ms'}}></div>
                          </div>
                          <span className="text-sm text-blue-600 font-medium">Speaking...</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="relative group">
                    <textarea
                      value={answer}
                      onChange={(e) => {
                        setAnswer(e.target.value);
                        if (!answerStartTime && e.target.value.trim()) {
                          setAnswerStartTime(Date.now());
                        }
                      }}
                      onFocus={() => setShowHints(true)}
                      onBlur={() => setShowHints(false)}
                      placeholder="Type your answer here or click 'Start Recording' to use voice..."
                      className={`w-full h-32 p-4 border-2 rounded-xl transition-all duration-300 resize-none ${
                        isRecording 
                          ? 'border-red-300 bg-red-50 shadow-red-100 shadow-lg' 
                          : 'border-gray-300 focus:border-blue-500 focus:shadow-blue-100 focus:shadow-lg group-hover:border-gray-400'
                      } ${typingAnimation ? 'animate-pulse' : ''}`}
                      disabled={isTranscribing || isRecording}
                    />
                    
                    {/* Character count */}
                    <div className="absolute bottom-2 right-2 text-xs text-gray-400">
                      {answer.length} chars
                    </div>
                    
                    {/* Recording indicator */}
                    {isRecording && (
                      <div className="absolute top-3 right-3 flex items-center text-red-600 bg-white px-2 py-1 rounded-full shadow-sm">
                        <div className="w-2 h-2 bg-red-600 rounded-full mr-2 animate-ping"></div>
                        <span className="text-xs font-medium">Recording...</span>
                      </div>
                    )}
                    
                    {/* Hints */}
                    {showHints && !answer.trim() && (
                      <div className="absolute -bottom-8 left-0 text-xs text-blue-600 animate-fade-in">
                        💡 Tip: Be specific and use examples from your experience
                      </div>
                    )}
                  </div>

                  <div className="flex gap-4 relative z-10">
                    <button
                      onClick={isRecording ? stopRecording : startRecording}
                      disabled={isTranscribing}
                      className={`group flex items-center px-6 py-3 rounded-xl font-medium transition-all duration-300 transform hover:scale-105 active:scale-95 shadow-lg relative z-20 ${
                        isRecording 
                          ? 'bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700 animate-pulse shadow-red-200' 
                          : 'bg-gradient-to-r from-gray-600 to-gray-700 text-white hover:from-gray-700 hover:to-gray-800 shadow-gray-200'
                      }`}
                    >
                      {isRecording ? (
                        <>
                          <div className="w-3 h-3 bg-white rounded-full mr-3 animate-ping"></div>
                          <MicOff className="w-5 h-5 mr-2 group-hover:animate-bounce" />
                          Stop Recording
                        </>
                      ) : (
                        <>
                          <Mic className="w-5 h-5 mr-2 group-hover:animate-bounce" />
                          Start Recording
                        </>
                      )}
                    </button>

                    <button
                      onClick={submitAnswer}
                      disabled={!answer.trim() || isLoading || isRecording}
                      className={`group flex-1 text-white py-3 px-6 rounded-xl disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 active:scale-95 shadow-lg flex items-center justify-center font-medium relative z-20 ${
                        isLoading 
                          ? 'bg-gradient-to-r from-purple-500 to-purple-600 shadow-purple-200' 
                          : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-gray-400 disabled:to-gray-500 shadow-blue-200'
                      }`}
                    >
                      {isLoading ? (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-3"></div>
                          <Brain className="w-5 h-5 mr-2 animate-pulse" />
                          Analyzing...
                        </>
                      ) : isRecording ? (
                        <>
                          <div className="w-2 h-2 bg-white rounded-full mr-3 animate-ping"></div>
                          <Clock className="w-5 h-5 mr-2" />
                          Recording in Progress...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-5 h-5 mr-2 group-hover:animate-spin" />
                          Get Feedback
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Simplified Analysis Display */}
              {showAnalysis && analysis && !isPlayingAudio && (
                <div className="mb-8">
                  <div className="bg-gradient-to-r from-stone-50 to-amber-50 p-6 rounded-lg border border-stone-200">
                    <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                      <Brain className="w-6 h-6 mr-2 text-stone-600" />
                      AI Feedback
                    </h3>
                    
                    <div className="text-center mb-6">
                      <div className="relative inline-block">
                        <div className={`w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold text-white shadow-lg transform transition-all duration-500 ${
                          analysis.score >= 8 ? 'bg-gradient-to-br from-amber-400 to-amber-600 animate-bounce' :
                          analysis.score >= 6 ? 'bg-gradient-to-br from-stone-400 to-stone-600 animate-pulse' : 
                          'bg-gradient-to-br from-neutral-400 to-neutral-600 animate-pulse'
                        }`}>
                          {analysis.score}
                        </div>
                        <div className="absolute -top-2 -right-2">
                          {analysis.score >= 8 ? (
                            <Trophy className="w-8 h-8 text-amber-500 animate-bounce" />
                          ) : analysis.score >= 6 ? (
                            <Target className="w-8 h-8 text-stone-500 animate-pulse" />
                          ) : (
                            <Zap className="w-8 h-8 text-neutral-500 animate-pulse" />
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 mt-3 font-medium">Your Score out of 10</p>
                      {responseTime > 0 && (
                        <p className="text-xs text-gray-500 mt-1">
                          Response time: {responseTime.toFixed(1)}s
                        </p>
                      )}
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                      {analysis.strengths.length > 0 && (
                        <div className="bg-gradient-to-br from-amber-50 to-amber-100 p-6 rounded-xl border border-amber-200 shadow-sm hover-lift animate-slide-in-left">
                          <h4 className="font-semibold text-amber-800 mb-4 flex items-center">
                            <div className="w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center mr-2">
                              <span className="text-white text-sm">✓</span>
                            </div>
                            Strengths
                          </h4>
                          <ul className="space-y-3">
                            {analysis.strengths.map((strength, index) => (
                              <li key={index} className="text-amber-700 flex items-start animate-fade-in" style={{animationDelay: `${index * 0.1}s`}}>
                                <Star className="w-4 h-4 text-amber-500 mr-2 mt-0.5 flex-shrink-0" />
                                <span className="leading-relaxed">{strength}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {analysis.improvements.length > 0 && (
                        <div className="bg-gradient-to-br from-stone-50 to-stone-100 p-6 rounded-xl border border-stone-200 shadow-sm hover-lift animate-slide-in-right">
                          <h4 className="font-semibold text-stone-800 mb-4 flex items-center">
                            <div className="w-6 h-6 bg-stone-500 rounded-full flex items-center justify-center mr-2">
                              <Zap className="w-3 h-3 text-white" />
                            </div>
                            Areas for Improvement
                          </h4>
                          <ul className="space-y-3">
                            {analysis.improvements.map((improvement, index) => (
                              <li key={index} className="text-stone-700 flex items-start animate-fade-in" style={{animationDelay: `${index * 0.1}s`}}>
                                <Target className="w-4 h-4 text-stone-500 mr-2 mt-0.5 flex-shrink-0" />
                                <span className="leading-relaxed">{improvement}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    <div className="mt-8 flex justify-center">
                      {(currentQuestionIndex < questions.length - 1) || (questions.length === 1 && currentQuestionIndex === 0) ? (
                        <button
                          onClick={nextQuestion}
                          className="group bg-gradient-to-r from-amber-500 to-amber-600 text-white py-4 px-8 rounded-xl hover:from-amber-600 hover:to-amber-700 transition-all duration-300 transform hover:scale-105 active:scale-95 font-medium shadow-lg shadow-amber-200 flex items-center"
                        >
                          <span className="mr-2">Next Question</span>
                          <ArrowLeft className="w-5 h-5 rotate-180 group-hover:translate-x-1 transition-transform" />
                        </button>
                      ) : (
                        <button
                          onClick={generateFinalSummary}
                          className="group bg-gradient-to-r from-stone-500 to-neutral-600 text-white py-4 px-8 rounded-xl hover:from-stone-600 hover:to-neutral-700 transition-all duration-300 transform hover:scale-105 active:scale-95 font-medium shadow-lg shadow-stone-200 flex items-center"
                        >
                          <Trophy className="w-5 h-5 mr-2 group-hover:animate-bounce" />
                          Complete Interview
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}


            </>
          )}
        </div>
      </div>
      
      <audio ref={audioRef} onEnded={() => setIsPlayingAudio(false)} />
      
      {/* Camera elements for posture monitoring - Only for Professional Interviews */}
      {interviewMode === 'professional' && (
        <>
          <video 
            ref={videoRef} 
            autoPlay 
            muted 
            style={{ display: 'none' }}
          />
          <canvas 
            ref={canvasRef} 
            style={{ display: 'none' }}
          />
          
          {/* Debug: Show camera preview (remove in production) */}
          {process.env.NODE_ENV === 'development' && cameraStream && (
            <div className="fixed bottom-4 right-4 z-50">
              <div className="bg-white p-2 rounded-lg shadow-lg border">
                <p className="text-xs text-gray-600 mb-1">Camera Preview (Dev Mode)</p>
                <video 
                  ref={(el) => { if (el && cameraStream) el.srcObject = cameraStream; }}
                  autoPlay 
                  muted 
                  className="w-32 h-24 rounded border"
                />
                <div className="text-xs text-gray-500 mt-1">
                  Status: {cameraStatus} | Photos: {photoCount}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default InterviewPage;