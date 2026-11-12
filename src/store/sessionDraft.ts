// Unsaved edits of one finished workout. Lives outside the persisted store so Cancel simply drops it,
// and outside the screen so the exercise picker can add to it (pick-exercise `draftAdd`).
import { create } from 'zustand';

import type { WorkoutSession } from '@/types';

interface SessionDraftState {
  draft: WorkoutSession | null;
  begin: (session: WorkoutSession) => void;
  edit: (fn: (draft: WorkoutSession) => WorkoutSession) => void;
  clear: () => void;
}

export const useSessionDraft = create<SessionDraftState>()((set) => ({
  draft: null,
  begin: (session) => set({ draft: session }),
  edit: (fn) => set((s) => (s.draft ? { draft: fn(s.draft) } : {})),
  clear: () => set({ draft: null }),
}));
