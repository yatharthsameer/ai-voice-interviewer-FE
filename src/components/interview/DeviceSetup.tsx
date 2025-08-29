import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Camera, Mic, Speaker, Play, RefreshCw, AlertCircle, Check, HelpCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useInterview, interviewActions } from "@/lib/store.tsx";
import { MicrophoneTest } from "./MicrophoneTest";
import { InterviewSection } from "./InterviewSection";
import { CompletionSummary } from "./CompletionSummary";

interface DeviceInfo {
  deviceId: string;
  label: string;
  kind: "videoinput" | "audioinput" | "audiooutput";
}

interface Message {
  id: string;
  type: 'ai' | 'user';
  content: string;
  timestamp: Date;
}

type InterviewPhase = "deviceSetup" | "micTest" | "interview" | "completion";

interface DeviceSetupProps {
  onStartInterview?: () => void;
}

export default function DeviceSetup({ onStartInterview }: DeviceSetupProps) {
  const { state } = useInterview();
  const [currentPhase, setCurrentPhase] = useState<InterviewPhase>("deviceSetup");
  const [interviewTranscript, setInterviewTranscript] = useState<Message[]>([]);
  const [interviewDuration, setInterviewDuration] = useState(0);
  
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>("");
  const [selectedMic, setSelectedMic] = useState<string>("");
  const [selectedSpeaker, setSelectedSpeaker] = useState<string>("");
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const [isTestingMic, setIsTestingMic] = useState(false);
  const [isTestingSpeaker, setIsTestingSpeaker] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    initializeDevices();
    return () => {
      cleanup();
    };
  }, []);

  const cleanup = () => {
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

  const initializeDevices = async () => {
    setIsLoading(true);
    try {
      // Request permissions first
      await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setPermissionsGranted(true);
      
      // Get available devices
      const deviceList = await navigator.mediaDevices.enumerateDevices();
      const processedDevices: DeviceInfo[] = deviceList
        .filter(device => device.deviceId && device.label)
        .map(device => ({
          deviceId: device.deviceId,
          label: device.label || `${device.kind} ${device.deviceId.slice(-4)}`,
          kind: device.kind as DeviceInfo["kind"],
        }));

      setDevices(processedDevices);

      // Set default devices
      const cameras = processedDevices.filter(d => d.kind === "videoinput");
      const mics = processedDevices.filter(d => d.kind === "audioinput");
      const speakers = processedDevices.filter(d => d.kind === "audiooutput");

      if (cameras.length > 0) {
        setSelectedCamera(cameras[0].deviceId);
        await startVideoStream(cameras[0].deviceId);
      }
      if (mics.length > 0) setSelectedMic(mics[0].deviceId);
      if (speakers.length > 0) setSelectedSpeaker(speakers[0].deviceId);

    } catch (error) {
      console.error("Failed to initialize devices:", error);
      setPermissionsGranted(false);
      toast({
        title: "Camera/Microphone Access Needed",
        description: "Please allow camera and microphone access to continue with your interview setup.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const startVideoStream = async (deviceId: string) => {
    try {
      if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: deviceId } },
        audio: false,
      });

      setVideoStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error("Failed to start video stream:", error);
      toast({
        title: "Camera Error",
        description: "Failed to access the selected camera. Please try another one.",
        variant: "destructive",
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
        audio: { deviceId: { exact: selectedMic } },
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
      console.error("Failed to test microphone:", error);
      setIsTestingMic(false);
      toast({
        title: "Microphone Error",
        description: "Failed to access the selected microphone.",
        variant: "destructive",
      });
    }
  };

  const testSpeaker = async () => {
    setIsTestingSpeaker(true);
    try {
      // Play a test tone
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
        title: "Test Sound Played",
        description: "Did you hear the test sound? If not, try adjusting your speaker settings.",
      });

    } catch (error) {
      console.error("Failed to test speaker:", error);
      setIsTestingSpeaker(false);
      toast({
        title: "Speaker Error",
        description: "Failed to play test sound.",
        variant: "destructive",
      });
    }
  };

  const restartDevices = () => {
    cleanup();
    initializeDevices();
  };

  const handleStartInterview = () => {
    if (!videoStream || !permissionsGranted) {
      toast({
        title: "Setup Required",
        description: "Please ensure your camera is working before starting the interview.",
        variant: "destructive",
      });
      return;
    }

    // Call the parent callback to move to interview session
    if (onStartInterview) {
      onStartInterview();
    } else {
      setCurrentPhase("micTest");
    }
  };

  const handleMicTestComplete = (passed: boolean) => {
    if (passed) {
      setCurrentPhase("interview");
    }
  };

  const handleInterviewComplete = (transcript: Message[], duration: number) => {
    setInterviewTranscript(transcript);
    setInterviewDuration(duration);
    setCurrentPhase("completion");
  };

  const handleRestart = () => {
    setCurrentPhase("deviceSetup");
    setInterviewTranscript([]);
    setInterviewDuration(0);
  };

  const cameras = devices.filter(d => d.kind === "videoinput");
  const microphones = devices.filter(d => d.kind === "audioinput");
  const speakers = devices.filter(d => d.kind === "audiooutput");

  // Render different phases
  const renderPhase = () => {
    switch (currentPhase) {
      case "micTest":
        return <MicrophoneTest onTestComplete={handleMicTestComplete} />;
      case "interview":
        return state.application ? (
          <InterviewSection
            userData={{
              firstName: state.application.firstName || '',
              lastName: state.application.lastName || '',
              email: state.application.email || '',
              phone: state.application.phone || '',
              position: state.application.position
            }}
            onComplete={handleInterviewComplete}
          />
        ) : null;
      case "completion":
        return state.application ? (
          <CompletionSummary
            userData={{
              firstName: state.application.firstName || '',
              lastName: state.application.lastName || '',
              email: state.application.email || '',
              phone: state.application.phone || ''
            }}
            transcript={interviewTranscript}
            duration={interviewDuration}
            onRestart={handleRestart}
          />
        ) : null;
      default:
        return renderDeviceSetup();
    }
  };

  const renderDeviceSetup = () => (
    <div className="interview-container py-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Panel - Camera Preview */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-foreground mb-2">Senior Professional Interview</h1>
              <p className="text-muted-foreground">Tell us about your experiences in the industry</p>
            </div>

            {/* Video Preview */}
            <Card>
              <CardContent className="p-0">
                <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
                  {permissionsGranted && videoStream ? (
                    <video
                      ref={videoRef}
                      autoPlay
                      muted
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      <div className="text-center space-y-2">
                        <Camera className="w-12 h-12 mx-auto opacity-50" />
                        <p className="text-sm">Camera preview will appear here</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Device Controls */}
            {!permissionsGranted ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Camera and microphone access is required for the interview.{" "}
                  <Button
                    variant="link"
                    onClick={initializeDevices}
                    className="p-0 h-auto font-medium text-brand"
                  >
                    Grant permissions
                  </Button>
                </AlertDescription>
              </Alert>
            ) : (
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg">Device Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Camera Selection */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-full bg-brand/10 flex items-center justify-center">
                        <Camera className="w-4 h-4 text-brand" />
                      </div>
                      <div className="flex-1">
                        <Select value={selectedCamera} onValueChange={(value) => {
                          setSelectedCamera(value);
                          startVideoStream(value);
                        }}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select camera" />
                          </SelectTrigger>
                          <SelectContent>
                            {cameras.map((device) => (
                              <SelectItem key={device.deviceId} value={device.deviceId}>
                                {device.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {/* Microphone Selection & Test */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3 flex-1">
                        <div className="w-8 h-8 rounded-full bg-brand/10 flex items-center justify-center">
                          <Mic className="w-4 h-4 text-brand" />
                        </div>
                        <Select value={selectedMic} onValueChange={setSelectedMic}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select microphone" />
                          </SelectTrigger>
                          <SelectContent>
                            {microphones.map((device) => (
                              <SelectItem key={device.deviceId} value={device.deviceId}>
                                {device.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={testMicrophone}
                        className={`ml-3 ${isTestingMic ? "bg-brand text-brand-foreground" : ""}`}
                      >
                        {isTestingMic ? "Stop Test" : "Test Mic"}
                      </Button>
                    </div>
                    
                    {isTestingMic && (
                      <div className="flex items-center space-x-3 pl-11">
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <motion.div
                            className="h-full bg-brand"
                            style={{ width: `${micLevel}%` }}
                            transition={{ duration: 0.1 }}
                          />
                        </div>
                        <span className="text-sm text-muted-foreground w-10 text-right">
                          {Math.round(micLevel)}%
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Speaker Selection & Test */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3 flex-1">
                      <div className="w-8 h-8 rounded-full bg-brand/10 flex items-center justify-center">
                        <Speaker className="w-4 h-4 text-brand" />
                      </div>
                      <Select value={selectedSpeaker} onValueChange={setSelectedSpeaker}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select speaker" />
                        </SelectTrigger>
                        <SelectContent>
                          {speakers.map((device) => (
                            <SelectItem key={device.deviceId} value={device.deviceId}>
                              {device.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={testSpeaker}
                      disabled={isTestingSpeaker}
                      className="ml-3"
                    >
                      {isTestingSpeaker ? (
                        <>
                          <Play className="w-3 h-3 mr-1 animate-pulse" />
                          Playing...
                        </>
                      ) : (
                        <>
                          <Play className="w-3 h-3 mr-1" />
                          Test Sound
                        </>
                      )}
                    </Button>
                  </div>

                  {/* Restart Devices */}
                  <div className="pt-2 border-t">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={restartDevices}
                      disabled={isLoading}
                      className="w-full"
                    >
                      <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
                      Restart Devices
                    </Button>
                  </div>

                  {/* Device Info */}
                  {selectedCamera && selectedMic && (
                    <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
                      <p>Camera: {cameras.find(d => d.deviceId === selectedCamera)?.label}</p>
                      <p>Microphone: {microphones.find(d => d.deviceId === selectedMic)?.label}</p>
                      <p>Speaker: {speakers.find(d => d.deviceId === selectedSpeaker)?.label}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </motion.div>

        {/* Right Panel - Interview Checklist */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="space-y-6"
        >
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Get ready for your AI interview</CardTitle>
              <CardDescription>
                Please review the checklist below before starting your interview
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Checklist */}
              <div className="space-y-4">
                {[
                  { text: "Start now or come back later", completed: true },
                  { text: "Expect to spend 14 minutes", completed: true },
                  { text: "Check your device settings", completed: permissionsGranted && videoStream },
                  { text: "Find a quiet place with stable internet", completed: false },
                ].map((item, index) => (
                  <div key={index} className="flex items-center space-x-3">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                      item.completed ? "bg-success text-success-foreground" : "bg-muted"
                    }`}>
                      {item.completed && <Check className="w-3 h-3" />}
                    </div>
                    <span className={`text-sm ${item.completed ? "text-foreground" : "text-muted-foreground"}`}>
                      {item.text}
                    </span>
                  </div>
                ))}
              </div>

              {/* Start Interview Button */}
              <Button
                onClick={handleStartInterview}
                disabled={!permissionsGranted || !videoStream}
                className="w-full h-12 text-base font-semibold"
              >
                Start Interview
              </Button>

              {/* Secondary Actions */}
              <div className="grid grid-cols-2 gap-3">
                <Button variant="ghost" className="h-10">
                  <HelpCircle className="w-4 h-4 mr-2" />
                  FAQs
                </Button>
                <Button variant="ghost" className="h-10">
                  <AlertCircle className="w-4 h-4 mr-2" />
                  Having Issues?
                </Button>
              </div>

              {/* Disclaimer */}
              <div className="bg-muted/50 p-4 rounded-lg">
                <p className="text-xs text-muted-foreground">
                  This interview uses generative AI to assess your responses. Your answers are used only to evaluate your candidacy and are never used to train AI models. All data is processed securely and in compliance with privacy regulations.
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );

  return <div className="min-h-screen bg-background">{renderPhase()}</div>;
}