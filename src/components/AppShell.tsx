import { Building2 } from "lucide-react";
import { Button } from "./ui/button";
import ProgressBar from "./ProgressBar";
import { useLocation } from "react-router-dom";

interface AppShellProps {
  children: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const location = useLocation();
  const isInterviewPage = location.pathname === '/interview';
  
  return (
    <div className="min-h-screen bg-background">
      {/* Header - Hidden during interview for clean UI */}
      {!isInterviewPage && (
        <header className="border-b border-border bg-background/95 backdrop-blur-sm sticky top-0 z-40">
        <div className="interview-container py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-brand rounded-lg flex items-center justify-center">
                <Building2 className="w-5 h-5 text-brand-foreground" />
              </div>
              <span className="font-semibold text-foreground hidden sm:inline">HealthCare Pro</span>
            </div>

            {/* Header Actions */}
            <div className="flex items-center space-x-2">
              <Button variant="ghost" size="sm" asChild>
                <a href="#" className="text-sm text-muted-foreground hover:text-foreground">
                  Back to dashboard
                </a>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <a href="#" className="text-sm text-muted-foreground hover:text-foreground">
                  Questions?
                </a>
              </Button>
            </div>
          </div>
        </div>
      </header>
      )}

      {/* Main Content */}
      <main className={isInterviewPage ? "" : "pb-24"}>
        {children}
      </main>

      {/* Progress Bar - Hidden during interview for clean UI */}
      {!isInterviewPage && <ProgressBar />}
    </div>
  );
}