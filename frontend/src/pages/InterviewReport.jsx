import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Trophy, Star, Target, Zap, ArrowLeft, RotateCcw } from 'lucide-react';

const InterviewReport = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const reportData = location.state;

  // Redirect if no data
  if (!reportData) {
    console.error('No report data received');
    navigate('/');
    return null;
  }
  
  console.log('Report data received:', reportData);

  const {
    overall_score = 0,
    total_questions = 0,
    answered_questions = 0,
    technical_strengths = [],
    soft_skill_strengths = [],
    technical_improvements = [],
    soft_skill_improvements = [],
    posture_analysis = null,
    session_id = 'unknown',
    status = 'unknown',
    message = 'Interview Report'
  } = reportData;

  const getScoreColor = (score) => {
    if (score >= 8) return 'from-amber-400 to-amber-600';
    if (score >= 6) return 'from-stone-400 to-stone-600';
    return 'from-neutral-400 to-neutral-600';
  };

  const getScoreMessage = (score) => {
    if (score >= 8) return 'Excellent Performance!';
    if (score >= 6) return 'Good Performance';
    if (score >= 4) return 'Fair Performance';
    return 'Needs Improvement';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 to-amber-50 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <button
            onClick={() => navigate('/')}
            className="flex items-center text-gray-600 hover:text-gray-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back to Home
          </button>
          

        </div>

        {/* Main Report Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
          {/* Title */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-2 flex items-center justify-center">
              <Trophy className="w-8 h-8 mr-3 text-amber-600" />
              {message || 'Interview Performance Report'}
            </h1>

            {status === 'no_questions_answered' && (
              <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-amber-800 font-medium">⚠️ No questions were answered during this interview session.</p>
                <p className="text-amber-700 text-sm mt-1">Please start a new interview to receive personalized feedback.</p>
              </div>
            )}
            {status === 'incomplete' && (
              <div className="mt-4 p-4 bg-stone-50 border border-stone-200 rounded-lg">
                <p className="text-stone-800 font-medium">📊 You stopped the interview early.</p>
                <p className="text-stone-700 text-sm mt-1">Here's your review for the {answered_questions} question{answered_questions !== 1 ? 's' : ''} you answered out of {total_questions} total.</p>
              </div>
            )}
          </div>

          {/* Overall Score Section */}
          <div className="text-center mb-12">
            <div className="relative inline-block mb-6">
              <div className={`w-40 h-40 rounded-full flex items-center justify-center text-5xl font-bold text-white shadow-2xl bg-gradient-to-br ${getScoreColor(overall_score)}`}>
                {overall_score}
              </div>
              <div className="absolute -top-3 -right-3">
                {overall_score >= 8 ? (
                  <Trophy className="w-12 h-12 text-amber-500" />
                ) : overall_score >= 6 ? (
                  <Target className="w-12 h-12 text-stone-500" />
                ) : (
                  <Zap className="w-12 h-12 text-neutral-500" />
                )}
              </div>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">{getScoreMessage(overall_score)}</h2>
            <p className="text-lg text-gray-600">Overall Score: {overall_score}/10</p>
            <p className="text-sm text-gray-500">
              {status === 'no_questions_answered' 
                ? 'No questions answered' 
                : status === 'incomplete'
                ? `Based on ${answered_questions} of ${total_questions} questions`
                : `Based on ${total_questions} interview questions`
              }
            </p>
          </div>

          {/* Skills Analysis Grid */}
          <div className="grid lg:grid-cols-2 gap-8">
            {/* Strengths Column */}
            <div className="space-y-6">
              <h3 className="text-2xl font-bold text-amber-800 flex items-center">
                <div className="w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center mr-3">
                  <span className="text-white text-lg">✓</span>
                </div>
                Your Strong Areas
              </h3>
              
              {/* Technical Strengths */}
              <div className="bg-gradient-to-br from-amber-50 to-amber-100 p-6 rounded-xl border border-amber-200 shadow-sm">
                <h4 className="font-bold text-amber-800 mb-4 flex items-center">
                  <span className="text-2xl mr-3">💻</span>
                  Technical Skills
                </h4>
                {technical_strengths && technical_strengths.length > 0 ? (
                  <ul className="space-y-3">
                    {technical_strengths.map((strength, index) => (
                      <li key={index} className="text-amber-700 flex items-start">
                        <Star className="w-5 h-5 text-amber-500 mr-3 mt-0.5 flex-shrink-0" />
                        <span className="leading-relaxed">{strength}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-amber-600 italic">No specific technical strengths identified in this interview.</p>
                )}
              </div>
              
              {/* Soft Skill Strengths */}
              <div className="bg-gradient-to-br from-stone-50 to-stone-100 p-6 rounded-xl border border-stone-200 shadow-sm">
                <h4 className="font-bold text-stone-800 mb-4 flex items-center">
                  <span className="text-2xl mr-3">🗣️</span>
                  Communication & Soft Skills
                </h4>
                {soft_skill_strengths && soft_skill_strengths.length > 0 ? (
                  <ul className="space-y-3">
                    {soft_skill_strengths.map((strength, index) => (
                      <li key={index} className="text-stone-700 flex items-start">
                        <Star className="w-5 h-5 text-stone-500 mr-3 mt-0.5 flex-shrink-0" />
                        <span className="leading-relaxed">{strength}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-stone-600 italic">No specific communication strengths identified in this interview.</p>
                )}
              </div>
            </div>

            {/* Improvements Column */}
            <div className="space-y-6">
              <h3 className="text-2xl font-bold text-neutral-800 flex items-center">
                <div className="w-8 h-8 bg-neutral-500 rounded-full flex items-center justify-center mr-3">
                  <Zap className="w-4 h-4 text-white" />
                </div>
                Areas to Improve
              </h3>
              
              {/* Technical Improvements */}
              <div className="bg-gradient-to-br from-neutral-50 to-neutral-100 p-6 rounded-xl border border-neutral-200 shadow-sm">
                <h4 className="font-bold text-neutral-800 mb-4 flex items-center">
                  <span className="text-2xl mr-3">💻</span>
                  Technical Skills to Develop
                </h4>
                {technical_improvements && technical_improvements.length > 0 ? (
                  <ul className="space-y-3">
                    {technical_improvements.map((improvement, index) => (
                      <li key={index} className="text-neutral-700 flex items-start">
                        <Target className="w-5 h-5 text-neutral-500 mr-3 mt-0.5 flex-shrink-0" />
                        <span className="leading-relaxed">{improvement}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-neutral-600 italic">No specific technical improvements suggested.</p>
                )}
              </div>
              
              {/* Soft Skill Improvements */}
              <div className="bg-gradient-to-br from-stone-50 to-stone-100 p-6 rounded-xl border border-stone-200 shadow-sm">
                <h4 className="font-bold text-stone-800 mb-4 flex items-center">
                  <span className="text-2xl mr-3">🗣️</span>
                  Communication Skills to Enhance
                </h4>
                {soft_skill_improvements && soft_skill_improvements.length > 0 ? (
                  <ul className="space-y-3">
                    {soft_skill_improvements.map((improvement, index) => (
                      <li key={index} className="text-stone-700 flex items-start">
                        <Target className="w-5 h-5 text-stone-500 mr-3 mt-0.5 flex-shrink-0" />
                        <span className="leading-relaxed">{improvement}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-stone-600 italic">No specific communication improvements suggested.</p>
                )}
              </div>
            </div>
          </div>

          {/* Posture Analysis Section */}
          {posture_analysis && (
            <div className="mt-12 p-6 bg-gradient-to-br from-neutral-50 to-stone-100 rounded-2xl border border-stone-200">
              <h3 className="text-2xl font-bold text-stone-800 mb-6 flex items-center">
                <div className="w-8 h-8 bg-stone-500 rounded-full flex items-center justify-center mr-3">
                  <span className="text-white text-lg">📷</span>
                </div>
                Posture Analysis
              </h3>
              
              <div className="grid md:grid-cols-3 gap-6 mb-6">
                <div className="text-center">
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-white mx-auto mb-3 ${
                    posture_analysis.posture_score >= 8 ? 'bg-gradient-to-br from-amber-400 to-amber-600' :
                    posture_analysis.posture_score >= 6 ? 'bg-gradient-to-br from-stone-400 to-stone-600' :
                    'bg-gradient-to-br from-neutral-400 to-neutral-600'
                  }`}>
                    {posture_analysis.posture_score}
                  </div>
                  <p className="text-stone-700 font-medium">Posture Score</p>
                  <p className="text-stone-500 text-sm">out of 10</p>
                </div>
                
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center text-2xl font-bold text-amber-700 mx-auto mb-3">
                    {posture_analysis.good_posture_count || 0}
                  </div>
                  <p className="text-stone-700 font-medium">Good Posture</p>
                  <p className="text-stone-500 text-sm">photos captured</p>
                </div>
                
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-neutral-100 flex items-center justify-center text-2xl font-bold text-neutral-700 mx-auto mb-3">
                    {posture_analysis.poor_posture_count || 0}
                  </div>
                  <p className="text-stone-700 font-medium">Poor Posture</p>
                  <p className="text-stone-500 text-sm">photos captured</p>
                </div>
              </div>
              
              {posture_analysis.recommendations && posture_analysis.recommendations.length > 0 && (
                <div className="bg-white/80 p-6 rounded-xl border border-stone-200">
                  <h4 className="font-bold text-stone-800 mb-4 flex items-center">
                    <span className="text-xl mr-3">💡</span>
                    Posture Recommendations
                  </h4>
                  <ul className="space-y-3">
                    {posture_analysis.recommendations.map((recommendation, index) => (
                      <li key={index} className="text-stone-700 flex items-start">
                        <Target className="w-5 h-5 text-stone-500 mr-3 mt-0.5 flex-shrink-0" />
                        <span className="leading-relaxed">{recommendation}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="mt-12 flex justify-center gap-4">
            <button
              onClick={() => navigate('/mode-selection', { state: { sessionId: session_id } })}
              className="flex items-center px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-xl hover:from-amber-600 hover:to-amber-700 transition-all duration-300 transform hover:scale-105 font-medium shadow-lg"
            >
              <RotateCcw className="w-5 h-5 mr-2" />
              Take Another Interview
            </button>
            <button
              onClick={() => navigate('/')}
              className="flex items-center px-6 py-3 bg-gradient-to-r from-neutral-500 to-neutral-600 text-white rounded-xl hover:from-neutral-600 hover:to-neutral-700 transition-all duration-300 transform hover:scale-105 font-medium shadow-lg"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Back to Home
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-gray-500 text-sm">
          <p>Generated by AI Interviewer • {new Date().toLocaleDateString()}</p>
        </div>
      </div>
    </div>
  );
};

export default InterviewReport;