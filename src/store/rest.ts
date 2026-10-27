import { create } from 'zustand';

/** Rest countdown between sets. In memory only: it does not need to survive an app restart. */
interface RestState {
  /** Absolute end time (ms since epoch), so the countdown stays right across tab switches. */
  endsAt: number | null;
  /** Full length of the current rest in seconds, for the progress bar. */
  totalSec: number;
  start: (seconds: number) => void;
  extend: (seconds: number) => void;
  clear: () => void;
}

export const useRestStore = create<RestState>()((set, get) => ({
  endsAt: null,
  totalSec: 0,
  start: (seconds) => {
    if (seconds <= 0) return;
    set({ endsAt: Date.now() + seconds * 1000, totalSec: seconds });
  },
  extend: (seconds) => {
    const { endsAt, totalSec } = get();
    if (endsAt === null || endsAt <= Date.now()) return;
    set({ endsAt: endsAt + seconds * 1000, totalSec: totalSec + seconds });
  },
  clear: () => set({ endsAt: null, totalSec: 0 }),
}));
