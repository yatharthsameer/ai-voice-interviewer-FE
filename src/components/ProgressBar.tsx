import { Check } from "lucide-react";
import { useInterview } from "@/lib/store.tsx";
import { motion } from "framer-motion";

export default function ProgressBar() {
  const { state } = useInterview();
  const { currentStep, isApplicationComplete } = state;

  const steps = [
    { number: 1, label: "Application", path: "/apply" },
    { number: 2, label: "Interview", path: "/interview" },
  ];

  return (
    <div className="sticky-bottom bg-background/95 backdrop-blur-sm border-t border-border shadow-lg">
      <div className="interview-container py-4">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          {steps.map((step, index) => {
            const isActive = currentStep === step.number;
            const isCompleted = step.number < currentStep || (step.number === 1 && isApplicationComplete);
            
            return (
              <div key={step.number} className="flex items-center flex-1">
                <div className="flex items-center">
                  <motion.div
                    initial={false}
                    animate={{
                      scale: isActive ? 1.1 : 1,
                    }}
                    className={`
                      relative flex items-center justify-center w-10 h-10 rounded-full border-2 text-sm font-semibold
                      ${isCompleted 
                        ? "bg-brand text-brand-foreground border-brand" 
                        : isActive 
                          ? "bg-brand text-brand-foreground border-brand" 
                          : "bg-background text-muted-foreground border-border"
                      }
                    `}
                  >
                    {isCompleted && step.number !== currentStep ? (
                      <Check className="w-5 h-5" />
                    ) : (
                      step.number
                    )}
                  </motion.div>
                  <span 
                    className={`ml-3 text-sm font-medium ${
                      isActive ? "text-brand" : isCompleted ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
                
                {/* Progress line */}
                {index < steps.length - 1 && (
                  <div className="flex-1 mx-4">
                    <div className="h-0.5 bg-border rounded-full overflow-hidden">
                      <motion.div
                        initial={false}
                        animate={{
                          width: isCompleted ? "100%" : "0%",
                        }}
                        transition={{ duration: 0.3, ease: "easeInOut" }}
                        className="h-full bg-brand"
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}