import { create } from 'zustand';

export const useSocketStore = create((set) => ({
  connected: false,
  setConnected: (status) => set({ connected: status }),
}));
