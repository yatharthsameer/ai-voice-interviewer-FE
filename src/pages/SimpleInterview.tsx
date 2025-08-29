import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Camera, Mic, Volume2, Square, Settings, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useInterview } from '@/lib/store';
import { useSimpleInterview, UserData } from '@/hooks/useSimpleInterview';
import DeviceSettingsDialog from '@/components/interview/DeviceSettingsDialog';

type Phase = 'deviceCheck' | 'interview';

export default function SimpleInterview() {
  const navigate = useNavigate();
  const { state: appState } = useInterview();
  const { toast } = useToast();
  
  const [phase, setPhase] = useState<Phase>('deviceCheck');
  const [hasCamera, setHasCamera] = useState(false);
  const [hasMicrophone, setHasMicrophone] = useState(false);
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const {
    state: interviewState,
    currentQuestion,
    questionNumber,
    isConnected,
    connect,
    startInterview,
    endInterview,
    disconnect,
    startListening
  } = useSimpleInterview(navigate);

  // Check if application is complete
  useEffect(() => {
    if (!appState.isApplicationComplete || !appState.application) {
      toast({
        title: 'Application Required',
        description: 'Please complete your application first.',
        variant: 'destructive'
      });
      navigate('/');
    }
  }, [appState, navigate, toast]);

  // Initialize devices
  useEffect(() => {
    checkDevices();
    return () => {
      if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Connect WebSocket when moving to interview phase
  useEffect(() => {
    if (phase === 'interview') {
      connect();
      return () => disconnect();
    }
  }, [phase, connect, disconnect]);

  const checkDevices = async () => {
    try {
      // Request camera and microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      
      setVideoStream(stream);
      setHasCamera(true);
      setHasMicrophone(true);
      
      // Display video preview
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      
      console.log('✅ Device permissions granted');
      
    } catch (error) {
      console.error('❌ Device access failed:', error);
      toast({
        title: 'Device Access Required',
        description: 'Please allow camera and microphone access to continue.',
        variant: 'destructive'
      });
    }
  };

  const handleStartInterview = () => {
    if (!hasCamera || !hasMicrophone) {
      toast({
        title: 'Device Check Required',
        description: 'Please ensure camera and microphone are working.',
        variant: 'destructive'
      });
      return;
    }
    
    setPhase('interview');
  };

  const handleBeginInterview = () => {
    if (!appState.application || !isConnected) return;
    
    const userData: UserData = {
      firstName: appState.application.firstName || '',
      lastName: appState.application.lastName || '',
      email: appState.application.email || '',
      phone: appState.application.phone || '',
      position: appState.application.position || ''
    };
    
    startInterview(userData, 'general');
  };

  const handleDeviceChange = (newStream: MediaStream) => {
    // Stop old stream
    if (videoStream) {
      videoStream.getTracks().forEach(track => track.stop());
    }
    
    // Update video stream
    setVideoStream(newStream);
    
    // Update video element
    if (videoRef.current) {
      videoRef.current.srcObject = newStream;
    }
    
    // Check if devices are working
    const videoTracks = newStream.getVideoTracks();
    const audioTracks = newStream.getAudioTracks();
    
    setHasCamera(videoTracks.length > 0);
    setHasMicrophone(audioTracks.length > 0);
  };

  const getStateDisplay = () => {
    switch (interviewState) {
      case 'connecting': return 'Connecting...';
      case 'ready': return 'Ready to start';
      case 'interviewing': return 'Interview in progress';
      case 'speaking': return 'AI is speaking...';
      case 'listening': return 'Listening...';
      case 'completed': return 'Interview completed';
      case 'error': return 'Connection error';
      default: return 'Ready';
    }
  };

  const getStateColor = () => {
    switch (interviewState) {
      case 'listening': return 'text-green-500';
      case 'speaking': return 'text-blue-500';
      case 'error': return 'text-red-500';
      case 'completed': return 'text-purple-500';
      default: return 'text-gray-500';
    }
  };

  if (phase === 'deviceCheck') {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <h1 className="text-3xl font-bold mb-2">Device Setup</h1>
            <p className="text-muted-foreground">
              Let's make sure your camera and microphone are working
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Video Preview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Camera className="w-5 h-5" />
                  Camera Test
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="aspect-video bg-muted rounded-lg overflow-hidden mb-4">
                  {videoStream ? (
                    <video
                      ref={videoRef}
                      autoPlay
                      muted
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Camera className="w-12 h-12 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {hasCamera ? (
                    <div className="flex items-center gap-2 text-green-600">
                      <div className="w-2 h-2 bg-green-600 rounded-full" />
                      <span className="text-sm">Camera working</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-red-600">
                      <div className="w-2 h-2 bg-red-600 rounded-full" />
                      <span className="text-sm">Camera not detected</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Device Checklist */}
            <Card>
              <CardHeader>
                <CardTitle>Ready to Start?</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                      hasCamera ? 'bg-green-500' : 'bg-gray-300'
                    }`}>
                      {hasCamera && <Camera className="w-3 h-3 text-white" />}
                    </div>
                    <span className="text-sm">Camera access granted</span>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                      hasMicrophone ? 'bg-green-500' : 'bg-gray-300'
                    }`}>
                      {hasMicrophone && <Mic className="w-3 h-3 text-white" />}
                    </div>
                    <span className="text-sm">Microphone access granted</span>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                      <Volume2 className="w-3 h-3 text-white" />
                    </div>
                    <span className="text-sm">Find a quiet environment</span>
                  </div>
                </div>

                <Alert>
                  <AlertDescription>
                    This interview will be conducted using AI. Speak clearly and naturally.
                    The interview will be hands-free - just speak when prompted.
                  </AlertDescription>
                </Alert>

                <Button
                  onClick={handleStartInterview}
                  disabled={!hasCamera || !hasMicrophone}
                  className="w-full h-12"
                >
                  Start Interview
                </Button>

                <Button
                  onClick={checkDevices}
                  variant="outline"
                  className="w-full"
                >
                  Retry Device Check
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // Interview Phase
  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Header */}
      <header className="border-b p-4 flex-shrink-0">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold">AI Interview</h1>
            <div className={`text-sm ${getStateColor()}`}>
              {getStateDisplay()}
            </div>
          </div>
        </div>
      </header>

      {/* Main Interview Area */}
      <main className="flex-1 flex flex-col justify-center p-4">
        <div className="max-w-4xl mx-auto w-full">
          <div className="flex flex-col items-center justify-center space-y-8">
            
            {/* AI Avatar */}
            <motion.div
              className="w-48 h-48 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-6xl font-bold"
              animate={{
                scale: interviewState === 'speaking' ? [1, 1.05, 1] : 1,
                boxShadow: interviewState === 'listening' 
                  ? ['0 0 0 0 rgba(34, 197, 94, 0.4)', '0 0 0 20px rgba(34, 197, 94, 0)', '0 0 0 0 rgba(34, 197, 94, 0.4)']
                  : '0 0 0 0 rgba(34, 197, 94, 0)'
              }}
              transition={{
                duration: interviewState === 'speaking' ? 2 : 1.5,
                repeat: interviewState === 'speaking' || interviewState === 'listening' ? Infinity : 0
              }}
            >
              AI
            </motion.div>

            {/* Current Question */}
            {currentQuestion && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-2xl text-center"
              >
                <p className="text-sm text-muted-foreground mb-2">
                  Question {questionNumber}
                </p>
                <p className="text-lg leading-relaxed">
                  {currentQuestion}
                </p>
              </motion.div>
            )}

            {/* Connection Status */}
            {interviewState === 'connecting' && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Connecting to interview service...</span>
              </div>
            )}

            {/* Ready to Start */}
            {interviewState === 'ready' && (
              <Button
                onClick={handleBeginInterview}
                size="lg"
                className="px-8"
              >
                Begin Interview
              </Button>
            )}





          </div>
        </div>
      </main>

      {/* Bottom Controls */}
      <footer className="border-t p-4 flex-shrink-0">
        <div className="max-w-4xl mx-auto flex items-center justify-center gap-4">
          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
            onClick={() => setShowSettings(true)}
          >
            <Settings className="w-4 h-4" />
            Settings
          </Button>
          
          <Button
            onClick={endInterview}
            variant="destructive"
            size="sm"
            className="flex items-center gap-2"
          >
            <Square className="w-4 h-4" />
            End Interview
          </Button>
        </div>
      </footer>

      {/* Video Preview */}
      {videoStream && (
        <div className="fixed bottom-24 right-4 w-48 h-36 bg-black rounded-lg overflow-hidden border-2 border-border shadow-lg">
          <video
            ref={videoRef}
            autoPlay
            muted
            className="w-full h-full object-cover"
          />
          <div className="absolute bottom-2 left-2 text-xs text-white bg-black/50 px-2 py-1 rounded">
            You
          </div>
        </div>
      )}

      {/* Device Settings Dialog */}
      <DeviceSettingsDialog
        open={showSettings}
        onOpenChange={setShowSettings}
        currentVideoStream={videoStream}
        onDeviceChange={handleDeviceChange}
      />
    </div>
  );
}
