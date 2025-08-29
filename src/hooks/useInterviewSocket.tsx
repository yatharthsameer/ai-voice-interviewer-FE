import { useState, useEffect, useRef, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";

export type InterviewState = 
  | "connecting" 
  | "ready" 
  | "aiSpeaking" 
  | "listening" 
  | "sending" 
  | "waitingBackend" 
  | "completed" 
  | "error";

export type InterviewType = "general" | "technical" | "sales" | "leadership" | "customer_service";

interface UserData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  position: string;
}

interface WebSocketMessage {
  type: string;
  sessionId?: string;
  question?: string;
  questionNumber?: number;
  totalQuestions?: number;
  nextQuestion?: string;
  summary?: {
    score: number;
    finalFeedback: string;
    transcript: any[];
  };
  message?: string;
  audioUrl?: string;
}

export function useInterviewSocket() {
  const [state, setState] = useState<InterviewState>("connecting");
  const [sessionId, setSessionId] = useState<string>("");
  const [currentQuestion, setCurrentQuestion] = useState<string>("");
  const [questionNumber, setQuestionNumber] = useState<number>(0);
  const [totalQuestions, setTotalQuestions] = useState<number>(0);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  
  const wsRef = useRef<WebSocket | null>(null);
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isConnectingRef = useRef<boolean>(false); // Prevent multiple simultaneous connections
  const { toast } = useToast();

  const WS_URL = process.env.NODE_ENV === 'production' 
    ? `wss://${window.location.host}/ws`
    : 'ws://localhost:3000';

  // Initialize speech recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';
    } else {
      toast({
        title: "Browser Not Supported",
        description: "Please use Chrome for the best interview experience.",
        variant: "destructive",
      });
    }

    synthRef.current = window.speechSynthesis;
    audioRef.current = new Audio();

    return () => cleanup();
  }, []);

  const cleanup = useCallback(() => {
    console.log('Cleaning up WebSocket connection...');
    isConnectingRef.current = false;
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    if (synthRef.current) {
      synthRef.current.cancel();
    }
  }, []);

  const connect = useCallback(() => {
    // Prevent multiple simultaneous connection attempts
    if (isConnectingRef.current) {
      console.log('Connection attempt already in progress, skipping...');
      return;
    }
    
    isConnectingRef.current = true;
    
    // Clear any existing timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    // Close existing connection if any
    if (wsRef.current) {
      console.log('Closing existing WebSocket connection...');
      wsRef.current.close();
      wsRef.current = null;
    }
    
    setState("connecting");
    console.log('Attempting WebSocket connection to:', WS_URL);
    
    try {
      wsRef.current = new WebSocket(WS_URL);
      
      wsRef.current.onopen = () => {
        console.log('WebSocket connected successfully');
        isConnectingRef.current = false; // Reset connecting flag
        reconnectAttemptsRef.current = 0; // Reset retry counter on successful connection
        // Add small delay to ensure connection is fully established
        setTimeout(() => {
          setIsConnected(true);
          setState("ready");
        }, 50);
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          handleWebSocketMessage(message);
        } catch (error) {
          console.error("Failed to parse WebSocket message:", error);
        }
      };

      wsRef.current.onclose = (event) => {
        console.log('WebSocket closed. Code:', event.code, 'Reason:', event.reason);
        isConnectingRef.current = false; // Reset connecting flag
        setIsConnected(false);
        
        if (state !== "completed") {
          const maxRetries = 5;
          const retryDelay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 10000); // Exponential backoff, max 10s
          
          if (reconnectAttemptsRef.current < maxRetries) {
            setState("connecting");
            reconnectAttemptsRef.current++;
            console.log(`Reconnection attempt ${reconnectAttemptsRef.current}/${maxRetries} in ${retryDelay}ms`);
            
            reconnectTimeoutRef.current = setTimeout(() => {
              connect();
            }, retryDelay);
          } else {
            setState("error");
            toast({
              title: "Connection Failed",
              description: "Unable to connect to interview service. Please refresh the page.",
              variant: "destructive",
            });
          }
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        isConnectingRef.current = false; // Reset connecting flag on error
        setState("error");
      };

    } catch (error) {
      isConnectingRef.current = false; // Reset connecting flag on error
      setState("error");
      console.error("WebSocket connection failed:", error);
    }
  }, [state, WS_URL]);

  const handleWebSocketMessage = useCallback((message: WebSocketMessage) => {
    switch (message.type) {
      case "connection":
        setSessionId(message.sessionId || "");
        break;
        
      case "interview_started":
        setCurrentQuestion(message.question || "");
        setQuestionNumber(message.questionNumber || 0);
        setTotalQuestions(message.totalQuestions || 0);
        playAIResponse(message.question || "", message.audioUrl);
        break;
        
      case "response_analyzed":
        setCurrentQuestion(message.nextQuestion || "");
        setQuestionNumber(message.questionNumber || 0);
        playAIResponse(message.nextQuestion || "", message.audioUrl);
        break;
        
      case "interview_completed":
        setState("completed");
        if (message.summary?.finalFeedback) {
          playAIResponse(message.summary.finalFeedback, message.audioUrl);
        }
        break;
        
      case "error":
        setState("error");
        toast({
          title: "Interview Error",
          description: message.message || "An error occurred during the interview.",
          variant: "destructive",
        });
        break;
    }
  }, []);

  const playAIResponse = useCallback(async (text: string, audioUrl?: string) => {
    setState("aiSpeaking");
    
    try {
      if (audioUrl && audioRef.current) {
        // Use provided audio URL with speaker device selection support
        audioRef.current.src = audioUrl;
        await audioRef.current.play();
        
        audioRef.current.onended = () => {
          setTimeout(() => startListening(), 800);
        };
      } else {
        // Fallback to speech synthesis
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.9;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;
        
        utterance.onend = () => {
          setTimeout(() => startListening(), 800);
        };
        
        synthRef.current?.speak(utterance);
      }
    } catch (error) {
      console.error("Failed to play AI response:", error);
      setTimeout(() => startListening(), 800);
    }
  }, []);

  const startListening = useCallback(() => {
    if (!recognitionRef.current) return;
    
    setState("listening");
    
    recognitionRef.current.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map(result => result[0].transcript)
        .join('');
        
      if (event.results[event.results.length - 1].isFinal) {
        sendUserResponse(transcript);
      }
    };

    recognitionRef.current.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      setState("error");
      toast({
        title: "Speech Recognition Error",
        description: "Please try speaking again or check your microphone.",
        variant: "destructive",
      });
    };

    try {
      recognitionRef.current.start();
    } catch (error) {
      console.error("Failed to start speech recognition:", error);
    }
  }, []);

  const sendUserResponse = useCallback((response: string) => {
    if (!wsRef.current || !response.trim() || wsRef.current.readyState !== WebSocket.OPEN) return;
    
    setState("sending");
    
    const message = {
      type: "user_response",
      data: {
        response: response.trim(),
        questionNumber
      }
    };
    
    wsRef.current.send(JSON.stringify(message));
    setState("waitingBackend");
  }, [questionNumber]);

  const startInterview = useCallback((userData: UserData, interviewType: InterviewType = "general") => {
    if (!wsRef.current || !isConnected || wsRef.current.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket not ready for sending messages. ReadyState:', wsRef.current?.readyState);
      return;
    }
    
    const message = {
      type: "start_interview",
      data: {
        userData,
        interviewType,
        clientTime: new Date().toISOString()
      }
    };
    
    wsRef.current.send(JSON.stringify(message));
  }, [isConnected]);

  const endInterview = useCallback(() => {
    if (!wsRef.current || !sessionId || wsRef.current.readyState !== WebSocket.OPEN) return;
    
    const message = {
      type: "end_interview",
      data: { sessionId }
    };
    
    wsRef.current.send(JSON.stringify(message));
    setState("completed");
  }, [sessionId]);

  const setAudioOutputDevice = useCallback(async (deviceId: string) => {
    if (audioRef.current && 'setSinkId' in audioRef.current) {
      try {
        await (audioRef.current as any).setSinkId(deviceId);
      } catch (error) {
        console.error("Failed to set audio output device:", error);
      }
    }
  }, []);

  const retryConnection = useCallback(() => {
    console.log('Manual retry connection requested...');
    reconnectAttemptsRef.current = 0; // Reset retry counter
    isConnectingRef.current = false; // Reset connecting flag
    connect();
  }, [connect]);

  return {
    state,
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
  };
}

// Extend Window interface for speech recognition
declare global {
  interface Window {
    SpeechRecognition?: any;
    webkitSpeechRecognition?: any;
  }
}