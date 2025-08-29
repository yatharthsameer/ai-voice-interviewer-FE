import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useInterview, interviewActions } from "@/lib/store.tsx";
import DeviceSetup from "@/components/interview/DeviceSetup";
import { InterviewSession } from "@/components/interview/InterviewSession";

export default function Interview() {
  const { state } = useInterview();
  const [showDeviceSetup, setShowDeviceSetup] = useState(true);

  const handleStartInterview = () => {
    setShowDeviceSetup(false);
  };

  // Show device setup first, then interview session
  if (showDeviceSetup) {
    return <DeviceSetup onStartInterview={handleStartInterview} />;
  }

  return <InterviewSession />;
}