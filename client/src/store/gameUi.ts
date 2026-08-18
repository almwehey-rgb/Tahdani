import { create } from 'zustand';

// Lets the active game board register its "finish game" action so the
// shared header (rendered above it, outside its own component tree) can
// show a single button for it — the header can't call into a page it
// wraps any other way.
interface GameUiState {
  finishGameHandler: (() => void) | null;
  setFinishGameHandler: (handler: (() => void) | null) => void;
}

export const useGameUiStore = create<GameUiState>((set) => ({
  finishGameHandler: null,
  setFinishGameHandler: (handler) => set({ finishGameHandler: handler }),
}));
