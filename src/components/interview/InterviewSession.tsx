import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Settings, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useInterview } from "@/lib/store";
import { useInterviewSocket, InterviewType } from "@/hooks/useInterviewSocket";
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
    totalQuestions,
    isConnected,
    connect,
    retryConnection,
    startInterview,
    endInterview,
    setAudioOutputDevice,
    cleanup
  } = useInterviewSocket();

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
      cleanup();
    };
  }, [state.isApplicationComplete, state.application, navigate, toast, connect, cleanup]);

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

      // Determine interview type based on position
      let interviewType: InterviewType = "general";
      const position = state.application.position?.toLowerCase();
      if (position?.includes("nurse")) {
        interviewType = "technical";
      } else if (position?.includes("therapist")) {
        interviewType = "leadership";
      }

      // Add small delay to ensure WebSocket is fully ready
      setTimeout(() => {
        startInterview(userData, interviewType);
      }, 100);
    }
  }, [isConnected, state.application, interviewState, startInterview]);

  // Update speaker device when selection changes
  useEffect(() => {
    if (selectedSpeakerId) {
      setAudioOutputDevice(selectedSpeakerId);
    }
  }, [selectedSpeakerId, setAudioOutputDevice]);

  const handleEndInterview = () => {
    endInterview();
    toast({
      title: "Interview Ended",
      description: "Thank you for your time. You'll hear back from us soon.",
    });
    navigate("/");
  };

  const handleCameraChange = (deviceId: string) => {
    setSelectedCameraId(deviceId);
  };

  const handleSpeakerChange = (deviceId: string) => {
    setSelectedSpeakerId(deviceId);
  };

  // Redirect if no application
  if (!state.isApplicationComplete || !state.application) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo placeholder */}
            <div className="flex items-center">
              <div className="w-8 h-8 bg-brand rounded-lg flex items-center justify-center">
                <span className="text-brand-foreground font-bold text-sm">AI</span>
              </div>
            </div>

            {/* End Interview Button */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm">
                  <X className="w-4 h-4 mr-2" />
                  End Interview
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
      </header>

      {/* Main Content */}
      <main className="flex-1">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <motion.div
            className="flex flex-col items-center justify-center min-h-[calc(100vh-12rem)] space-y-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            {/* Connection Error State */}
            {interviewState === "error" && (
              <motion.div
                className="text-center space-y-4 mb-8"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="text-red-400 text-lg font-medium">Connection Error</div>
                <p className="text-muted-foreground max-w-md">
                  Unable to connect to the interview service. Please check your internet connection.
                </p>
                <Button onClick={retryConnection} variant="outline">
                  Retry Connection
                </Button>
              </motion.div>
            )}

            {/* AI Avatar */}
            <AIAvatar interviewState={interviewState} />

            {/* Current Question Display (when AI is speaking) */}
            {currentQuestion && interviewState === "aiSpeaking" && (
              <motion.div
                className="max-w-2xl text-center"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <p className="text-muted-foreground text-sm mb-2">
                  Question {questionNumber} of {totalQuestions}
                </p>
                <p className="text-lg text-foreground leading-relaxed">
                  {currentQuestion}
                </p>
              </motion.div>
            )}

            {/* Interview Type Badge */}
            {state.application?.position && (
              <motion.div
                className="px-4 py-2 bg-muted rounded-full"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                <span className="text-sm font-medium text-muted-foreground">
                  {state.application.position} Interview
                </span>
              </motion.div>
            )}

            {/* Settings Button */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <DeviceSettingsModal
                onCameraChange={handleCameraChange}
                onSpeakerChange={handleSpeakerChange}
              >
                <Button variant="outline" size="sm">
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </Button>
              </DeviceSettingsModal>
            </motion.div>
          </motion.div>
        </div>
      </main>

      {/* Self View */}
      <SelfView selectedCameraId={selectedCameraId} />
    </div>
  );
}