import { create } from 'zustand';

import { cancelRestEnd, scheduleRestEnd } from './restNotification';

/**
 * Rest countdown between sets. In memory only: it does not need to survive an app restart.
 * Every change is mirrored to a scheduled local notification (see restNotification.ts) so the
 * phone also alerts when the app is in the background or the screen is off.
 */
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
    const endsAt = Date.now() + seconds * 1000;
    set({ endsAt, totalSec: seconds });
    void scheduleRestEnd(endsAt);
  },
  extend: (seconds) => {
    const { endsAt, totalSec } = get();
    if (endsAt === null || endsAt <= Date.now()) return;
    const next = endsAt + seconds * 1000;
    set({ endsAt: next, totalSec: totalSec + seconds });
    void scheduleRestEnd(next);
  },
  clear: () => {
    const hadRest = get().endsAt !== null;
    set({ endsAt: null, totalSec: 0 });
    if (hadRest) void cancelRestEnd();
  },
}));
