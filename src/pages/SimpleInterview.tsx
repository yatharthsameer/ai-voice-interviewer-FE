import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Camera, Mic, Volume2, Square, Settings, Loader2, RefreshCw, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  
  // Device selection state
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>('');
  const [selectedMicrophone, setSelectedMicrophone] = useState<string>('');
  const [selectedSpeaker, setSelectedSpeaker] = useState<string>('');
  const [isTestingMic, setIsTestingMic] = useState(false);
  const [isTestingSpeaker, setIsTestingSpeaker] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  
  // Audio context refs for mic testing
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const interviewVideoRef = useRef<HTMLVideoElement>(null);
  
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
      // Cleanup all streams and audio contexts
      if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
      }
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  const handleBeginInterview = useCallback(() => {
    if (!appState.application || !isConnected) return;
    
    const userData: UserData = {
      firstName: appState.application.firstName || '',
      lastName: appState.application.lastName || '',
      email: appState.application.email || '',
      phone: appState.application.phone || '',
      position: appState.application.position || ''
    };
    
    startInterview(userData, 'general');
  }, [appState.application, isConnected, startInterview]);

  // Connect WebSocket when moving to interview phase
  useEffect(() => {
    if (phase === 'interview') {
      connect();
      return () => disconnect();
    }
  }, [phase, connect, disconnect]);

  // Auto-start interview when connected and in interview phase
  useEffect(() => {
    if (phase === 'interview' && isConnected && interviewState === 'ready' && appState.application) {
      // Automatically start the interview
      handleBeginInterview();
    }
  }, [phase, isConnected, interviewState, appState.application, handleBeginInterview]);

  // Ensure video element gets the stream when videoStream changes
  useEffect(() => {
    if (videoStream && videoRef.current) {
      console.log('Effect: Setting video stream to element:', videoStream);
      console.log('Video element:', videoRef.current);
      console.log('Video tracks in stream:', videoStream.getVideoTracks());
      
      videoRef.current.srcObject = videoStream;
      
      // Force play and log result
      videoRef.current.play()
        .then(() => {
          console.log('✅ Video playing successfully');
        })
        .catch((error) => {
          console.error('❌ Video play failed:', error);
        });
    } else {
      console.log('❌ Missing videoStream or videoRef:', { videoStream, videoRef: videoRef.current });
    }
  }, [videoStream]);

  // Handle interview video element when phase changes to interview
  useEffect(() => {
    if (phase === 'interview' && videoStream && interviewVideoRef.current) {
      console.log('Setting up interview video element with stream:', videoStream);
      console.log('Interview video element:', interviewVideoRef.current);
      console.log('Video tracks for interview:', videoStream.getVideoTracks());
      
      interviewVideoRef.current.srcObject = videoStream;
      
      // Force play and log result
      interviewVideoRef.current.play()
        .then(() => {
          console.log('✅ Interview video playing successfully');
        })
        .catch((error) => {
          console.error('❌ Interview video play failed:', error);
        });
    }
  }, [phase, videoStream]);

  const checkDevices = async () => {
    try {
      console.log('🔍 Starting device check...');
      
      // Request camera and microphone access first
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      
      console.log('📹 Got media stream:', stream);
      console.log('📹 Video tracks:', stream.getVideoTracks());
      console.log('🎤 Audio tracks:', stream.getAudioTracks());
      
      // Get available devices after permissions are granted
      const deviceList = await navigator.mediaDevices.enumerateDevices();
      console.log('🔌 Available devices:', deviceList);
      setDevices(deviceList);
      
      // Filter devices by type
      const cameras = deviceList.filter(device => device.kind === 'videoinput');
      const microphones = deviceList.filter(device => device.kind === 'audioinput');
      const speakers = deviceList.filter(device => device.kind === 'audiooutput');
      
      console.log('📷 Cameras found:', cameras);
      console.log('🎤 Microphones found:', microphones);
      console.log('🔊 Speakers found:', speakers);
      
      // Set default devices if not already selected
      if (!selectedCamera && cameras.length > 0) {
        setSelectedCamera(cameras[0].deviceId);
      }
      if (!selectedMicrophone && microphones.length > 0) {
        setSelectedMicrophone(microphones[0].deviceId);
      }
      if (!selectedSpeaker && speakers.length > 0) {
        setSelectedSpeaker(speakers[0].deviceId);
      }
      
      // Set stream and status
      setVideoStream(stream);
      setHasCamera(stream.getVideoTracks().length > 0);
      setHasMicrophone(stream.getAudioTracks().length > 0);
      
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
    
    console.log('🚀 Starting interview with video stream:', videoStream);
    console.log('📹 Video tracks before transition:', videoStream?.getVideoTracks());
    
    // Move to interview phase and auto-start
    setPhase('interview');
  };

  const handleCameraChange = async (deviceId: string) => {
    console.log('🔄 Changing camera to:', deviceId);
    setSelectedCamera(deviceId);
    try {
      // Stop current video stream
      if (videoStream) {
        videoStream.getVideoTracks().forEach(track => track.stop());
      }
      
      // Get new video stream with selected camera
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: deviceId } },
        audio: false
      });
      
      console.log('📹 New camera stream:', newStream);
      
      // Combine with existing audio tracks if any
      const audioTracks = videoStream?.getAudioTracks() || [];
      const combinedStream = new MediaStream([
        ...newStream.getVideoTracks(),
        ...audioTracks
      ]);
      
      console.log('🔗 Combined stream:', combinedStream);
      setVideoStream(combinedStream);
      
      // Update video element
      if (videoRef.current) {
        console.log('Updating video with new stream:', combinedStream);
        console.log('New video tracks:', combinedStream.getVideoTracks());
        videoRef.current.srcObject = combinedStream;
        videoRef.current.play().catch(console.error);
      }
      
      setHasCamera(true);
      
    } catch (error) {
      console.error('Failed to change camera:', error);
      toast({
        title: 'Camera Error',
        description: 'Failed to switch to selected camera.',
        variant: 'destructive'
      });
    }
  };

  const testMicrophone = async () => {
    if (isTestingMic) {
      // Stop testing
      setIsTestingMic(false);
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach(track => track.stop());
        micStreamRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      setMicLevel(0);
      return;
    }

    try {
      setIsTestingMic(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: selectedMicrophone } },
        video: false,
      });

      micStreamRef.current = stream;
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);

      analyserRef.current.fftSize = 256;
      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateMicLevel = () => {
        if (!isTestingMic) return;
        
        analyserRef.current?.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / bufferLength;
        setMicLevel(Math.min(100, (average / 128) * 100));
        requestAnimationFrame(updateMicLevel);
      };

      updateMicLevel();

    } catch (error) {
      console.error('Failed to test microphone:', error);
      setIsTestingMic(false);
      toast({
        title: 'Microphone Error',
        description: 'Failed to access the selected microphone.',
        variant: 'destructive',
      });
    }
  };

  const testSpeaker = async () => {
    setIsTestingSpeaker(true);
    try {
      // Create a test tone
      const audioContext = new AudioContext();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 440; // A4 note
      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 1);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 1);

      setTimeout(() => {
        setIsTestingSpeaker(false);
        audioContext.close();
      }, 1000);

      toast({
        title: 'Test Sound Played',
        description: 'Did you hear the test sound? If not, try adjusting your speaker settings.',
      });

    } catch (error) {
      console.error('Failed to test speaker:', error);
      setIsTestingSpeaker(false);
      toast({
        title: 'Speaker Error',
        description: 'Failed to play test sound.',
        variant: 'destructive',
      });
    }
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
      videoRef.current.play().catch(console.error);
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
                <div className="aspect-video bg-muted rounded-lg overflow-hidden mb-4 relative">
                  {videoStream ? (
                    <>
                      <video
                        ref={videoRef}
                        autoPlay
                        muted
                        playsInline
                        className="w-full h-full object-cover"
                        style={{ backgroundColor: '#000' }}
                        onLoadedMetadata={() => {
                          console.log('Video metadata loaded');
                          // Ensure video plays when metadata is loaded
                          if (videoRef.current) {
                            videoRef.current.play().catch(console.error);
                          }
                        }}
                        onCanPlay={() => {
                          console.log('Video can play');
                        }}
                        onError={(e) => {
                          console.error('Video error:', e);
                        }}
                        onLoadStart={() => {
                          console.log('Video load start');
                        }}
                      />
                      {/* Debug overlay */}
                      <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                        {videoStream.getVideoTracks().length > 0 ? 'Stream Active' : 'No Video Track'}
                      </div>
                    </>
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

            {/* Device Settings & Checklist */}
            <Card>
              <CardHeader>
                <CardTitle>Device Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Camera Selection */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Camera className="w-4 h-4" />
                    <span className="text-sm font-medium">Camera</span>
                  </div>
                  <Select value={selectedCamera} onValueChange={handleCameraChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select camera" />
                    </SelectTrigger>
                    <SelectContent>
                      {devices.filter(d => d.kind === 'videoinput').map((device) => (
                        <SelectItem key={device.deviceId} value={device.deviceId}>
                          {device.label || `Camera ${device.deviceId.slice(-4)}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Microphone Selection & Test */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Mic className="w-4 h-4" />
                    <span className="text-sm font-medium">Microphone</span>
                  </div>
                  <div className="flex gap-2">
                    <Select value={selectedMicrophone} onValueChange={setSelectedMicrophone}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select microphone" />
                      </SelectTrigger>
                      <SelectContent>
                        {devices.filter(d => d.kind === 'audioinput').map((device) => (
                          <SelectItem key={device.deviceId} value={device.deviceId}>
                            {device.label || `Microphone ${device.deviceId.slice(-4)}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={testMicrophone}
                      className={isTestingMic ? "bg-green-500 text-white" : ""}
                    >
                      {isTestingMic ? "Stop" : "Test"}
                    </Button>
                  </div>
                  
                  {/* Microphone Level */}
                  {isTestingMic && (
                    <div className="flex items-center gap-2">
                      <Volume2 className="w-4 h-4 text-muted-foreground" />
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-green-500"
                          style={{ width: `${micLevel}%` }}
                          transition={{ duration: 0.1 }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-8 text-right">
                        {Math.round(micLevel)}%
                      </span>
                    </div>
                  )}
                </div>

                {/* Speaker Selection & Test */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Volume2 className="w-4 h-4" />
                    <span className="text-sm font-medium">Speaker</span>
                  </div>
                  <div className="flex gap-2">
                    <Select value={selectedSpeaker} onValueChange={setSelectedSpeaker}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select speaker" />
                      </SelectTrigger>
                      <SelectContent>
                        {devices.filter(d => d.kind === 'audiooutput').map((device) => (
                          <SelectItem key={device.deviceId} value={device.deviceId}>
                            {device.label || `Speaker ${device.deviceId.slice(-4)}`}
                          </SelectItem>
                        ))}
                        {devices.filter(d => d.kind === 'audiooutput').length === 0 && (
                          <SelectItem value="default" disabled>
                            Default Speaker (Browser controlled)
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={testSpeaker}
                      disabled={isTestingSpeaker}
                    >
                      {isTestingSpeaker ? (
                        <>
                          <Play className="w-3 h-3 mr-1 animate-pulse" />
                          Playing
                        </>
                      ) : (
                        <>
                          <Play className="w-3 h-3 mr-1" />
                          Test
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Status Checklist */}
                <div className="space-y-3 pt-4 border-t">
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
                  <RefreshCw className="w-4 h-4 mr-2" />
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

            {/* Auto-starting message */}
            {interviewState === 'ready' && (
              <div className="text-center">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                <p className="text-muted-foreground">Starting interview...</p>
              </div>
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
            ref={interviewVideoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
            style={{ backgroundColor: '#000' }}
            onLoadedMetadata={() => {
              console.log('Interview video metadata loaded');
              // Ensure video plays when metadata is loaded
              if (interviewVideoRef.current) {
                interviewVideoRef.current.play().catch(console.error);
              }
            }}
            onCanPlay={() => {
              console.log('Interview video can play');
            }}
            onError={(e) => {
              console.error('Interview video error:', e);
            }}
          />
          <div className="absolute bottom-2 left-2 text-xs text-white bg-black/50 px-2 py-1 rounded">
            You
          </div>
          {/* Recording indicator */}
          <div className="absolute top-2 left-2">
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className="text-xs text-white font-medium px-1 bg-black/50 rounded">
                LIVE
              </span>
            </div>
          </div>
          {/* Debug info */}
          <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-1 py-0.5 rounded">
            {videoStream.getVideoTracks().length > 0 ? 'Active' : 'No Track'}
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
