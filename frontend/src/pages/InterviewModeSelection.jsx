import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  MessageCircle, 
  Clock, 
  ArrowLeft, 
  Zap, 
  Target, 
  CheckCircle, 
  Star, 
  Trophy, 
  Brain,
  PlayCircle,
  Timer,
  BarChart3,
  Sparkles,
  ChevronRight,
  Users,
  Award
} from 'lucide-react';
import './mode-selection-animations.css';

const InterviewModeSelection = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { sessionId } = location.state || {};
  const [selectedMode, setSelectedMode] = useState(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [currentMode, setCurrentMode] = useState(null);
  const [selectedAvatar, setSelectedAvatar] = useState('professional');

  useEffect(() => {
    if (!sessionId) {
      navigate('/');
      return;
    }
  }, [sessionId, navigate]);

  const handleModeSelection = (mode) => {
    setCurrentMode(mode);
    setShowWelcomeModal(true);
  };

  const handleContinue = () => {
    setShowWelcomeModal(false);
    setSelectedMode(currentMode);
    setIsAnimating(true);
    
    setTimeout(() => {
      if (currentMode === 'mock') {
        navigate('/interview', { 
          state: { 
            sessionId, 
            interviewMode: currentMode,
            selectedAvatar 
          } 
        });
      } else if (currentMode === 'full') {
        navigate('/professional-interview', { 
          state: { 
            sessionId, 
            interviewMode: currentMode,
            selectedAvatar 
          } 
        });
      }
    }, 300);
  };

  const modes = [
    {
      id: 'mock',
      title: 'Practice Mode',
      subtitle: 'Learn & Improve',
      description: 'Perfect for skill development with instant feedback',
      duration: '5-10 minutes',
      icon: MessageCircle,
      gradient: 'from-emerald-500 to-teal-600',
      bgGradient: 'from-emerald-50 to-teal-50',
      shadowColor: 'shadow-emerald-200',
      hoverShadow: 'hover:shadow-emerald-300',
      features: [
        { icon: Zap, text: 'Instant AI feedback after each answer' },
        { icon: Target, text: 'Targeted improvement suggestions' },
        { icon: CheckCircle, text: 'Learn and adapt in real-time' },
        { icon: Star, text: 'Build confidence progressively' }
      ],
      stats: [
        { label: 'Questions', value: '3-5' },
        { label: 'Feedback', value: 'Instant' },
        { label: 'Duration', value: '5-10 min' }
      ],
      popularity: 'Perfect for beginners'
    },
    {
      id: 'full',
      title: 'Professional Mode',
      subtitle: 'Complete Assessment',
      description: 'Comprehensive interview simulation with detailed analysis',
      duration: '5 minutes',
      icon: Clock,
      gradient: 'from-blue-600 to-indigo-700',
      bgGradient: 'from-blue-50 to-indigo-50',
      shadowColor: 'shadow-blue-200',
      hoverShadow: 'hover:shadow-blue-300',
      features: [
        { icon: Timer, text: 'Dynamic 5-minute interview experience' },
        { icon: BarChart3, text: 'Comprehensive performance analytics' },
        { icon: Trophy, text: 'Professional-grade assessment' },
        { icon: Award, text: 'Detailed improvement roadmap' }
      ],
      stats: [
        { label: 'Questions', value: '8-12' },
        { label: 'Report', value: 'Detailed' },
        { label: 'Duration', value: '5 min' }
      ],
      popularity: 'For comprehensive assessment'
    }
  ];

  if (!sessionId) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 relative overflow-hidden">

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-12">
          <button
            onClick={() => navigate('/upload')}
            className="group mb-8 flex items-center text-slate-600 hover:text-slate-800 transition-all duration-300 hover:translate-x-1"
          >
            <div className="p-2 rounded-full bg-white/80 backdrop-blur-sm shadow-sm group-hover:shadow-md transition-all duration-300 mr-3">
              <ArrowLeft className="w-4 h-4" />
            </div>
            <span className="font-medium">Back to Upload</span>
          </button>

          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center justify-center p-3 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl mb-6 shadow-lg">
              <Brain className="w-8 h-8 text-white" />
            </div>
            
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent mb-4 leading-tight">
              Choose Your Interview Experience
            </h1>
            
            <p className="text-xl text-slate-600 mb-8 leading-relaxed">
              Select the perfect mode to match your preparation goals and experience level
            </p>
            

          </div>
        </div>

        {/* Mode Cards */}
        <div className="grid lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
          {modes.map((mode, index) => {
            const Icon = mode.icon;
            const isSelected = selectedMode === mode.id;
            
            return (
              <div
                key={mode.id}
                className={`group relative bg-white rounded-2xl shadow-lg border-2 border-gray-100 transition-all duration-300 hover:shadow-xl hover:border-b-4 ${mode.id === 'mock' ? 'hover:border-b-emerald-500' : 'hover:border-b-blue-500'} cursor-pointer ${
                  isSelected ? 'ring-2 ring-blue-400/50 scale-[1.01]' : ''
                } ${isAnimating && isSelected ? 'animate-pulse' : ''}`}
                onClick={() => handleModeSelection(mode.id)}
              >


                
                <div className="relative p-8 lg:p-10">
                  {/* Header */}
                  <div className="text-center mb-8">
                    <div className={`inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br ${mode.gradient} rounded-2xl shadow-lg mb-6 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 animate-bounce-gentle`}>
                      <Icon className="w-10 h-10 text-white group-hover:scale-110 transition-transform duration-300" />
                    </div>
                    
                    <h2 className="text-2xl lg:text-3xl font-bold text-slate-800 mb-2">
                      {mode.title}
                    </h2>
                    
                    <div className="inline-flex items-center bg-white/60 backdrop-blur-sm px-3 py-1 rounded-full text-sm font-medium text-slate-600 mb-4">
                      {mode.subtitle}
                    </div>
                    
                    <p className="text-slate-600 text-lg leading-relaxed mb-4">
                      {mode.description}
                    </p>
                    
                    <div className="text-sm text-slate-500 font-medium">
                      {mode.popularity}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-4 mb-8">
                    {mode.stats.map((stat, statIndex) => (
                      <div key={statIndex} className="text-center">
                        <div className="bg-white/60 backdrop-blur-sm rounded-xl p-3 shadow-sm">
                          <div className="text-lg font-bold text-slate-800">{stat.value}</div>
                          <div className="text-xs text-slate-600 font-medium">{stat.label}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Features */}
                  <div className="space-y-4 mb-8">
                    {mode.features.map((feature, featureIndex) => {
                      const FeatureIcon = feature.icon;
                      return (
                        <div 
                          key={featureIndex} 
                          className="flex items-center bg-white/40 backdrop-blur-sm rounded-xl p-4 shadow-sm hover:bg-white/60 transition-all duration-300"
                          style={{
                            animationDelay: `${(index * 0.2) + (featureIndex * 0.1)}s`
                          }}
                        >
                          <div className={`p-2 bg-gradient-to-br ${mode.gradient} rounded-lg mr-4 shadow-sm`}>
                            <FeatureIcon className="w-4 h-4 text-white" />
                          </div>
                          <span className="text-slate-700 font-medium">{feature.text}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Action Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleModeSelection(mode.id);
                    }}
                    disabled={isAnimating}
                    className={`group w-full bg-gradient-to-r ${mode.gradient} text-white py-4 px-8 rounded-2xl font-bold text-lg shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center btn-interactive micro-bounce focus-ring`}
                  >
                    {isAnimating && isSelected ? (
                      <>
                        <div className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent mr-3"></div>
                        Starting...
                      </>
                    ) : (
                      <>
                        <PlayCircle className="w-6 h-6 mr-3 group-hover:scale-110 transition-transform" />
                        Start {mode.title}
                        <ChevronRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Info */}
        <div className="text-center mt-16">
          <div className="inline-flex items-center bg-white/60 backdrop-blur-sm rounded-2xl px-6 py-4 shadow-lg">
            <div className="flex items-center text-slate-600">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-3 animate-pulse"></div>
              <span className="font-medium">AI interviewer is ready • All modes include voice interaction</span>
            </div>
          </div>
        </div>
      </div>

      {/* Welcome Modal */}
      {showWelcomeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop with blur */}
          <div 
            className="absolute inset-0 bg-black/20 backdrop-blur-md"
            onClick={() => setShowWelcomeModal(false)}
          ></div>
          
          {/* Modal Content */}
          <div className="relative bg-white rounded-3xl shadow-2xl max-w-lg mx-4 p-8 animate-scale-in">
            <div className="text-center">
              <h2 className="text-3xl font-bold text-gray-900 mb-6">
                Welcome!
              </h2>
              
              <div className="text-gray-600 space-y-4 mb-8">
                <p className="text-lg leading-relaxed">
                  Get ready to ace your interviews with ease. In just three steps, we'll guide you through making the most of this platform.
                </p>
                
                <p className="text-base mb-6">
                  Please click "Continue" to start {currentMode === 'mock' ? 'practice' : 'professional'} interview session to learn how to use the application.
                </p>
                
                {/* Avatar Selection */}
                <div className="bg-gray-50 rounded-2xl p-4">
                  <p className="text-sm font-medium text-gray-700 mb-3">Choose your AI interviewer:</p>
                  <div className="flex justify-center space-x-4">
                    {['professional', 'friendly', 'technical'].map((avatarType) => {
                      const names = {
                        professional: 'Alex Thompson',
                        friendly: 'Sarah Chen', 
                        technical: 'David Kumar'
                      };
                      return (
                        <button
                          key={avatarType}
                          onClick={() => setSelectedAvatar(avatarType)}
                          className={`p-2 rounded-xl transition-all ${
                            selectedAvatar === avatarType 
                              ? 'bg-blue-100 ring-2 ring-blue-500' 
                              : 'bg-white hover:bg-gray-100'
                          }`}
                        >
                          <div className="text-center">
                            <div className={`w-12 h-12 rounded-lg mx-auto mb-1 ${
                              avatarType === 'professional' ? 'bg-gradient-to-br from-slate-600 to-slate-800' :
                              avatarType === 'friendly' ? 'bg-gradient-to-br from-purple-500 to-purple-700' :
                              'bg-gradient-to-br from-emerald-500 to-emerald-700'
                            }`}></div>
                            <span className="text-xs font-medium">{names[avatarType].split(' ')[0]}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              
              <button
                onClick={handleContinue}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 px-8 rounded-2xl transition-all duration-300 transform hover:scale-105 shadow-lg"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InterviewModeSelection;