import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Brain, 
  Zap, 
  Target, 
  Trophy, 
  ArrowRight, 
  Play, 
  CheckCircle, 
  Star,
  Users,
  MessageSquare,
  Clock,
  Sparkles,
  ChevronDown,
  Menu,
  X
} from 'lucide-react';
import AIAvatar from '../components/AIAvatar';

const HomePage = () => {
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [currentTestimonial, setCurrentTestimonial] = useState(0);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const features = [
    {
      icon: Brain,
      title: 'AI-Powered Analysis',
      description: 'Advanced algorithms analyze your responses in real-time',
      color: 'from-blue-500 to-blue-600'
    },
    {
      icon: Target,
      title: 'Personalized Feedback',
      description: 'Get tailored suggestions based on your performance',
      color: 'from-emerald-500 to-emerald-600'
    },
    {
      icon: Trophy,
      title: 'Professional Growth',
      description: 'Track your progress and improve interview skills',
      color: 'from-purple-500 to-purple-600'
    }
  ];

  const testimonials = [
    {
      name: 'Sarah Johnson',
      role: 'Software Engineer',
      company: 'Google',
      text: 'This platform helped me land my dream job! The AI feedback was incredibly detailed.',
      rating: 5
    },
    {
      name: 'Michael Chen',
      role: 'Product Manager',
      company: 'Microsoft',
      text: 'The practice sessions boosted my confidence significantly. Highly recommend!',
      rating: 5
    },
    {
      name: 'Emily Davis',
      role: 'Data Scientist',
      company: 'Amazon',
      text: 'Amazing tool for interview preparation. The AI avatars make it feel so real.',
      rating: 5
    }
  ];

  const stats = [
    { number: '50K+', label: 'Interviews Completed' },
    { number: '95%', label: 'Success Rate' },
    { number: '4.9/5', label: 'User Rating' },
    { number: '24/7', label: 'Available' }
  ];

  return (
    <div className="min-h-screen bg-white overflow-hidden">
      {/* Navigation */}
      <nav className="relative z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl">
                <Brain className="h-6 w-6 text-white" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                InterviewAI
              </span>
            </div>
            
            <div className="hidden md:flex items-center space-x-8">
              <a href="#features" className="text-gray-600 hover:text-blue-600 transition-colors">Features</a>
              <button
                onClick={() => navigate('/upload')}
                className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-2 rounded-xl hover:shadow-lg transition-all transform hover:scale-105"
              >
                Get Started
              </button>
            </div>

            <button
              className="md:hidden"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-20 pb-32 overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0">
          <div 
            className="absolute w-96 h-96 bg-gradient-to-r from-blue-400/20 to-purple-600/20 rounded-full blur-3xl"
            style={{
              left: mousePosition.x / 10,
              top: mousePosition.y / 10,
              transition: 'all 0.3s ease'
            }}
          />
          <div className="absolute top-1/4 right-1/4 w-64 h-64 bg-gradient-to-r from-emerald-400/20 to-blue-600/20 rounded-full blur-3xl animate-pulse" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div className="space-y-4">
                <div className="inline-flex items-center bg-blue-50 text-blue-700 px-4 py-2 rounded-full text-sm font-medium">
                  <Sparkles className="w-4 h-4 mr-2" />
                  AI-Powered Interview Platform
                </div>
                
                <h1 className="text-5xl lg:text-6xl font-bold leading-tight">
                  <span className="bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                    Ace Your Next
                  </span>
                  <br />
                  <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                    Interview
                  </span>
                </h1>
                
                <p className="text-xl text-gray-600 leading-relaxed">
                  Practice with AI interviewers, get instant feedback, and boost your confidence. 
                  Land your dream job with personalized interview coaching.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={() => navigate('/upload')}
                  className="group bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-4 rounded-2xl font-semibold text-lg hover:shadow-xl transition-all transform hover:scale-105 flex items-center justify-center"
                >
                  Start Free Interview
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </button>
                
                <button className="group bg-white text-gray-700 px-8 py-4 rounded-2xl font-semibold text-lg border-2 border-gray-200 hover:border-blue-300 hover:shadow-lg transition-all flex items-center justify-center">
                  <Play className="mr-2 h-5 w-5" />
                  Watch Demo
                </button>
              </div>


            </div>

            <div className="relative">
              <div className="bg-white rounded-3xl shadow-2xl p-8 border border-gray-100">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-3">
                    <AIAvatar type="professional" size="medium" />
                    <div>
                      <div className="font-semibold text-gray-900">Live Interview Session</div>
                      <div className="text-sm text-gray-500">AI Interviewer Ready</div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-sm text-green-600 font-medium">Online</span>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="bg-gray-50 rounded-2xl p-4">
                    <div className="text-sm text-gray-600 mb-2">AI Interviewer</div>
                    <div className="text-gray-900">
                      "Tell me about a challenging project you've worked on recently and how you overcame the obstacles."
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <div className="flex-1 bg-blue-50 rounded-2xl p-4 border-2 border-dashed border-blue-200">
                      <div className="text-blue-600 text-sm">Your response will appear here...</div>
                    </div>
                    <button className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors">
                      <MessageSquare className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Why Choose InterviewAI?
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Our advanced AI technology provides the most realistic interview experience 
              with personalized feedback to help you succeed.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div
                  key={index}
                  className="group bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-2 border border-gray-100"
                >
                  <div className={`inline-flex p-4 bg-gradient-to-r ${feature.color} rounded-2xl mb-6 group-hover:scale-110 transition-transform`}>
                    <Icon className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-4">{feature.title}</h3>
                  <p className="text-gray-600 leading-relaxed">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>



      {/* CTA Section */}
      <section className="py-24 bg-gradient-to-r from-blue-600 to-purple-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold text-white mb-4">
            Ready to Ace Your Next Interview?
          </h2>
          <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
            Join thousands of successful candidates who've improved their interview skills with our AI platform.
          </p>
          
          <button
            onClick={() => navigate('/upload')}
            className="bg-white text-blue-600 px-8 py-4 rounded-2xl font-semibold text-lg hover:shadow-xl transition-all transform hover:scale-105 inline-flex items-center"
          >
            Start Your Free Interview
            <ArrowRight className="ml-2 h-5 w-5" />
          </button>
        </div>
      </section>


    </div>
  );
};

export default HomePage;