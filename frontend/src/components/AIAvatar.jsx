import React from 'react';

const AIAvatar = ({ type = 'professional', isAnimated = false, size = 'large' }) => {
  const avatars = {
    professional: {
      name: 'Alex Thompson',
      title: 'Senior Technical Interviewer',
      background: 'from-slate-700 to-slate-900',
      suit: 'from-slate-800 to-slate-900',
      tie: 'bg-blue-600',
      skin: 'from-amber-100 to-amber-200',
      hair: 'from-amber-800 to-amber-900'
    },
    friendly: {
      name: 'Sarah Chen',
      title: 'HR Interview Specialist',
      background: 'from-purple-600 to-purple-800',
      suit: 'from-purple-700 to-purple-900',
      tie: 'bg-pink-500',
      skin: 'from-rose-100 to-rose-200',
      hair: 'from-amber-700 to-amber-800'
    },
    technical: {
      name: 'David Kumar',
      title: 'Lead Software Engineer',
      background: 'from-emerald-600 to-emerald-800',
      suit: 'from-emerald-700 to-emerald-900',
      tie: 'bg-emerald-500',
      skin: 'from-yellow-100 to-yellow-200',
      hair: 'from-slate-800 to-slate-900'
    }
  };

  const avatar = avatars[type] || avatars.professional;
  const sizeClasses = {
    small: 'w-16 h-16',
    medium: 'w-20 h-20',
    large: 'w-24 h-24'
  };

  return (
    <div className="flex-shrink-0">
      <div className={`relative ${sizeClasses[size]} rounded-2xl overflow-hidden shadow-lg transition-all duration-300 ${
        isAnimated ? 'scale-110 shadow-xl' : 'scale-100'
      }`}>
        {/* Background */}
        <div className={`w-full h-full bg-gradient-to-br ${avatar.background} flex items-center justify-center relative`}>
          {/* Avatar Face */}
          <div className={`${size === 'small' ? 'w-10 h-10' : size === 'medium' ? 'w-12 h-12' : 'w-16 h-16'} bg-gradient-to-br ${avatar.skin} rounded-full relative overflow-hidden`}>
            {/* Eyes */}
            <div className={`absolute ${size === 'small' ? 'top-3 left-2 w-1 h-1' : size === 'medium' ? 'top-4 left-2.5 w-1.5 h-1.5' : 'top-5 left-3 w-2 h-2'} bg-slate-700 rounded-full`}></div>
            <div className={`absolute ${size === 'small' ? 'top-3 right-2 w-1 h-1' : size === 'medium' ? 'top-4 right-2.5 w-1.5 h-1.5' : 'top-5 right-3 w-2 h-2'} bg-slate-700 rounded-full`}></div>
            
            {/* Nose */}
            <div className={`absolute ${size === 'small' ? 'top-4 w-0.5 h-0.5' : size === 'medium' ? 'top-5 w-0.5 h-0.5' : 'top-7 w-1 h-1'} left-1/2 transform -translate-x-1/2 bg-amber-300 rounded-full`}></div>
            
            {/* Mouth */}
            <div className={`absolute ${size === 'small' ? 'top-5 w-2 h-0.5' : size === 'medium' ? 'top-6 w-2 h-0.5' : 'top-9 w-3 h-1'} left-1/2 transform -translate-x-1/2 bg-slate-600 rounded-full ${
              isAnimated ? 'animate-pulse' : ''
            }`}></div>
            
            {/* Hair */}
            <div className={`absolute ${size === 'small' ? '-top-1 left-0.5 w-9 h-5' : size === 'medium' ? '-top-1.5 left-0.5 w-11 h-6' : '-top-2 left-1 w-14 h-8'} bg-gradient-to-br ${avatar.hair} rounded-t-full`}></div>
          </div>
          
          {/* Suit */}
          <div className={`absolute bottom-0 left-1/2 transform -translate-x-1/2 ${size === 'small' ? 'w-14 h-8' : size === 'medium' ? 'w-16 h-10' : 'w-20 h-12'} bg-gradient-to-br ${avatar.suit} rounded-t-lg`}>
            {/* Shirt */}
            <div className={`absolute ${size === 'small' ? 'top-1 w-6 h-6' : size === 'medium' ? 'top-1.5 w-6 h-7' : 'top-2 w-8 h-8'} left-1/2 transform -translate-x-1/2 bg-white rounded-sm`}>
              {/* Tie */}
              <div className={`absolute top-0 left-1/2 transform -translate-x-1/2 ${size === 'small' ? 'w-1 h-4' : size === 'medium' ? 'w-1.5 h-5' : 'w-2 h-6'} ${avatar.tie} rounded-sm`}></div>
            </div>
          </div>
          
          {/* Speaking Animation */}
          {isAnimated && (
            <div className="absolute inset-0 bg-blue-500/20 animate-pulse rounded-2xl"></div>
          )}
        </div>
      </div>
      
      {/* Name and Title */}
      <div className="text-center mt-3">
        <div className="bg-white/80 backdrop-blur-sm px-3 py-1 rounded-full shadow-sm">
          <span className={`${size === 'small' ? 'text-xs' : 'text-xs'} text-gray-700 font-medium`}>
            {avatar.name}
          </span>
        </div>
        <div className={`mt-1 ${size === 'small' ? 'text-xs' : 'text-xs'} text-gray-500`}>
          {avatar.title}
        </div>
        {isAnimated && (
          <div className={`mt-1 ${size === 'small' ? 'text-xs' : 'text-xs'} text-blue-600 font-medium animate-pulse`}>
            Speaking...
          </div>
        )}
      </div>
    </div>
  );
};

export default AIAvatar;