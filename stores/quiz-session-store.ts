/**
 * §5.6 — Client state for an in-progress quiz session.
 *
 * The store tracks:
 *  - currentQuestionIndex (for the one-question-at-a-time UI)
 *  - answers map (questionId → answer payload)
 *  - timeRemaining (seconds, decremented by a setInterval in the session view)
 *  - sessionId + quizId
 *
 * The actual `submitAnswer` server action is called whenever an answer changes
 * (so the server-side session state is always in sync); this store just
 * mirrors the UI state for snappy navigation.
 */

import { create } from "zustand";

export type QuizAnswerDraft =
  | {
      questionType: "single_choice" | "true_false";
      selectedOptionId: string;
    }
  | {
      questionType: "multiple_choice";
      selectedOptionIds: string[];
    }
  | {
      questionType: "short_answer" | "essay";
      answerText: string;
    };

interface QuizSessionState {
  sessionId: string | null;
  quizId: string | null;
  totalQuestions: number;
  currentIndex: number;
  answers: Record<string, QuizAnswerDraft>;
  /** Seconds remaining (null when no time limit). */
  timeRemaining: number | null;
  /** Seconds spent on the current question (resets on navigation). */
  questionStartedAt: number;
  isFinishing: boolean;

  // Actions
  init: (payload: {
    sessionId: string;
    quizId: string;
    totalQuestions: number;
    timeLimitSeconds: number | null;
  }) => void;
  reset: () => void;
  setAnswer: (questionId: string, answer: QuizAnswerDraft) => void;
  goTo: (index: number) => void;
  next: () => void;
  previous: () => void;
  tick: () => void;
  setFinishing: (finishing: boolean) => void;
}

export const useQuizSessionStore = create<QuizSessionState>((set) => ({
  sessionId: null,
  quizId: null,
  totalQuestions: 0,
  currentIndex: 0,
  answers: {},
  timeRemaining: null,
  questionStartedAt: Date.now(),
  isFinishing: false,

  init: ({ sessionId, quizId, totalQuestions, timeLimitSeconds }) =>
    set({
      sessionId,
      quizId,
      totalQuestions,
      currentIndex: 0,
      answers: {},
      timeRemaining: timeLimitSeconds,
      questionStartedAt: Date.now(),
      isFinishing: false,
    }),

  reset: () =>
    set({
      sessionId: null,
      quizId: null,
      totalQuestions: 0,
      currentIndex: 0,
      answers: {},
      timeRemaining: null,
      questionStartedAt: Date.now(),
      isFinishing: false,
    }),

  setAnswer: (questionId, answer) =>
    set((state) => ({
      answers: { ...state.answers, [questionId]: answer },
    })),

  goTo: (index) =>
    set((state) => ({
      currentIndex: Math.max(0, Math.min(state.totalQuestions - 1, index)),
      questionStartedAt: Date.now(),
    })),

  next: () =>
    set((state) => ({
      currentIndex: Math.min(state.totalQuestions - 1, state.currentIndex + 1),
      questionStartedAt: Date.now(),
    })),

  previous: () =>
    set((state) => ({
      currentIndex: Math.max(0, state.currentIndex - 1),
      questionStartedAt: Date.now(),
    })),

  tick: () =>
    set((state) => {
      if (state.timeRemaining === null) return state;
      if (state.timeRemaining <= 0) return state;
      return { timeRemaining: state.timeRemaining - 1 };
    }),

  setFinishing: (finishing) => set({ isFinishing: finishing }),
}));

/**
 * Format a number of seconds as `MM:SS` (or `HH:MM:SS` if > 1 hour).
 */
export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}
