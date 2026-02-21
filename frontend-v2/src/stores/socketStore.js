import { create } from 'zustand';

export const useSocketStore = create((set) => ({
  status: 'disconnected', // 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error'
  connected: false,
  setStatus: (status) => set({ status, connected: status === 'connected' }),
}));
