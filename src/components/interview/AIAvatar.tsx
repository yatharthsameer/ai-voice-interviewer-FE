import { useState, useEffect } from 'react';
import avatarImage from '@/assets/ai-avatar.jpg';

interface AIAvatarProps {
  isListening?: boolean;
  isSpeaking?: boolean;
  className?: string;
}

export function AIAvatar({ isListening = false, isSpeaking = false, className = '' }: AIAvatarProps) {
  const [blink, setBlink] = useState(false);

  useEffect(() => {
    const blinkInterval = setInterval(() => {
      setBlink(true);
      setTimeout(() => setBlink(false), 150);
    }, 3000 + Math.random() * 2000);

    return () => clearInterval(blinkInterval);
  }, []);

  return (
    <div className={`relative ${className}`}>
      {/* Speaking visualizer ring */}
      {isSpeaking && <div className="ring-visualizer"></div>}
      {/* Glow ring for listening/speaking states */}
      <div 
        className={`absolute inset-0 rounded-full transition-all duration-300 ${
          isListening 
            ? 'animate-pulse-glow bg-brand/20 blur-lg' 
            : isSpeaking 
            ? 'animate-pulse-glow bg-accent/20 blur-lg'
            : ''
        }`}
      />
      
      {/* Main avatar container */}
      <div 
        className={`relative glass-card rounded-full p-2 transition-all duration-300 ${
          isListening || isSpeaking ? 'animate-breathe' : 'animate-float'
        }`}
      >
        <div className="relative overflow-hidden rounded-full">
          <img
            src={avatarImage}
            alt="AI Interviewer Avatar"
            className="w-full h-full object-cover"
          />
          
          {/* Blink overlay */}
          <div 
            className={`absolute inset-0 bg-background transition-opacity duration-150 ${
              blink ? 'opacity-100' : 'opacity-0'
            }`}
          />
          
          {/* Speaking indicator overlay */}
          {isSpeaking && (
            <div className="absolute inset-0 bg-gradient-to-r from-brand/10 to-accent/10 animate-pulse" />
          )}
        </div>
        
        {/* Microphone waveform for listening */}
        {isListening && (
          <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 flex space-x-1">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="w-1 bg-brand animate-waveform rounded-full"
                style={{
                  animationDelay: `${i * 0.1}s`,
                  animationDuration: '1.5s'
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
