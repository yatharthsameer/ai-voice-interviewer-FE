import React from "react";
import { motion } from "framer-motion";
import { InterviewState } from "@/hooks/useInterviewSocket";

interface AIAvatarProps {
  interviewState: InterviewState;
  className?: string;
}

export function AIAvatar({ interviewState, className = "" }: AIAvatarProps) {
  const getStatusText = () => {
    switch (interviewState) {
      case "connecting":
        return "Connecting...";
      case "ready":
        return "Ready to begin";
      case "aiSpeaking":
        return "AI is speaking...";
      case "listening":
        return "Listening...";
      case "sending":
        return "Processing...";
      case "waitingBackend":
        return "Thinking...";
      case "completed":
        return "Interview complete";
      case "error":
        return "Connection error";
      default:
        return "Ready";
    }
  };

  const getStatusColor = () => {
    switch (interviewState) {
      case "aiSpeaking":
        return "text-brand";
      case "listening":
        return "text-success";
      case "error":
        return "text-destructive";
      default:
        return "text-muted-foreground";
    }
  };

  const isActive = interviewState === "aiSpeaking" || interviewState === "listening";
  const isSpeaking = interviewState === "aiSpeaking";
  const isListening = interviewState === "listening";

  return (
    <div className={`flex flex-col items-center space-y-6 ${className}`}>
      {/* Avatar Container */}
      <div className="relative">
        {/* Outer pulse rings for speaking */}
        {isSpeaking && (
          <div className="ring-visualizer">
            <div className="absolute inset-0 rounded-full border-2 border-brand/30 animate-ping" />
            <div className="absolute inset-2 rounded-full border-2 border-brand/20 animate-ping animation-delay-200" />
          </div>
        )}
        
        {/* Avatar */}
        <motion.div
          className={`
            relative w-48 h-48 rounded-full overflow-hidden
            ${isActive ? "shadow-2xl" : "shadow-lg"}
            ${isSpeaking ? "shadow-brand/30" : ""}
            ${isListening ? "shadow-success/30" : ""}
          `}
          animate={{
            scale: isActive ? 1.02 : 1,
            boxShadow: isSpeaking 
              ? "0 0 40px hsl(var(--brand) / 0.4)" 
              : isListening 
                ? "0 0 40px hsl(var(--success) / 0.4)"
                : "0 10px 30px rgba(0,0,0,0.1)"
          }}
          transition={{ duration: 0.3 }}
        >
          {/* Gradient Background */}
          <div className="absolute inset-0 bg-gradient-to-br from-brand/20 via-brand/10 to-brand/5" />
          
          {/* AI Avatar Circle */}
          <div className="absolute inset-4 rounded-full bg-gradient-to-br from-brand to-brand/80 flex items-center justify-center">
            {/* Inner breathing animation */}
            <motion.div
              className="w-20 h-20 rounded-full bg-brand-foreground/20 backdrop-blur-sm"
              animate={{
                scale: isSpeaking ? [1, 1.1, 1] : isListening ? [1, 1.05, 1] : 1,
                opacity: isSpeaking ? [0.6, 1, 0.6] : isListening ? [0.8, 1, 0.8] : 0.8
              }}
              transition={{
                duration: isSpeaking ? 1.5 : isListening ? 2 : 3,
                repeat: isActive ? Infinity : 0,
                ease: "easeInOut"
              }}
            />
            
            {/* AI Symbol/Icon */}
            <div className="absolute inset-0 flex items-center justify-center">
              <motion.div
                className="text-brand-foreground text-4xl font-bold"
                animate={{
                  rotate: isSpeaking ? [0, 5, -5, 0] : 0
                }}
                transition={{
                  duration: 2,
                  repeat: isSpeaking ? Infinity : 0,
                  ease: "easeInOut"
                }}
              >
                AI
              </motion.div>
            </div>
          </div>
          
          {/* Listening waveform overlay */}
          {isListening && (
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
              <div className="intake-bars">
                {[...Array(5)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="intake-bar"
                    animate={{
                      height: [4, Math.random() * 20 + 8, 4]
                    }}
                    transition={{
                      duration: 1.2,
                      repeat: Infinity,
                      delay: i * 0.1,
                      ease: "easeInOut"
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* Status Text */}
      <motion.div
        className="text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <p className={`text-lg font-medium ${getStatusColor()}`}>
          {getStatusText()}
        </p>
        
        {interviewState === "connecting" && (
          <div className="flex justify-center mt-2">
            <div className="flex space-x-1">
              {[...Array(3)].map((_, i) => (
                <motion.div
                  key={i}
                  className="w-2 h-2 bg-brand rounded-full"
                  animate={{
                    y: [0, -8, 0],
                    opacity: [0.5, 1, 0.5]
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    delay: i * 0.2,
                    ease: "easeInOut"
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}