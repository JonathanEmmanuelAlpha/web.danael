/**
 * Adaptive Learning Loop — client store (Zustand).
 *
 * Centralise l'état courant de la boucle d'apprentissage adaptative :
 *  - currentPlan      : plan hebdomadaire (compétences ciblées)
 *  - todayTasks       : 3 micro-tâches du jour
 *  - skillGraph       : niveaux de maîtrise par compétence (avec courbe d'oubli)
 *  - streak           : jours consécutifs d'activité
 *  - events           : buffer d'événements d'apprentissage (batch-save côté serveur)
 *  - todayWarmup      : état du warm-up quotidien (3 questions)
 *  - emotionalState   : check-in émotionnel hebdomadaire
 *  - currentDiagnostic: diagnostic en cours
 *
 * Le serveur hydrate ce store une fois au montage du dashboard via
 * <LearningStoreHydrator />, puis les composants client lisent l'état
 * depuis le store au lieu de re-fetcher à chaque navigation.
 *
 * -- Event buffer --------------------------------------------------
 * Les événements d'apprentissage (answer_question, complete_quiz, etc.)
 * sont accumulés dans `events[]` puis envoyés au serveur en lot via
 * `recordLearningEventsAction`. Trois déclencheurs de flush :
 *   1. Debounce 30 s après le dernier événement (setTimeout reset à chaque add)
 *   2. `visibilitychange` → onglet caché (voir useLearningEventFlusher)
 *   3. `beforeunload` → fermeture de page (sendBeacon vers /api/learning/flush)
 *
 * -- Persistence ---------------------------------------------------
 * Seuls `streak`, `lastActiveDate`, `currentPlanId`, `emotionalState`,
 * `lastCheckinWeek` sont persistés en localStorage (partialize).
 * Les autres champs sont re-hydratés depuis le serveur à chaque session.
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

import type { ApiResponse } from "@/lib/api-response";
import { recordLearningEventsAction } from "@/server/actions/learning";
import type {
  DiagnosticStatusValue,
  EmotionalStateValue,
  LearningEventTypeValue,
  LevelValue,
  PlanTaskStatusValue,
  PlanTaskTypeValue,
  SkillNodeTypeValue,
  WarmupStatusValue,
} from "@/server/db/schema/enums";

/* -------------------------------------------------------------
 * Summary types (client-side, lighter than full DB rows)
 * ------------------------------------------------------------ */

export interface LearningPlanSummary {
  id: string;
  weekKey: string;
  diagnosticSessionId?: string | null;
  targetProgress: number;
  targetedSkills: string[];
  summary?: string | null;
  isActive: boolean;
}

export interface PlanTaskSummary {
  id: string;
  planId: string;
  dayOfWeek?: number | null;
  scheduledFor?: string | null;
  type: PlanTaskTypeValue;
  status: PlanTaskStatusValue;
  title: string;
  description?: string | null;
  skillId?: string | null;
  resourceId?: string | null;
  resourceType?: string | null;
  estimatedMinutes: number;
  position: number;
  completedAt?: string | null;
}

export interface SkillNodeWithState {
  skillId: string;
  code: string;
  name: string;
  description?: string | null;
  type: SkillNodeTypeValue;
  level?: LevelValue | null;
  parentId?: string | null;
  subjectId?: string | null;
  // Mastery state (from student_skill_states)
  mastery: number;
  predictedMastery: number;
  confidence: number;
  practiceCount: number;
  correctCount: number;
  lastPracticedAt?: string | null;
  forgettingRate: number;
  trend: number;
}

export interface WarmupSummary {
  id: string;
  dateKey: string;
  status: WarmupStatusValue;
  questionIds: string[];
  skillIds: string[];
  correctCount: number;
  totalCount: number;
  timeSpent: number;
  startedAt?: string | null;
  completedAt?: string | null;
}

export interface DiagnosticSummary {
  id: string;
  weekKey: string;
  status: DiagnosticStatusValue;
  totalQuestions: number;
  correctAnswers: number;
  score: number;
  timeSpent: number;
  startedAt: string;
  completedAt?: string | null;
}

/**
 * Brouillon d'événement d'apprentissage côté client.
 * Le `studentId` est ajouté côté serveur (à partir de la session),
 * on ne l'inclut donc pas dans le draft.
 */
export interface LearningEventDraft {
  type: LearningEventTypeValue;
  resourceId?: string | null;
  resourceType?: string | null;
  skillId?: string | null;
  success?: boolean | null;
  score?: number | null;
  durationSec?: number;
  metadata?: Record<string, unknown> | null;
  /** ISO string ; si omis, le serveur utilise now(). */
  occurredAt?: string;
}

export interface HydrationPayload {
  currentPlan?: LearningPlanSummary | null;
  todayTasks?: PlanTaskSummary[];
  skillGraph?: SkillNodeWithState[];
  todayWarmup?: WarmupSummary | null;
  currentDiagnostic?: DiagnosticSummary | null;
  streak?: number;
  lastActiveDate?: string | null;
  emotionalState?: EmotionalStateValue | null;
  lastCheckinWeek?: string | null;
}

/* -------------------------------------------------------------
 * Store state
 * ------------------------------------------------------------ */

interface LearningStoreState {
  // Current plan
  currentPlan: LearningPlanSummary | null;
  /** Cached for persistence (restore even if full plan not yet hydrated). */
  currentPlanId: string | null;
  todayTasks: PlanTaskSummary[];

  // Skill graph
  skillGraph: SkillNodeWithState[];

  // Streak
  streak: number;
  lastActiveDate: string | null; // YYYY-MM-DD

  // Events buffer
  events: LearningEventDraft[];

  // Warm-up
  todayWarmup: WarmupSummary | null;

  // Emotional
  emotionalState: EmotionalStateValue | null;
  lastCheckinWeek: string | null;

  // Diagnostic
  currentDiagnostic: DiagnosticSummary | null;

  _hasHydrated: boolean;

  // Actions
  hydrate: (data: HydrationPayload) => void;
  setCurrentPlan: (plan: LearningPlanSummary) => void;
  setTodayTasks: (tasks: PlanTaskSummary[]) => void;
  setSkillGraph: (graph: SkillNodeWithState[]) => void;
  addEvent: (event: LearningEventDraft) => void;
  flushEvents: () => Promise<void>;
  markTaskCompleted: (taskId: string) => void;
  markTaskSkipped: (taskId: string) => void;
  setWarmup: (warmup: WarmupSummary) => void;
  setEmotionalState: (state: EmotionalStateValue, weekKey: string) => void;
  setCurrentDiagnostic: (diagnostic: DiagnosticSummary | null) => void;
  setHasHydrated: (state: boolean) => void;
  clear: () => void;
}

/* -------------------------------------------------------------
 * Flush timer (module-level, cleared/reset on each addEvent)
 * ------------------------------------------------------------ */

const FLUSH_DEBOUNCE_MS = 30_000;

let flushTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleFlush(flush: () => Promise<void>): void {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flush();
  }, FLUSH_DEBOUNCE_MS);
}

function clearFlushTimer(): void {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
}

/* -------------------------------------------------------------
 * Store
 * ------------------------------------------------------------ */

export const useLearningStore = create<LearningStoreState>()(
  persist(
    (set, get) => ({
      currentPlan: null,
      currentPlanId: null,
      todayTasks: [],
      skillGraph: [],
      streak: 0,
      lastActiveDate: null,
      events: [],
      todayWarmup: null,
      emotionalState: null,
      lastCheckinWeek: null,
      currentDiagnostic: null,
      _hasHydrated: false,

      hydrate: (data) =>
        set((state) => ({
          currentPlan: data.currentPlan ?? state.currentPlan,
          currentPlanId: data.currentPlan?.id ?? state.currentPlanId ?? null,
          todayTasks: data.todayTasks ?? state.todayTasks,
          skillGraph: data.skillGraph ?? state.skillGraph,
          todayWarmup: data.todayWarmup ?? state.todayWarmup,
          currentDiagnostic:
            data.currentDiagnostic !== undefined
              ? data.currentDiagnostic
              : state.currentDiagnostic,
          streak: data.streak ?? state.streak,
          lastActiveDate: data.lastActiveDate ?? state.lastActiveDate,
          emotionalState:
            data.emotionalState !== undefined
              ? data.emotionalState
              : state.emotionalState,
          lastCheckinWeek: data.lastCheckinWeek ?? state.lastCheckinWeek,
        })),

      setCurrentPlan: (plan) =>
        set({ currentPlan: plan, currentPlanId: plan.id }),

      setTodayTasks: (todayTasks) => set({ todayTasks }),

      setSkillGraph: (skillGraph) => set({ skillGraph }),

      addEvent: (event) => {
        set((state) => ({ events: [...state.events, event] }));
        scheduleFlush(get().flushEvents);
      },

      flushEvents: async () => {
        const events = get().events;
        if (events.length === 0) return;

        // Clear the buffer immediately (optimistic) so concurrent
        // addEvent calls don't double-send the same events.
        set({ events: [] });
        // Cancel any pending debounce flush since we're flushing now.
        clearFlushTimer();

        try {
          const result: ApiResponse<{ saved: number }> =
            await recordLearningEventsAction(events);
          if (!result.success) {
            // Re-queue on failure (prepend so order is preserved).
            set((state) => ({ events: [...events, ...state.events] }));
          }
        } catch (err) {
          // Re-queue on throw (network error, etc.).
          set((state) => ({ events: [...events, ...state.events] }));
          // Re-schedule a retry after the debounce window.
          scheduleFlush(get().flushEvents);
          // Re-throw silently swallowed: the buffer is preserved, the
          // next addEvent or visibilitychange will retry.
          if (typeof console !== "undefined" && console.warn) {
            console.warn("[learning-store] flushEvents failed", err);
          }
        }
      },

      markTaskCompleted: (taskId) =>
        set((state) => ({
          todayTasks: state.todayTasks.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  status: "completed",
                  completedAt: new Date().toISOString(),
                }
              : t,
          ),
        })),

      markTaskSkipped: (taskId) =>
        set((state) => ({
          todayTasks: state.todayTasks.map((t) =>
            t.id === taskId ? { ...t, status: "skipped" } : t,
          ),
        })),

      setWarmup: (todayWarmup) => set({ todayWarmup }),

      setEmotionalState: (emotionalState, weekKey) =>
        set({ emotionalState, lastCheckinWeek: weekKey }),

      setCurrentDiagnostic: (currentDiagnostic) => set({ currentDiagnostic }),

      clear: () => {
        clearFlushTimer();
        set({
          currentPlan: null,
          currentPlanId: null,
          todayTasks: [],
          skillGraph: [],
          streak: 0,
          lastActiveDate: null,
          events: [],
          todayWarmup: null,
          emotionalState: null,
          lastCheckinWeek: null,
          currentDiagnostic: null,
        });
      },
      setHasHydrated: (state) => set({ _hasHydrated: state }),
    }),
    {
      name: "danael-learning-store",
      storage: createJSONStorage(() => localStorage),
      version: 2,
      partialize: (state) => ({
        streak: state.streak,
        lastActiveDate: state.lastActiveDate,
        currentPlanId: state.currentPlanId,
        emotionalState: state.emotionalState,
        lastCheckinWeek: state.lastCheckinWeek,
        skipHydration: true,
      }),
    },
  ),
);

/* -------------------------------------------------------------
 * Selectors (stable references)
 * ------------------------------------------------------------ */

export const selectTodayTasks = (s: LearningStoreState) => s.todayTasks;
export const selectCurrentPlan = (s: LearningStoreState) => s.currentPlan;
export const selectSkillGraph = (s: LearningStoreState) => s.skillGraph;
export const selectStreak = (s: LearningStoreState) => s.streak;
export const selectWarmupStatus = (s: LearningStoreState) => s.todayWarmup;
export const selectPendingEventsCount = (s: LearningStoreState) =>
  s.events.length;
export const selectEmotionalState = (s: LearningStoreState) => s.emotionalState;
export const selectLastCheckinWeek = (s: LearningStoreState) =>
  s.lastCheckinWeek;
export const selectCurrentDiagnostic = (s: LearningStoreState) =>
  s.currentDiagnostic;
