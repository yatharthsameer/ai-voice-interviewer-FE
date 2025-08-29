import { useState, useEffect, useRef } from 'react';
import { AIAvatar } from './AIAvatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useIsMobile } from '@/hooks/use-mobile';
import { 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  SkipForward, 
  Square,
  Clock,
  MessageSquare,
  Wifi,
  WifiOff
} from 'lucide-react';

// Web Speech API type declarations
interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent {
  error: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionStatic {
  new(): SpeechRecognition;
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionStatic;
    webkitSpeechRecognition?: SpeechRecognitionStatic;
  }
}

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
  position?: string;
}

interface InterviewSectionProps {
  userData: UserFormData;
  onComplete: (transcript: Message[], duration: number) => void;
}

interface WebSocketMessage {
  type: string;
  sessionId?: string;
  message?: string;
  question?: string | { question?: string; [key: string]: unknown };
  questionNumber?: number;
  totalQuestions?: number;
  analysis?: string;
  nextQuestion?: string;
  feedback?: string;
  summary?: {
    duration?: number;
    questionsAnswered?: number;
    interviewType?: string;
  };
}

export function InterviewSection({ userData, onComplete }: InterviewSectionProps) {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [answerTimeLeft, setAnswerTimeLeft] = useState<number | null>(null);
  const answerTimerRef = useRef<number | null>(null);
  const ANSWER_TIME_MS = 60000; // 60s per answer
  const [interviewStarted, setInterviewStarted] = useState(false);
  const [interviewType, setInterviewType] = useState('general');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [wsError, setWsError] = useState<string | null>(null);
  const [totalQuestions, setTotalQuestions] = useState<number>(5);
  const chatContainerRef = useRef<HTMLDivElement | null>(null);
  const HARD_LIMIT = 5;
  const SOFT_LIMIT = 7;
  const [askedCount, setAskedCount] = useState<number>(0);
  
  const isMobile = useIsMobile();
  const wsRef = useRef<WebSocket | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const synthesisRef = useRef<SpeechSynthesis | null>(null);
  const startTimeRef = useRef<number>(0);
  const questionsRef = useRef<string[]>([]);
  const responsesRef = useRef<string[]>([]);

  // Initialize WebSocket connection on mount (do not start interview yet)
  useEffect(() => {
    connectWebSocket();
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // Initialize Speech Synthesis and Speech Recognition
  useEffect(() => {
    // Speech synthesis
    if ('speechSynthesis' in window) {
      synthesisRef.current = window.speechSynthesis;
    }

    // Speech recognition
    const RecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (RecognitionCtor) {
      const recognition = new RecognitionCtor();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      recognition.onresult = (event: SpeechRecognitionEvent) => handleSpeechResult(event);
      recognition.onerror = (_e: SpeechRecognitionErrorEvent) => {
        setIsListening(false);
      };
      recognition.onend = () => {
        setIsListening(false);
      };
      recognitionRef.current = recognition;
    }
  }, []);

  const connectWebSocket = () => {
    try {
      // Use different WebSocket URLs based on environment
      const wsUrl = window.location.hostname === 'localhost' 
        ? 'ws://localhost:3001'
        : `ws://${window.location.host}/ws`;
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsConnected(true);
        setWsError(null);
        console.log('WebSocket connected');
      };

      ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        handleWebSocketMessage(message);
      };

      ws.onclose = () => {
        setWsConnected(false);
        console.log('WebSocket disconnected');
      };

      ws.onerror = (error) => {
        setWsError('WebSocket connection failed');
        console.error('WebSocket error:', error);
      };
    } catch (error) {
      setWsError('Failed to connect to interview server');
      console.error('WebSocket connection error:', error);
    }
  };

  // Auto-scroll chat to bottom when messages change
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const handleWebSocketMessage = (message: WebSocketMessage) => {
    switch (message.type) {
      case 'connection': {
        setSessionId(message.sessionId || null);
        break;
      }
        
      case 'interview_started': {
        let firstQuestion: string | undefined;
        if (typeof message.question === 'string') {
          firstQuestion = message.question;
        } else if (message.question && typeof (message.question as Record<string, unknown>).question === 'string') {
          firstQuestion = (message.question as Record<string, unknown>).question as string;
        }
        const qTotal = (typeof message.totalQuestions === 'string') ? parseInt(message.totalQuestions as unknown as string) : message.totalQuestions;
        if (firstQuestion) {
          questionsRef.current[0] = firstQuestion;
          addAIMessage(firstQuestion);
          setCurrentQuestion(1);
          if (qTotal && !Number.isNaN(qTotal)) setTotalQuestions(qTotal);
        }
        break;
      }
        
      case 'response_analyzed': {
        let nextQuestion: string | undefined;
        const rawNext = (message as { nextQuestion?: unknown }).nextQuestion;
        if (typeof rawNext === 'string') {
          nextQuestion = rawNext;
        } else if (rawNext && typeof (rawNext as Record<string, unknown>).question === 'string') {
          nextQuestion = (rawNext as Record<string, unknown>).question as string;
        }
        const qNumRaw = message.questionNumber as unknown as (number | string | undefined);
        const qNum = typeof qNumRaw === 'string' ? parseInt(qNumRaw) : qNumRaw;
        const qTotalRaw = message.totalQuestions as unknown as (number | string | undefined);
        const qTotal = typeof qTotalRaw === 'string' ? parseInt(qTotalRaw) : qTotalRaw;
        
        if (nextQuestion && qNum && !Number.isNaN(qNum)) {
          questionsRef.current[qNum - 1] = nextQuestion;
          addAIMessage(nextQuestion);
          setCurrentQuestion(qNum);
          if (qTotal && !Number.isNaN(qTotal)) setTotalQuestions(qTotal);
        }
        if (qNum && qTotal && qNum >= qTotal) {
          handleInterviewComplete();
        }
        break;
      }
      case 'next_question': {
        let nextQuestion: string | undefined;
        if (typeof message.question === 'string') {
          nextQuestion = message.question;
        } else if (message.question && typeof (message.question as Record<string, unknown>).question === 'string') {
          nextQuestion = (message.question as Record<string, unknown>).question as string;
        }
        const qNumRaw = message.questionNumber as unknown as (number | string | undefined);
        const qNum = typeof qNumRaw === 'string' ? parseInt(qNumRaw) : qNumRaw;
        const qTotalRaw = message.totalQuestions as unknown as (number | string | undefined);
        const qTotal = typeof qTotalRaw === 'string' ? parseInt(qTotalRaw) : qTotalRaw;
        if (nextQuestion && qNum && !Number.isNaN(qNum)) {
          questionsRef.current[qNum - 1] = nextQuestion;
          addAIMessage(nextQuestion);
          setCurrentQuestion(qNum);
          if (qTotal && !Number.isNaN(qTotal)) setTotalQuestions(qTotal);
        }
        if (qNum && qTotal && qNum >= qTotal) {
          handleInterviewComplete();
        }
        break;
      }
        
      case 'interview_completed': {
        const summary = message.summary;
        setIsAISpeaking(false);
        setIsListening(false);
        
        // Complete interview
        const duration = Date.now() - startTimeRef.current;
        try {
          const payload = {
            user: userData,
            transcript: messages,
            duration,
            generatedAt: new Date().toISOString(),
            summary
          };
          localStorage.setItem('ai-interviewer/results', JSON.stringify(payload));
        } catch { /* ignore persistence errors */ }
        onComplete(messages, duration);
        break;
      }
        
      case 'error': {
        console.error('Server error:', message.message);
        addAIMessage('Sorry, there was an error. Please try again.');
        break;
      }
        
      default:
        console.log('Unknown message type:', message.type);
    }
  };

  const speakMessage = (content: string) => {
    if (!synthesisRef.current || isMuted) return;
    
    // Cancel any ongoing speech
    synthesisRef.current.cancel();
    
    const utterance = new SpeechSynthesisUtterance(content);
    // Slower, more natural pace
    utterance.rate = 0.85;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    
    // Find a pleasant voice (prefer female voices for interviews)
    const voices = synthesisRef.current.getVoices();
    const preferredVoice = voices.find(voice => 
      voice.name.includes('Female') || 
      voice.name.includes('Karen') || 
      voice.name.includes('Samantha') ||
      voice.name.includes('Victoria')
    ) || voices.find(voice => voice.lang.startsWith('en')) || voices[0];
    
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }
    
    utterance.onstart = () => {
      setIsAISpeaking(true);
    };
    
    utterance.onend = () => {
      setIsAISpeaking(false);
      // Start listening after AI finishes speaking
      if (content.includes('?')) { // Only listen for questions
        setTimeout(() => {
          startListening();
        }, 1200);
      }
    };
    
    utterance.onerror = (event) => {
      console.error('Speech synthesis error:', event.error);
      setIsAISpeaking(false);
    };
    
    synthesisRef.current.speak(utterance);
  };

  const normalizeText = (value: unknown): string => {
    if (typeof value === 'string') return value;
    if (value == null) return '';
    try {
      if (typeof value === 'object' && value !== null) {
        const obj = value as Record<string, unknown>;
        if (typeof obj.text === 'string') return obj.text;
        if (typeof obj.question === 'string') return obj.question;
      }
      return String(value);
    } catch (_e) {
      return '';
    }
  };

  const addAIMessage = (raw: unknown) => {
    const content = normalizeText(raw);
    if (!content) return;
    // Add a short, human-like delay before showing/speaking
    const words = content.split(/\s+/).length;
    const baseDelay = 350 + Math.min(1200, words * 60);
    const jitter = Math.floor(Math.random() * 200);
    const delay = baseDelay + jitter;

    setTimeout(() => {
      const message: Message = {
        id: Date.now().toString(),
        type: 'ai',
        content,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, message]);
      // Speak the message
      speakMessage(content);
    }, delay);
  };

  const addUserMessage = (content: string) => {
    const message: Message = {
      id: Date.now().toString(),
      type: 'user',
      content,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, message]);
    setIsListening(false);
    
    // Stop any ongoing speech recognition
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    
    // For dynamic flow, rely on server prompts for next steps
  };

  const startListening = () => {
    if (!recognitionRef.current) return;
    
    // Allow interruption: if AI is speaking, stop it first
    if (isAISpeaking && synthesisRef.current) {
      synthesisRef.current.cancel();
      setIsAISpeaking(false);
    }
    
    try {
      setIsListening(true);
      // start countdown
      setAnswerTimeLeft(Math.floor(ANSWER_TIME_MS / 1000));
      if (answerTimerRef.current) window.clearInterval(answerTimerRef.current);
      const startedAt = Date.now();
      answerTimerRef.current = window.setInterval(() => {
        const elapsed = Date.now() - startedAt;
        const remaining = Math.max(0, ANSWER_TIME_MS - elapsed);
        setAnswerTimeLeft(Math.ceil(remaining / 1000));
        if (remaining <= 0) {
          // soft-timeout, do not force close, gently interrupt
          if (recognitionRef.current) recognitionRef.current.stop();
          window.clearInterval(answerTimerRef.current!);
          answerTimerRef.current = null;
          setIsListening(false);
        }
      }, 500);
      recognitionRef.current.start();
    } catch (error) {
      console.error('Failed to start speech recognition:', error);
      setIsListening(false);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
    if (answerTimerRef.current) {
      window.clearInterval(answerTimerRef.current);
      answerTimerRef.current = null;
    }
    setAnswerTimeLeft(null);
  };

  const handleSkipQuestion = () => {
    stopListening();
    const skipText = "I'd prefer to skip this question.";
    addUserMessage(skipText);
    // Notify backend to advance to next question
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'user_response',
        data: { response: skipText, questionNumber: currentQuestion }
      }));
    }
  };

  const handleInterviewComplete = () => {
    stopListening();
    if (synthesisRef.current) {
      synthesisRef.current.cancel();
    }
    const duration = Date.now() - startTimeRef.current;
    onComplete(messages, duration);
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    if (!isMuted && synthesisRef.current) {
      synthesisRef.current.cancel();
      setIsAISpeaking(false);
    }
  };

  const formatTime = (milliseconds: number) => {
    const minutes = Math.floor(milliseconds / 60000);
    const seconds = Math.floor((milliseconds % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'm') {
        toggleMute();
      } else if (event.key.toLowerCase() === 's') {
        handleSkipQuestion();
      } else if (event.key.toLowerCase() === 'q') {
        handleInterviewComplete();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  const startInterview = () => {
    setInterviewStarted(true);
    startTimeRef.current = Date.now();

    // Notify backend to start interview only after user clicks Start
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'start_interview',
        data: {
          userData,
          interviewType,
          clientTime: new Date().toISOString()
        }
      }));
    }
  };

  const handleStartListening = () => {
    if (!wsConnected) {
      addAIMessage('Please wait for the connection to be established...');
      return;
    }
    
    if (isListening) return;
    
    setIsListening(true);
    setIsAISpeaking(false);
    
    if (recognitionRef.current) {
      recognitionRef.current.start();
    }
  };

  const handleStopListening = () => {
    if (!isListening) return;
    
    setIsListening(false);
    
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  };

  const handleSpeechResult = (event: SpeechRecognitionEvent) => {
    const transcript = Array.from(event.results)
      .map(result => result[0].transcript)
      .join('');
    
    if (event.results[0].isFinal) {
      addUserMessage(transcript);
      
      // Send response to WebSocket
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'user_response',
          data: {
            response: transcript,
            questionNumber: currentQuestion
          }
        }));
      }
    }
  };

  return (
    <div className="min-h-[100svh] h-[100svh] overflow-hidden bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-2 sm:p-4 pb-24 md:pb-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
            AI Interview Session
          </h1>
          <div className="flex items-center justify-center gap-4 text-sm text-gray-300">
            <div className="flex items-center gap-2">
              {wsConnected ? (
                <Wifi className="h-4 w-4 text-green-400" />
              ) : (
                <WifiOff className="h-4 w-4 text-red-400" />
              )}
              <span>{wsConnected ? 'Connected' : 'Disconnected'}</span>
            </div>
            {sessionId && (
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                <span>Session: {sessionId.slice(0, 8)}...</span>
              </div>
            )}
          </div>
        </div>

        {/* Connection Status */}
        {wsError && (
          <Card className="glass-card mb-4 p-4 border-red-500/20">
            <div className="text-center text-red-400">
              <WifiOff className="h-6 w-6 mx-auto mb-2" />
              <p>{wsError}</p>
              <Button 
                onClick={connectWebSocket} 
                variant="outline" 
                size="sm" 
                className="mt-2"
              >
                Retry Connection
              </Button>
            </div>
          </Card>
        )}

        {/* Interview Start Button */}
        {!interviewStarted && (
          <Card className="glass-card mb-6 p-6">
            <div className="text-center space-y-4">
              <h2 className="text-xl font-semibold text-white">
                Ready to Start Your Interview?
              </h2>
              <p className="text-gray-300">
                You'll be interviewed by our AI system. Make sure your microphone is working and you're in a quiet environment.
              </p>
              
              <div className="flex flex-wrap justify-center gap-2">
                {['general', 'coding', 'technical', 'sales', 'leadership', 'customer_service', 'home_care'].map((type) => (
                  <Button
                    key={type}
                    variant={interviewType === type ? "default" : "outline"}
                    size="sm"
                    onClick={() => setInterviewType(type)}
                    className="capitalize"
                  >
                    {type.replace('_', ' ')}
                  </Button>
                ))}
              </div>
              
              <Button 
                onClick={startInterview}
                size="lg"
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                disabled={!wsConnected}
              >
                Start {interviewType.replace('_', ' ')} Interview
              </Button>
            </div>
          </Card>
        )}

        {/* Interview Content */}
        {interviewStarted && (
          <div className="flex flex-col lg:flex-row gap-6">
            {/* AI Avatar Section */}
            <div className="flex-shrink-0 flex justify-center">
              <div className="text-center">
                <AIAvatar 
                  isListening={isListening} 
                  isSpeaking={isAISpeaking}
                  className={`w-24 h-24 sm:w-40 sm:h-40 ${isMobile ? 'w-24 h-24' : 'w-40 h-40'}`}
                />
                <div className="mt-4 space-y-2">
                  <Badge variant="secondary" className="text-xs">
                    {interviewType.replace('_', ' ')}
                  </Badge>
                  <div className="text-sm text-gray-400">
                    Question {currentQuestion} of {totalQuestions}
                  </div>
                </div>
              </div>
            </div>

            {/* Chat Section */}
            <div className="flex-1 space-y-4">
              <Card
                ref={chatContainerRef}
                className={`glass-card p-4 ${isMobile ? 'h-[calc(100svh-320px)] pb-28 mb-24' : 'h-[70vh]'} overflow-y-auto`}
              >
                <div className="space-y-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.type === 'ai' ? 'justify-start' : 'justify-end'}`}
                    >
                      <div
                        className={`max-w-xs sm:max-w-md lg:max-w-lg px-4 py-2 rounded-lg ${
                          message.type === 'ai'
                            ? 'bg-purple-600/20 text-white border border-purple-500/30'
                            : 'bg-blue-600/20 text-white border border-blue-500/30'
                        }`}
                      >
                        <p className="text-sm">{message.content}</p>
                        <span className="text-xs text-gray-400 mt-1 block">
                          {message.timestamp.toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  ))}
                  {/* Spacer so last message is not covered by mobile controls */}
                  <div className="md:hidden h-24" />
                </div>
              </Card>

              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-gray-300">
                  <span>Progress</span>
                  <span>{Math.round((currentQuestion / Math.max(1, totalQuestions)) * 100)}%</span>
                </div>
                <Progress value={(currentQuestion / Math.max(1, totalQuestions)) * 100} className="h-2" />
              </div>

              {/* Control Buttons + Answer Timer (Desktop) */}
              <div className="hidden md:flex flex-wrap gap-3 justify-center items-center">
                {/* Timer */}
                <div className="flex items-center gap-2 text-gray-300">
                  <Clock className={`h-4 w-4 ${isListening ? 'animate-pulse' : ''}`} />
                  <span className="text-sm">
                    {isListening ? (
                      answerTimeLeft !== null ? `${answerTimeLeft}s left` : 'listening...'
                    ) : isAISpeaking ? 'AI speaking - click to interrupt' : 'idle'}
                  </span>
                </div>

                <Button
                  onClick={isListening ? handleStopListening : handleStartListening}
                  variant={isListening ? "destructive" : "default"}
                  size={isMobile ? "default" : "sm"}
                  disabled={!wsConnected}
                  className="flex items-center gap-2"
                >
                  {isListening ? (
                    <>
                      <MicOff className="h-4 w-4" />
                      Stop
                    </>
                  ) : (
                    <>
                      <Mic className="h-4 w-4" />
                      {isAISpeaking ? 'Interrupt' : 'Speak'}
                    </>
                  )}
                </Button>

                <Button
                  onClick={toggleMute}
                  variant="outline"
                  size={isMobile ? "default" : "sm"}
                  className="flex items-center gap-2"
                >
                  {isMuted ? (
                    <>
                      <VolumeX className="h-4 w-4" />
                      Unmute
                    </>
                  ) : (
                    <>
                      <Volume2 className="h-4 w-4" />
                      Mute
                    </>
                  )}
                </Button>

                <Button
                  onClick={handleSkipQuestion}
                  variant="outline"
                  size={isMobile ? "default" : "sm"}
                  disabled={!wsConnected}
                  className="flex items-center gap-2"
                >
                  <SkipForward className="h-4 w-4" />
                  Skip
                </Button>

                {/* Force End Interview */}
                <Button
                  onClick={handleInterviewComplete}
                  variant="ghost"
                  size={isMobile ? "default" : "sm"}
                  className="flex items-center gap-2 text-red-300 hover:text-red-200"
                >
                  <Square className="h-4 w-4" />
                  End Interview
                </Button>

                {/* Bottom voice intake animation when listening */}
                {isListening && (
                  <div className="intake-bars ml-2">
                    {Array.from({ length: 12 }).map((_, i) => (
                      <div
                        key={i}
                        className="intake-bar"
                        style={{ animationDelay: `${(i % 6) * 0.08}s` }}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Mobile Call-style Floating Controls */}
              <div className="md:hidden fixed bottom-0 left-0 right-0 z-30 px-4 pb-6 pt-3 bg-black/40 backdrop-blur border-t border-white/10">
                <div className="flex items-center justify-between text-gray-200 mb-3">
                  <div className="flex items-center gap-2">
                    <Clock className={`h-4 w-4 ${isListening ? 'animate-pulse' : ''}`} />
                    <span className="text-sm">
                      {isListening ? (answerTimeLeft !== null ? `${answerTimeLeft}s left` : 'listening...') : isAISpeaking ? 'AI speaking - tap to interrupt' : 'idle'}
                    </span>
                  </div>
                  <div className="text-xs">Question {currentQuestion} / {totalQuestions}</div>
                </div>
                <div className="flex items-center justify-around">
                  {/* Speak/Stop */}
                  <Button
                    onClick={isListening ? handleStopListening : handleStartListening}
                    size="icon"
                    className={`rounded-full h-14 w-14 ${isListening ? 'bg-red-600 hover:bg-red-500' : ''}`}
                  >
                    {isListening ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
                  </Button>
                  {/* Mute */}
                  <Button
                    onClick={toggleMute}
                    variant="outline"
                    size="icon"
                    className="rounded-full h-14 w-14"
                  >
                    {isMuted ? <VolumeX className="h-6 w-6" /> : <Volume2 className="h-6 w-6" />}
                  </Button>
                  {/* Skip */}
                  <Button
                    onClick={handleSkipQuestion}
                    variant="outline"
                    size="icon"
                    className="rounded-full h-14 w-14"
                    disabled={!wsConnected}
                  >
                    <SkipForward className="h-6 w-6" />
                  </Button>
                  {/* End */}
                  <Button
                    onClick={handleInterviewComplete}
                    variant="destructive"
                    size="icon"
                    className="rounded-full h-14 w-14"
                  >
                    <Square className="h-6 w-6" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
