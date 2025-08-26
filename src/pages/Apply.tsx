import { useEffect } from "react";
import { useInterview, interviewActions } from "@/lib/store.tsx";
import ApplicationForm from "@/components/forms/ApplicationForm";

export default function Apply() {
  const { dispatch } = useInterview();

  useEffect(() => {
    dispatch(interviewActions.setStep(1));
  }, [dispatch]);

  return <ApplicationForm />;
}