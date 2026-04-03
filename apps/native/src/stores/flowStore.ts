import { create } from 'zustand';

interface FlowState {
  isActive: boolean;
  sessionId: string | null;
  startedAt: Date | null;
  elapsedSeconds: number;
  notes: string;
  startSession: (sessionId: string) => void;
  endSession: () => void;
  updateElapsed: (seconds: number) => void;
  updateNotes: (notes: string) => void;
  reset: () => void;
}

export const useFlowStore = create<FlowState>((set) => ({
  isActive: false,
  sessionId: null,
  startedAt: null,
  elapsedSeconds: 0,
  notes: '',
  
  startSession: (sessionId) => set({
    isActive: true,
    sessionId,
    startedAt: new Date(),
    elapsedSeconds: 0,
    notes: '',
  }),
  
  endSession: () => set({
    isActive: false,
  }),
  
  updateElapsed: (seconds) => set({ elapsedSeconds: seconds }),
  
  updateNotes: (notes) => set({ notes }),
  
  reset: () => set({
    isActive: false,
    sessionId: null,
    startedAt: null,
    elapsedSeconds: 0,
    notes: '',
  }),
}));
