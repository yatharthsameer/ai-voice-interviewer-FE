import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Mic, MicOff, Video, VideoOff, Settings, PhoneOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useInterview } from "@/lib/store";
import { useSimpleInterview, InterviewState } from "@/hooks/useSimpleInterview";
import { AIAvatar } from "./AIAvatar";
import { SelfView } from "./SelfView";
import { DeviceSettingsModal } from "./DeviceSettingsModal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function InterviewSession() {
  const { state } = useInterview();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");
  const [selectedSpeakerId, setSelectedSpeakerId] = useState<string>("");

  const {
    state: interviewState,
    sessionId,
    currentQuestion,
    questionNumber,
    isConnected,
    connect,
    startInterview,
    endInterview,
    disconnect
  } = useSimpleInterview(navigate);

  // Load saved device preferences
  useEffect(() => {
    const savedCamera = localStorage.getItem("selectedCamera");
    const savedSpeaker = localStorage.getItem("selectedSpeaker");
    
    if (savedCamera) setSelectedCameraId(savedCamera);
    if (savedSpeaker) setSelectedSpeakerId(savedSpeaker);
  }, []);

  // Connect and start interview on mount
  useEffect(() => {
    console.log('InterviewSession: Component mounted, checking application state...');
    
    if (!state.isApplicationComplete || !state.application) {
      console.log('InterviewSession: Application not complete, redirecting...');
      toast({
        title: "Application Required",
        description: "Please complete your application first.",
        variant: "destructive",
      });
      navigate("/");
      return;
    }

    console.log('InterviewSession: Application complete, initializing WebSocket connection...');
    connect();

    return () => {
      console.log('InterviewSession: Cleaning up on unmount...');
      disconnect();
    };
  }, [state.isApplicationComplete, state.application, navigate, toast, connect, disconnect]);

  // Auto-start interview when connected (with small delay to ensure WebSocket is ready)
  useEffect(() => {
    if (isConnected && state.application && interviewState === "ready") {
      const userData = {
        firstName: state.application.firstName || '',
        lastName: state.application.lastName || '',
        email: state.application.email || '',
        phone: state.application.phone || '',
        position: state.application.position || ''
      };

      // Add small delay to ensure WebSocket is fully ready
      setTimeout(() => {
        startInterview(userData, "general");
      }, 100);
    }
  }, [isConnected, state.application, interviewState, startInterview]);

  const handleEndInterview = () => {
    endInterview();
    toast({
      title: "Interview Ended",
      description: "Thank you for your time. You'll hear back from us soon.",
    });
    navigate("/");
  };

  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);

  // Redirect if no application
  if (!state.isApplicationComplete || !state.application) {
    return null;
  }

  return (
    <div className="min-h-screen bg-green-600 relative overflow-hidden">
      {/* Main Content - Google Meet Style */}
      <main className="flex-1 relative">
        <div className="flex flex-col items-center justify-center min-h-screen space-y-8">
          {/* Centered Avatar */}
          <motion.div
            className="flex flex-col items-center space-y-4"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            {/* Large Circular Avatar */}
            <div className="relative">
              <motion.div
                className="w-48 h-48 bg-green-500 rounded-full flex items-center justify-center shadow-2xl"
                animate={{
                  scale: interviewState === "speaking" ? 1.05 : interviewState === "listening" ? 1.02 : 1,
                }}
                transition={{ duration: 0.3 }}
              >
                <span className="text-white text-6xl font-semibold">
                  {state.application?.firstName?.charAt(0)?.toUpperCase() || "A"}
                </span>
              </motion.div>
              
              {/* Status indicator ring */}
              {(interviewState === "speaking" || interviewState === "listening") && (
                <motion.div
                  className={`absolute inset-0 rounded-full border-4 ${
                    interviewState === "speaking" ? "border-white" : "border-green-300"
                  }`}
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              )}
            </div>

            {/* User Name */}
            <div className="text-center">
              <h2 className="text-white text-2xl font-semibold">
                {state.application?.firstName} {state.application?.lastName}
              </h2>
              
              {/* Status Text */}
              <p className="text-green-100 text-lg mt-2">
                {interviewState === "connecting" && "Connecting..."}
                {interviewState === "ready" && "Ready to begin"}
                {interviewState === "speaking" && "AI is speaking"}
                {interviewState === "listening" && "Listening..."}
                {interviewState === "interviewing" && "Interview in progress"}
                {interviewState === "completed" && "Interview completed"}
                {interviewState === "error" && "Connection error"}
              </p>
            </div>
          </motion.div>
        </div>
      </main>

      {/* Self View Video - Bottom Right */}
      <div className="fixed bottom-20 right-4 md:bottom-24 md:right-6 z-10">
        <motion.div
          className="w-32 h-24 md:w-40 md:h-28 bg-gray-900 rounded-lg overflow-hidden shadow-lg border-2 border-white/20"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
        >
          <SelfView selectedCameraId={selectedCameraId} className="w-full h-full" />
          <div className="absolute bottom-1 left-1 text-white text-xs bg-black/50 px-1 rounded">
            {state.application?.firstName}
          </div>
        </motion.div>
      </div>

      {/* Bottom Control Bar - Google Meet Style */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-900/95 backdrop-blur-sm border-t border-gray-700">
        <div className="flex items-center justify-center py-4 px-4">
          <div className="flex items-center space-x-4">
            {/* Mute Button */}
            <Button
              variant="ghost"
              size="lg"
              className={`w-12 h-12 rounded-full ${
                isMuted 
                  ? "bg-red-600 hover:bg-red-700 text-white" 
                  : "bg-gray-700 hover:bg-gray-600 text-white"
              }`}
              onClick={() => setIsMuted(!isMuted)}
            >
              {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </Button>

            {/* Camera Button */}
            <Button
              variant="ghost"
              size="lg"
              className={`w-12 h-12 rounded-full ${
                isCameraOff 
                  ? "bg-red-600 hover:bg-red-700 text-white" 
                  : "bg-gray-700 hover:bg-gray-600 text-white"
              }`}
              onClick={() => setIsCameraOff(!isCameraOff)}
            >
              {isCameraOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
            </Button>

            {/* Settings Button */}
            <DeviceSettingsModal
              onCameraChange={(deviceId) => setSelectedCameraId(deviceId)}
              onSpeakerChange={(deviceId) => setSelectedSpeakerId(deviceId)}
            >
              <Button
                variant="ghost"
                size="lg"
                className="w-12 h-12 rounded-full bg-gray-700 hover:bg-gray-600 text-white"
              >
                <Settings className="w-5 h-5" />
              </Button>
            </DeviceSettingsModal>

            {/* End Interview Button */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="lg"
                  className="w-12 h-12 rounded-full bg-red-600 hover:bg-red-700 text-white"
                >
                  <PhoneOff className="w-5 h-5" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>End Interview?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to end the interview? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Continue</AlertDialogCancel>
                  <AlertDialogAction onClick={handleEndInterview}>
                    End Interview
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>
    </div>
  );
}