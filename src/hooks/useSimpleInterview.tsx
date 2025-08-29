import { useState, useRef, useCallback, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

export interface UserData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  position: string;
}

export type InterviewState = 'connecting' | 'ready' | 'interviewing' | 'listening' | 'speaking' | 'completed' | 'error';

export function useSimpleInterview(navigate?: (path: string) => void) {
  const [state, setState] = useState<InterviewState>('connecting');
  const [sessionId, setSessionId] = useState<string>('');
  const [currentQuestion, setCurrentQuestion] = useState<string>('');
  const [questionNumber, setQuestionNumber] = useState<number>(0);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  
  const wsRef = useRef<WebSocket | null>(null);
  const recognitionRef = useRef<any>(null);
  const questionNumberRef = useRef<number>(0);
  const { toast } = useToast();
  
  const WS_URL = 'ws://localhost:3000';

  // Initialize speech recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';
      
      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        console.log('🎤 Speech recognized:', transcript);
        sendResponse(transcript);
      };
      
      recognitionRef.current.onerror = (event: any) => {
        console.error('❌ Speech recognition error:', event.error);
        setState('interviewing');
      };
      
      recognitionRef.current.onend = () => {
        console.log('🎤 Speech recognition ended');
        setState('interviewing');
      };
    }
  }, []);

  const connect = useCallback(() => {
    console.log('🔗 Connecting to WebSocket...');
    setState('connecting');
    
    try {
      wsRef.current = new WebSocket(WS_URL);
      
      wsRef.current.onopen = () => {
        console.log('✅ WebSocket connected');
        setIsConnected(true);
        setState('ready');
      };
      
      wsRef.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          handleMessage(message);
        } catch (error) {
          console.error('❌ Message parse error:', error);
        }
      };
      
      wsRef.current.onclose = () => {
        console.log('🔌 WebSocket disconnected');
        setIsConnected(false);
        setState('error');
      };
      
      wsRef.current.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        setState('error');
      };
      
    } catch (error) {
      console.error('❌ WebSocket connection failed:', error);
      setState('error');
    }
  }, []);

  const handleMessage = useCallback((message: any) => {
    console.log('📨 Received message:', message.type);
    
    switch (message.type) {
      case 'connected':
        setSessionId(message.sessionId);
        break;
        
      case 'question':
      case 'next_question':
        setCurrentQuestion(message.question);
        setQuestionNumber(message.questionNumber);
        questionNumberRef.current = message.questionNumber;
        setState('speaking');
        speakQuestion(message.question);
        break;
        
      case 'interview_complete':
        setState('completed');
        if (message.summary?.feedback) {
          speakQuestion(message.summary.feedback);
        }
        break;
        
      case 'interview_ended':
        console.log('🏁 Interview ended successfully');
        // Navigate to thank you page immediately
        if (navigate) {
          setTimeout(() => {
            navigate('/thank-you');
          }, 500);
        } else {
          setState('completed');
        }
        break;
        
      case 'error':
        console.error('❌ Server error:', message.message);
        setState('error');
        toast({
          title: 'Interview Error',
          description: message.message,
          variant: 'destructive'
        });
        break;
    }
  }, [toast]);

  const startInterview = useCallback((userData: UserData, interviewType = 'general') => {
    if (!wsRef.current || !isConnected) {
      console.warn('⚠️ WebSocket not ready');
      return;
    }
    
    console.log('🎬 Starting interview...');
    setState('interviewing');
    
    wsRef.current.send(JSON.stringify({
      type: 'start_interview',
      data: { userData, interviewType }
    }));
  }, [isConnected]);

  const sendResponse = useCallback((response: string) => {
    if (!wsRef.current || !response.trim()) return;
    
    console.log('📤 Sending response:', response);
    
    wsRef.current.send(JSON.stringify({
      type: 'user_response',
      data: {
        response: response.trim(),
        questionNumber: questionNumberRef.current
      }
    }));
  }, []);

  const startListening = useCallback(() => {
    if (!recognitionRef.current) {
      console.warn('⚠️ Speech recognition not available');
      return;
    }
    
    console.log('👂 Starting to listen...');
    setState('listening');
    
    try {
      recognitionRef.current.start();
    } catch (error) {
      console.error('❌ Failed to start listening:', error);
      setState('interviewing');
    }
  }, []);

  const speakQuestion = useCallback((text: string) => {
    console.log('🔊 Speaking:', text);
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    
    utterance.onend = () => {
      console.log('🔊 Speech ended, starting to listen...');
      setTimeout(() => {
        startListening();
      }, 800);
    };
    
    speechSynthesis.speak(utterance);
  }, [startListening]);

  const endInterview = useCallback(() => {
    if (!wsRef.current || !sessionId) return;
    
    console.log('🛑 Ending interview...');
    
    wsRef.current.send(JSON.stringify({
      type: 'end_interview',
      data: { sessionId }
    }));
  }, [sessionId]);

  const disconnect = useCallback(() => {
    console.log('🔌 Disconnecting...');
    
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    speechSynthesis.cancel();
    setIsConnected(false);
    setState('connecting');
  }, []);

  return {
    state,
    sessionId,
    currentQuestion,
    questionNumber,
    isConnected,
    connect,
    startInterview,
    endInterview,
    disconnect,
    startListening
  };
}

// Extend Window interface for speech recognition
declare global {
  interface Window {
    SpeechRecognition?: any;
    webkitSpeechRecognition?: any;
  }
}
