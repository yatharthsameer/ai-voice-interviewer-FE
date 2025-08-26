import React, { createContext, useContext, useReducer, useEffect } from "react";
import { ApplicationData, DeviceSetupData } from "./schema";

export interface InterviewState {
  application: Partial<ApplicationData> | null;
  deviceSetup: Partial<DeviceSetupData> | null;
  currentStep: 1 | 2;
  isApplicationComplete: boolean;
}

export type InterviewAction =
  | { type: "UPDATE_APPLICATION"; payload: Partial<ApplicationData> }
  | { type: "UPDATE_DEVICE_SETUP"; payload: Partial<DeviceSetupData> }
  | { type: "SET_STEP"; payload: 1 | 2 }
  | { type: "MARK_APPLICATION_COMPLETE"; payload: boolean }
  | { type: "LOAD_FROM_STORAGE"; payload: InterviewState };

const initialState: InterviewState = {
  application: null,
  deviceSetup: null,
  currentStep: 1,
  isApplicationComplete: false,
};

function interviewReducer(state: InterviewState, action: InterviewAction): InterviewState {
  switch (action.type) {
    case "UPDATE_APPLICATION":
      return {
        ...state,
        application: { ...state.application, ...action.payload },
      };
    case "UPDATE_DEVICE_SETUP":
      return {
        ...state,
        deviceSetup: { ...state.deviceSetup, ...action.payload },
      };
    case "SET_STEP":
      return {
        ...state,
        currentStep: action.payload,
      };
    case "MARK_APPLICATION_COMPLETE":
      return {
        ...state,
        isApplicationComplete: action.payload,
      };
    case "LOAD_FROM_STORAGE":
      return action.payload;
    default:
      return state;
  }
}

interface InterviewContextType {
  state: InterviewState;
  dispatch: React.Dispatch<InterviewAction>;
}

const InterviewContext = createContext<InterviewContextType | null>(null);

const STORAGE_KEY = "interview-application-data";

export function InterviewProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(interviewReducer, initialState);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsedState = JSON.parse(stored);
        dispatch({ type: "LOAD_FROM_STORAGE", payload: parsedState });
      }
    } catch (error) {
      console.error("Failed to load data from localStorage:", error);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.error("Failed to save data to localStorage:", error);
    }
  }, [state]);

  return React.createElement(InterviewContext.Provider, { value: { state, dispatch } }, children);
}

export function useInterview() {
  const context = useContext(InterviewContext);
  if (!context) {
    throw new Error("useInterview must be used within an InterviewProvider");
  }
  return context;
}

export const interviewActions = {
  updateApplication: (data: Partial<ApplicationData>) => ({
    type: "UPDATE_APPLICATION" as const,
    payload: data,
  }),
  updateDeviceSetup: (data: Partial<DeviceSetupData>) => ({
    type: "UPDATE_DEVICE_SETUP" as const,
    payload: data,
  }),
  setStep: (step: 1 | 2) => ({
    type: "SET_STEP" as const,
    payload: step,
  }),
  markApplicationComplete: (complete: boolean) => ({
    type: "MARK_APPLICATION_COMPLETE" as const,
    payload: complete,
  }),
};