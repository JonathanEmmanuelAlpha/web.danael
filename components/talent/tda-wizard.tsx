"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain,
  BookOpen,
  Palette,
  Heart,
  CheckCircle2,
  Loader2,
  ChevronRight,
  ChevronLeft,
  Sparkles,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  startTdaAction,
  submitTdaAnswerAction,
  advanceTdaPhaseAction,
  completeTdaAction,
} from "@/server/actions/talent";

const PHASES = [
  {
    key: "cognitive",
    labelKey: "phaseCognitive",
    icon: Brain,
    color: "from-violet-500 to-purple-600",
    descriptionKey: "phaseCognitiveDesc",
  },
  {
    key: "multi_subject",
    labelKey: "phaseMultiSubject",
    icon: BookOpen,
    color: "from-blue-500 to-cyan-600",
    descriptionKey: "phaseMultiSubjectDesc",
  },
  {
    key: "creativity",
    labelKey: "phaseCreativity",
    icon: Palette,
    color: "from-pink-500 to-rose-600",
    descriptionKey: "phaseCreativityDesc",
  },
  {
    key: "motivation",
    labelKey: "phaseMotivation",
    icon: Heart,
    color: "from-amber-500 to-orange-600",
    descriptionKey: "phaseMotivationDesc",
  },
] as const;

const COGNITIVE_ITEMS = [
  {
    domain: "numerical",
    question: "Quel est le prochain nombre : 2, 4, 8, 16, ?",
    options: ["24", "32", "20", "28"],
    correct: "32",
    difficulty: 3,
  },
  {
    domain: "verbal",
    question: "Quel mot est synonyme de 'perspicace' ?",
    options: ["Lent", "Astucieux", "Distrait", "Banal"],
    correct: "Astucieux",
    difficulty: 3,
  },
  {
    domain: "spatial",
    question: "Si tu plies ce patron, quel solide obtiens-tu ? (imagine un cube)",
    options: ["Sphère", "Cube", "Pyramide", "Cylindre"],
    correct: "Cube",
    difficulty: 4,
  },
  {
    domain: "logic",
    question: "Tous les chats sont des animaux. Minou est un chat. Donc :",
    options: [
      "Minou n'est pas un animal",
      "Minou est un animal",
      "Minou est un chien",
      "On ne peut pas conclure",
    ],
    correct: "Minou est un animal",
    difficulty: 2,
  },
  {
    domain: "memory",
    question:
      "Mémorise : 7-3-9-1-5. Quel était le 3ème chiffre ?",
    options: ["7", "3", "9", "1"],
    correct: "9",
    difficulty: 4,
  },
];

/**
 * TDA Wizard — multi-step assessment with 4 phases.
 */
export function TdaWizard({ sessionId }: { sessionId: string }) {
  const t = useTranslations("Talent");
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [itemIndex, setItemIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);

  const phase = PHASES[currentStep]!;
  const progress = ((currentStep + 1) / PHASES.length) * 100;

  async function handleAnswer(answer: string) {
    setSubmitting(true);
    const item = COGNITIVE_ITEMS[itemIndex];
    if (!item) {
      setSubmitting(false);
      return;
    }

    const isCorrect = answer === item.correct;

    try {
      await submitTdaAnswerAction({
        sessionId,
        phase: phase.key,
        domain: item.domain,
        answer,
        isCorrect,
        difficulty: item.difficulty,
        timeSpentSec: 15,
      });

      const newAnswers = { ...answers, [`${phase.key}_${itemIndex}`]: answer };
      setAnswers(newAnswers);

      if (itemIndex < COGNITIVE_ITEMS.length - 1) {
        setItemIndex(itemIndex + 1);
      } else {
        await advanceTdaPhaseAction({
          sessionId,
          completedPhase: phase.key,
          phaseData: {
            itemsAnswered: COGNITIVE_ITEMS.length,
            correct: COGNITIVE_ITEMS.filter(
              (it) =>
                it.correct === newAnswers[`${phase.key}_${COGNITIVE_ITEMS.indexOf(it)}`],
            ).length,
          },
        });
        if (currentStep < PHASES.length - 1) {
          setCurrentStep(currentStep + 1);
          setItemIndex(0);
        } else {
          const result = await completeTdaAction({
            sessionId,
            finalPhaseData: {
              engagementScore: 75,
            },
          });
          if (result.success) {
            setCompleted(true);
            toast.success(t("assessmentCompleted"));
            setTimeout(() => {
              router.push("/student/talent");
            }, 2500);
          } else {
            toast.error(result.error?.message ?? t("assessmentFailed"));
          }
        }
      }
    } catch (err) {
      toast.error(String(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (completed) {
    return (
      <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-600 p-12 text-white">
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ duration: 0.6, type: "spring" }}
          className="mx-auto flex size-24 items-center justify-center rounded-full bg-white/20 backdrop-blur"
        >
          <CheckCircle2 className="size-14" />
        </motion.div>
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-6 text-center font-display text-3xl font-bold"
        >
          {t("assessmentCompletedTitle")}
        </motion.h2>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-2 text-center text-white/80"
        >
          {t("assessmentCompletedDesc")}
        </motion.p>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden border-0 shadow-lg">
      <div className={`bg-gradient-to-br ${phase.color} p-6 text-white`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur">
              <phase.icon className="size-6" />
            </div>
            <div>
              <div className="text-xs font-medium uppercase tracking-wider text-white/80">
                {t("phase")} {currentStep + 1} / {PHASES.length}
              </div>
              <h2 className="font-display text-xl font-bold">
                {t(phase.labelKey)}
              </h2>
            </div>
          </div>
          <Sparkles className="size-8 text-white/30" />
        </div>
        <p className="mt-3 text-sm text-white/90">{t(phase.descriptionKey)}</p>
      </div>

      <div className="px-6 pt-4">
        <Progress value={progress} className="h-1.5" />
      </div>

      <div className="p-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${currentStep}-${itemIndex}`}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                {t("question")} {itemIndex + 1} / {COGNITIVE_ITEMS.length}
              </Badge>
              <Badge variant="secondary" className="capitalize">
                {COGNITIVE_ITEMS[itemIndex]?.domain}
              </Badge>
            </div>

            <h3 className="font-display text-lg font-semibold text-foreground">
              {COGNITIVE_ITEMS[itemIndex]?.question}
            </h3>

            <div className="grid gap-2 sm:grid-cols-2">
              {COGNITIVE_ITEMS[itemIndex]?.options.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  disabled={submitting}
                  onClick={() => handleAnswer(opt)}
                  className="group flex items-center justify-between rounded-xl border border-border bg-background p-4 text-left transition-all hover:border-primary-500 hover:bg-primary-500/5 hover:shadow-md disabled:opacity-50"
                >
                  <span className="text-sm font-medium text-foreground">
                    {opt}
                  </span>
                  <ChevronRight className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </button>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>

        <div className="mt-6 flex items-center justify-between border-t border-border/50 pt-4">
          <Button
            variant="ghost"
            size="sm"
            disabled={currentStep === 0 || submitting}
            onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
          >
            <ChevronLeft className="size-4" />
            {t("previous")}
          </Button>
          {submitting && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" />
              {t("processing")}
            </div>
          )}
          <Button variant="ghost" size="sm" disabled>
            {t("skip")}
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}

/**
 * Entry point: starts the TDA session and renders the wizard.
 */
export function TdaWizardEntry() {
  const t = useTranslations("Talent");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleStart() {
    setLoading(true);
    const res = await startTdaAction();
    setLoading(false);
    if (res.success) {
      setSessionId(res.data.sessionId);
    } else {
      toast.error(res.error?.message ?? t("startFailed"));
    }
  }

  if (sessionId) {
    return <TdaWizard sessionId={sessionId} />;
  }

  return (
    <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-600 p-10 text-white">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto max-w-md text-center"
      >
        <div className="mx-auto mb-6 flex size-24 items-center justify-center rounded-full bg-white/20 backdrop-blur">
          <Brain className="size-12" />
        </div>
        <h2 className="font-display text-3xl font-bold">
          {t("welcomeTitle")}
        </h2>
        <p className="mt-3 text-white/90">{t("welcomeDescription")}</p>
        <ul className="mt-6 space-y-2 text-left text-sm text-white/90">
          {PHASES.map((p) => (
            <li key={p.key} className="flex items-center gap-2">
              <p.icon className="size-4 shrink-0" />
              <span>
                <strong>{t(p.labelKey)}</strong> — {t(p.descriptionKey)}
              </span>
            </li>
          ))}
        </ul>
        <Button
          size="lg"
          variant="secondary"
          className="mt-8 w-full"
          disabled={loading}
          onClick={handleStart}
        >
          {loading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Sparkles className="size-4" />
          )}
          {t("startAssessment")}
        </Button>
        <p className="mt-3 text-xs text-white/70">{t("durationHint")}</p>
      </motion.div>
    </Card>
  );
}
