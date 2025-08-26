import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useInterview, interviewActions } from "@/lib/store.tsx";
import { useToast } from "@/hooks/use-toast";
import DeviceSetup from "@/components/interview/DeviceSetup";

export default function Interview() {
  const { state, dispatch } = useInterview();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Check if application is complete
    if (!state.isApplicationComplete || !state.application) {
      toast({
        title: "Application Required",
        description: "Please complete your application first.",
        variant: "destructive",
      });
      navigate("/");
      return;
    }

    dispatch(interviewActions.setStep(2));
  }, [state.isApplicationComplete, state.application, dispatch, navigate, toast]);

  if (!state.isApplicationComplete || !state.application) {
    return null; // Will redirect
  }

  return <DeviceSetup />;
}