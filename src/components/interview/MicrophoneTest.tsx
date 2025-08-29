import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useIsMobile } from '@/hooks/use-mobile';
import { Mic, MicOff, Volume2 } from 'lucide-react';

interface MicrophoneTestProps {
  onTestComplete: (passed: boolean) => void;
}

export function MicrophoneTest({ onTestComplete }: MicrophoneTestProps) {
  const [isListening, setIsListening] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);
  const isMobile = useIsMobile();
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number>();

  useEffect(() => {
    return () => {
      stopListening();
    };
  }, []);

  const requestMicrophonePermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      setHasPermission(true);
      setupAudioAnalysis(stream);
      return true;
    } catch (error) {
      console.error('Microphone permission denied:', error);
      setHasPermission(false);
      return false;
    }
  };

  const setupAudioAnalysis = (stream: MediaStream) => {
    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(stream);
    
    analyser.fftSize = 256;
    source.connect(analyser);
    
    audioContextRef.current = audioContext;
    analyserRef.current = analyser;
    
    startAudioLevelMonitoring();
  };

  const startAudioLevelMonitoring = () => {
    if (!analyserRef.current) return;
    
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    
    const updateAudioLevel = () => {
      if (!analyserRef.current) return;
      
      analyserRef.current.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
      setAudioLevel(average);
      
      animationRef.current = requestAnimationFrame(updateAudioLevel);
    };
    
    updateAudioLevel();
  };

  const startListening = async () => {
    if (!hasPermission) {
      const granted = await requestMicrophonePermission();
      if (!granted) return;
    }
    
    setIsListening(true);
    setTranscript('Listening... Please say "Hello, I\'m ready for the interview"');
    
    // Simulate speech recognition (in a real app, you'd use Web Speech API)
    setTimeout(() => {
      setTranscript('Great! Microphone test successful. You said: "Hello, I\'m ready for the interview"');
      setTimeout(() => {
        onTestComplete(true);
      }, 2000);
    }, 3000);
  };

  const stopListening = () => {
    setIsListening(false);
    
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-2 sm:p-4">
      <Card className="glass-card p-4 sm:p-8 animate-slide-up w-full max-w-md sm:max-w-lg">
        <div className="text-center space-y-4 sm:space-y-6">
          <div className="space-y-3 sm:space-y-4">
            <h2 className="text-xl sm:text-2xl font-bold gradient-text">Microphone Test</h2>
            <p className="text-sm sm:text-base text-muted-foreground px-2">
              Let's test your microphone to ensure the best interview experience
            </p>
          </div>

          {/* Audio level visualization */}
          <div className="flex justify-center items-center space-x-1 sm:space-x-2 h-12 sm:h-16">
            {[...Array(isMobile ? 16 : 20)].map((_, i) => (
              <div
                key={i}
                className="w-0.5 sm:w-1 bg-brand rounded-full transition-all duration-100"
                style={{
                  height: `${Math.max(4, (audioLevel / 255) * 60 * (0.5 + Math.random() * 0.5))}px`,
                  opacity: isListening ? 1 : 0.3,
                }}
              />
            ))}
          </div>

          {/* Transcript area */}
          <div className="glass-card p-3 sm:p-4 min-h-[60px] sm:min-h-[80px] flex items-center justify-center">
            <p className="text-xs sm:text-sm text-muted-foreground italic text-center px-2">
              {transcript || 'Your speech will appear here...'}
            </p>
          </div>

          {/* Control buttons */}
          <div className="flex justify-center">
            {!hasPermission ? (
              <Button
                onClick={requestMicrophonePermission}
                className="w-full sm:w-auto px-6 sm:px-8 py-3 glass-card border-brand/50 hover:border-brand transition-colors text-sm sm:text-base"
                variant="outline"
              >
                <Volume2 className="mr-2 h-4 w-4" />
                Grant Microphone Access
              </Button>
            ) : (
              <Button
                onClick={isListening ? stopListening : startListening}
                className={`w-full sm:w-auto px-6 sm:px-8 py-3 transition-all duration-300 text-sm sm:text-base ${
                  isListening
                    ? 'bg-destructive hover:bg-destructive/90'
                    : 'bg-brand hover:bg-brand/90'
                }`}
              >
                {isListening ? (
                  <>
                    <MicOff className="mr-2 h-4 w-4" />
                    Stop Test
                  </>
                ) : (
                  <>
                    <Mic className="mr-2 h-4 w-4" />
                    Start Test
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
