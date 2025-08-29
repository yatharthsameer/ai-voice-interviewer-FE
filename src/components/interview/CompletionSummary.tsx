import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useIsMobile } from '@/hooks/use-mobile';
import { 
  Download, 
  Mail, 
  Clock, 
  MessageSquare, 
  CheckCircle, 
  Sparkles,
  FileText,
  Volume2
} from 'lucide-react';

interface Message {
  id: string;
  type: 'ai' | 'user';
  content: string;
  timestamp: Date;
}

interface UserFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

interface CompletionSummaryProps {
  userData: UserFormData;
  transcript: Message[];
  duration: number;
  onRestart: () => void;
}

export function CompletionSummary({ 
  userData, 
  transcript, 
  duration, 
  onRestart 
}: CompletionSummaryProps) {
  const [emailSent, setEmailSent] = useState(false);
  const [showConfetti, setShowConfetti] = useState(true);
  const isMobile = useIsMobile();

  const formatDuration = (milliseconds: number) => {
    const minutes = Math.floor(milliseconds / 60000);
    const seconds = Math.floor((milliseconds % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  };

  const getHighlights = () => {
    const userMessages = transcript.filter(msg => msg.type === 'user');
    return userMessages.slice(0, 3).map(msg => 
      msg.content.substring(0, 100) + (msg.content.length > 100 ? '...' : '')
    );
  };

  const handleDownloadTranscript = () => {
    const transcriptText = transcript.map(msg => 
      `[${msg.timestamp.toLocaleTimeString()}] ${msg.type.toUpperCase()}: ${msg.content}`
    ).join('\n\n');
    
    const blob = new Blob([transcriptText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `interview-transcript-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSendEmail = async () => {
    // Simulate email sending
    setEmailSent(true);
    
    // In a real app, you would send the email here
    console.log('Sending interview results to:', userData.email);
  };

  const saveResultsAndOpen = () => {
    const payload = {
      user: userData,
      transcript,
      duration,
      generatedAt: new Date().toISOString(),
      summary: undefined as any
    };
    try {
      localStorage.setItem('ai-interviewer/results', JSON.stringify(payload));
    } catch {}
    window.location.href = '/results';
  };

  const stats = {
    duration: formatDuration(duration),
    questionsAnswered: transcript.filter(msg => msg.type === 'user').length,
    totalMessages: transcript.length,
  };

  setTimeout(() => setShowConfetti(false), 3000);

  return (
    <div className="min-h-screen flex items-center justify-center p-2 sm:p-4 relative">
      {/* Confetti effect */}
      {showConfetti && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {[...Array(isMobile ? 30 : 50)].map((_, i) => (
            <div
              key={i}
              className="absolute animate-pulse"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${2 + Math.random() * 2}s`
              }}
            >
              <Sparkles className="h-3 w-3 sm:h-4 sm:w-4 text-brand animate-spin" />
            </div>
          ))}
        </div>
      )}

      <Card className="glass-card p-4 sm:p-8 w-full max-w-sm sm:max-w-2xl animate-slide-up">
        <div className="text-center space-y-4 sm:space-y-6">
          {/* Success icon and message */}
          <div className="space-y-3 sm:space-y-4">
            <div className="flex justify-center">
              <CheckCircle className="h-12 w-12 sm:h-16 sm:w-16 text-brand animate-pulse-glow" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold gradient-text">
              Interview Complete!
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground px-2">
              Thank you, {userData.firstName}! You did great. Here's your interview summary.
            </p>
          </div>

          {/* Statistics cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <Card className="glass-card p-3 sm:p-4">
              <div className="flex items-center space-x-2 sm:space-x-3">
                <Clock className="h-6 w-6 sm:h-8 sm:w-8 text-brand" />
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Duration</p>
                  <p className="text-sm sm:text-lg font-semibold">{stats.duration}</p>
                </div>
              </div>
            </Card>

            <Card className="glass-card p-3 sm:p-4">
              <div className="flex items-center space-x-2 sm:space-x-3">
                <MessageSquare className="h-6 w-6 sm:h-8 sm:w-8 text-brand" />
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Questions</p>
                  <p className="text-sm sm:text-lg font-semibold">{stats.questionsAnswered}</p>
                </div>
              </div>
            </Card>

            <Card className="glass-card p-3 sm:p-4">
              <div className="flex items-center space-x-2 sm:space-x-3">
                <FileText className="h-6 w-6 sm:h-8 sm:w-8 text-brand" />
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Messages</p>
                  <p className="text-sm sm:text-lg font-semibold">{stats.totalMessages}</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Key highlights */}
          <div className="space-y-3 sm:space-y-4">
            <h3 className="text-base sm:text-lg font-semibold">Key Highlights</h3>
            <div className="space-y-2">
              {getHighlights().map((highlight, index) => (
                <Card key={index} className="glass-card p-2 sm:p-3 text-left">
                  <p className="text-xs sm:text-sm text-muted-foreground italic">
                    "{highlight}"
                  </p>
                </Card>
              ))}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-3 pt-3 sm:pt-4">
            <Button
              onClick={handleDownloadTranscript}
              className="w-full bg-brand hover:bg-brand/90 transition-all duration-300 h-10 sm:h-9 text-sm sm:text-base"
            >
              <Download className="mr-2 h-4 w-4" />
              Download Transcript
            </Button>

            <Button
              onClick={handleSendEmail}
              disabled={emailSent}
              variant="outline"
              className="w-full glass-card border-brand/50 hover:border-brand h-10 sm:h-9 text-sm sm:text-base"
            >
              <Mail className="mr-2 h-4 w-4" />
              {emailSent ? 'Email Sent!' : 'Email Results'}
            </Button>

            <Button
              onClick={saveResultsAndOpen}
              variant="secondary"
              className="w-full h-10 sm:h-9 text-sm sm:text-base"
            >
              View Detailed Results
            </Button>
          </div>

          {/* Email confirmation */}
          {emailSent && (
            <Badge variant="default" className="animate-fade-in text-xs">
              <CheckCircle className="mr-1 h-3 w-3" />
              Results sent to {userData.email}
            </Badge>
          )}

          {/* Start over button */}
          <div className="pt-3 sm:pt-4 border-t border-border/50">
            <Button
              onClick={onRestart}
              variant="ghost"
              className="text-muted-foreground hover:text-foreground transition-colors text-sm sm:text-base h-9 sm:h-8"
            >
              Start New Interview
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
