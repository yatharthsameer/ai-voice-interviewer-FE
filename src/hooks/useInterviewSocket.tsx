import { useState, useEffect, useRef, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";

// Global WebSocket connection state to persist across component mounts
let globalWs: WebSocket | null = null;
let globalConnectionState: InterviewState = "connecting";
let globalIsConnected = false;
let globalSessionId = "";
let globalReconnectAttempts = 0;
let globalIsConnecting = false;

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
  // Initialize state from global state
  const [state, setState] = useState<InterviewState>(globalConnectionState);
  const [sessionId, setSessionId] = useState<string>(globalSessionId);
  const [currentQuestion, setCurrentQuestion] = useState<string>("");
  const [questionNumber, setQuestionNumber] = useState<number>(0);
  const [totalQuestions, setTotalQuestions] = useState<number>(0);
  const [isConnected, setIsConnected] = useState<boolean>(globalIsConnected);
  
  const wsRef = useRef<WebSocket | null>(globalWs);
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const reconnectAttemptsRef = useRef<number>(globalReconnectAttempts);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isConnectingRef = useRef<boolean>(globalIsConnecting);
  const { toast } = useToast();

  const WS_URL = process.env.NODE_ENV === 'production' 
    ? `wss://${window.location.host}/ws`
    : 'ws://localhost:3000';

  // Sync local state with global state
  const updateState = useCallback((newState: InterviewState) => {
    globalConnectionState = newState;
    setState(newState);
  }, []);

  const updateIsConnected = useCallback((connected: boolean) => {
    globalIsConnected = connected;
    setIsConnected(connected);
  }, []);

  const updateSessionId = useCallback((id: string) => {
    globalSessionId = id;
    setSessionId(id);
  }, []);

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

  const cleanup = useCallback((force = false) => {
    console.log('Cleaning up WebSocket connection...', force ? '(forced)' : '(component unmount)');
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    // Only close WebSocket if forced (e.g., on app close) or if there are errors
    if (force && wsRef.current) {
      console.log('Force closing WebSocket connection...');
      wsRef.current.close();
      wsRef.current = null;
      globalWs = null;
      globalIsConnecting = false;
    }
    
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    if (synthRef.current) {
      synthRef.current.cancel();
    }
  }, []);

  const connect = useCallback(() => {
    // If already connected, just sync state
    if (globalWs && globalWs.readyState === WebSocket.OPEN) {
      console.log('Using existing WebSocket connection');
      wsRef.current = globalWs;
      updateState(globalConnectionState);
      updateIsConnected(globalIsConnected);
      updateSessionId(globalSessionId);
      return;
    }
    
    // Prevent multiple simultaneous connection attempts
    if (globalIsConnecting) {
      console.log('Connection attempt already in progress globally, skipping...');
      return;
    }
    
    globalIsConnecting = true;
    isConnectingRef.current = true;
    
    // Clear any existing timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    // Close existing connection if any
    if (globalWs) {
      console.log('Closing existing WebSocket connection...');
      globalWs.close();
      globalWs = null;
    }
    
    updateState("connecting");
    console.log('Attempting WebSocket connection to:', WS_URL);
    
    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;
      globalWs = ws;
      
      ws.onopen = () => {
        console.log('WebSocket connected successfully');
        globalIsConnecting = false;
        isConnectingRef.current = false;
        globalReconnectAttempts = 0;
        reconnectAttemptsRef.current = 0;
        // Add small delay to ensure connection is fully established
        setTimeout(() => {
          updateIsConnected(true);
          updateState("ready");
        }, 50);
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          handleWebSocketMessage(message);
        } catch (error) {
          console.error("Failed to parse WebSocket message:", error);
        }
      };

      ws.onclose = (event) => {
        console.log('WebSocket closed. Code:', event.code, 'Reason:', event.reason);
        globalIsConnecting = false;
        isConnectingRef.current = false;
        updateIsConnected(false);
        
        if (globalConnectionState !== "completed") {
          const maxRetries = 5;
          const retryDelay = Math.min(1000 * Math.pow(2, globalReconnectAttempts), 10000);
          
          if (globalReconnectAttempts < maxRetries) {
            updateState("connecting");
            globalReconnectAttempts++;
            reconnectAttemptsRef.current = globalReconnectAttempts;
            console.log(`Reconnection attempt ${globalReconnectAttempts}/${maxRetries} in ${retryDelay}ms`);
            
            reconnectTimeoutRef.current = setTimeout(() => {
              connect();
            }, retryDelay);
          } else {
            updateState("error");
            toast({
              title: "Connection Failed",
              description: "Unable to connect to interview service. Please refresh the page.",
              variant: "destructive",
            });
          }
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        globalIsConnecting = false;
        isConnectingRef.current = false;
        updateState("error");
      };

    } catch (error) {
      globalIsConnecting = false;
      isConnectingRef.current = false;
      updateState("error");
      console.error("WebSocket connection failed:", error);
    }
  }, [updateState, updateIsConnected, updateSessionId]);

  const handleWebSocketMessage = useCallback((message: WebSocketMessage) => {
    switch (message.type) {
      case "connection":
        updateSessionId(message.sessionId || "");
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
        updateState("completed");
        if (message.summary?.finalFeedback) {
          playAIResponse(message.summary.finalFeedback, message.audioUrl);
        }
        break;
        
      case "error":
        updateState("error");
        toast({
          title: "Interview Error",
          description: message.message || "An error occurred during the interview.",
          variant: "destructive",
        });
        break;
    }
  }, [updateState, updateSessionId, toast]);

  const playAIResponse = useCallback(async (text: string, audioUrl?: string) => {
    updateState("aiSpeaking");
    
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
  }, [updateState]);

  const startListening = useCallback(() => {
    if (!recognitionRef.current) return;
    
    updateState("listening");
    
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
      updateState("error");
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
  }, [updateState, toast]);

  const sendUserResponse = useCallback((response: string) => {
    if (!wsRef.current || !response.trim() || wsRef.current.readyState !== WebSocket.OPEN) return;
    
    updateState("sending");
    
    const message = {
      type: "user_response",
      data: {
        response: response.trim(),
        questionNumber
      }
    };
    
    wsRef.current.send(JSON.stringify(message));
    updateState("waitingBackend");
  }, [questionNumber, updateState]);

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
    updateState("completed");
  }, [sessionId, updateState]);

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
    globalReconnectAttempts = 0;
    reconnectAttemptsRef.current = 0;
    globalIsConnecting = false;
    isConnectingRef.current = false;
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