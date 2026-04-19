import { useEffect, useMemo, useRef, useState } from "react";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "@tanstack/react-router";

import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronRight,
  Eye,
  FileText,
  Plus,
  Send,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";

import { queryClient, trpc, trpcClient } from "@/utils/trpc";

type MessageStatus = "thinking" | "done";

interface HypothesisViewPayload {
  title: string;
  chiefProblem: string;
  recommendationReadiness: string;
  diagnosticSummary: string;
  redFlags: string[];
  cautionNotes: string[];
  missingInformation: string[];
  hypotheses: Array<{
    label: string;
    confidence: number;
    reasoning: string;
    evidenceFor: string[];
    evidenceAgainst: string[];
    recommendedNextQuestions: string[];
    recommendedNextChecks: string[];
  }>;
  disclaimer: string;
}

interface OrdonnanceViewPayload {
  title: string;
  patientId: string;
  suiviId: string;
  rendezVousId: string | null;
  clinicalProblem: string;
  label: string;
  rationale: string;
  warnings: string[];
  globalWarnings: string[];
  remarks: string | null;
  medications: Array<{
    medicament_externe_id: string;
    nom_medicament: string;
    dosage: string | null;
    posologie: string;
    duree_traitement: string | null;
    instructions: string | null;
    justification: string;
  }>;
  disclaimer: string;
}

interface SimpleViewPayload {
  title: string;
  summary: string;
  bulletPoints: string[];
}

type AssistantResultView =
  | { type: "hypothesis"; payload: HypothesisViewPayload }
  | { type: "ordonnance"; payload: OrdonnanceViewPayload }
  | { type: "simple"; payload: SimpleViewPayload };

interface ResultCard {
  title: string;
  description: string;
  buttonLabel?: string;
  icon: typeof Stethoscope;
  view?: AssistantResultView;
}

interface Message {
  id: number;
  type: "user" | "assistant";
  text: string;
  status?: MessageStatus;
  thinkingText?: string;
  resultCard?: ResultCard;
}

interface AssistantResponsePayload {
  done: string;
  card?: ResultCard;
}

interface HypothesisGenerationResult {
  analysis: {
    chief_problem: string;
    recommendation_readiness: string;
    diagnostic_summary: string;
    red_flags: string[];
    caution_notes: string[];
    global_missing_information: string[];
    hypotheses: Array<{
      label: string;
      confidence: number;
      reasoning: string;
      evidence_for: string[];
      evidence_against: string[];
      recommended_next_questions: string[];
      recommended_next_checks: string[];
    }>;
  };
  disclaimer: string;
}

interface OrdonnanceGenerationResult {
  clinical_problem_basis: { chief_problem: string };
  recommendations: unknown[];
  global_warnings: string[];
  disclaimer: string;
}

interface AssistantChatMessageInput {
  role: "user" | "assistant";
  content: string;
}

interface AssistantChatResult {
  resolved_intent:
    | "patient_qna"
    | "medication_qna"
    | "patient_context_required";
  answer: string;
  warnings: string[];
  follow_up_suggestions: string[];
}

interface MedicationSuggestionResultItem {
  rank: number;
  medicament_externe_id: string;
  nom_medicament: string;
  dci: string | null;
  dosage: string | null;
  posologie: string;
  duree_traitement: string | null;
  instructions: string | null;
  justification: string;
  warnings: string[];
}

type PatientRendezVousLite = {
  id: string;
  suivi_id: string | null;
  date: string;
  heure: string;
  statut: string;
};

const ZERO_UUID = "00000000-0000-0000-0000-000000000000";
const CLINICAL_PROBLEM_OVERRIDE_MAX_LENGTH = 280;
const diagnosticActionLabel = "Proposer une hypothese diagnostique";
const ordonnanceActionLabel = "Recommander une ordonnance";
const documentActionLabel = "Verifier un document medical";

const actions = [
  {
    icon: Stethoscope,
    label: diagnosticActionLabel,
    color: "#0f3460",
  },
  { icon: FileText, label: ordonnanceActionLabel, color: "#0f3460" },
  { icon: ShieldCheck, label: documentActionLabel, color: "#0f3460" },
];

const responses: Record<
  string,
  AssistantResponsePayload & { thinking: string }
> = {
  [diagnosticActionLabel]: {
    thinking:
      "Analyse des symptomes, antecedents et resultats biologiques du patient...",
    done: "Hypothese diagnostique generee a partir des donnees du dossier patient en cours.",
    card: {
      title: "Hypothese diagnostique",
      description: "Syndrome grippal avec surinfection bacterienne probable",
      buttonLabel: "Voir l'hypothese",
      icon: Stethoscope,
    },
  },
  [ordonnanceActionLabel]: {
    thinking:
      "Verification des allergies, interactions medicamenteuses et protocoles en vigueur...",
    done: "Ordonnance preparee selon le diagnostic et les contraintes du patient.",
    card: {
      title: "Ordonnance generee",
      description: "Amoxicilline 1g, Paracetamol 500mg, Repos 5 jours",
      buttonLabel: "Voir l'ordonnance",
      icon: FileText,
    },
  },
  "Verifier un document medical": {
    thinking: "Lecture et analyse du document medical en cours...",
    done: "Document verifie. Aucune anomalie detectee dans le compte-rendu.",
    card: {
      title: "Verification terminee",
      description: "Compte-rendu conforme, pas d'erreur detectee",
      buttonLabel: "Voir le rapport",
      icon: ShieldCheck,
      view: {
        type: "simple",
        payload: {
          title: "Rapport de verification",
          summary:
            "Aucune anomalie evidente n'a ete detectee dans le document selectionne.",
          bulletPoints: [
            "Le document semble coherent avec les donnees disponibles.",
            "Aucune alerte critique n'a ete relevee dans ce controle rapide.",
            "Une verification medicale finale reste necessaire avant validation.",
          ],
        },
      },
    },
  },
};

const springPop = {
  type: "spring" as const,
  stiffness: 400,
  damping: 28,
  mass: 0.8,
};
const springGentle = {
  type: "spring" as const,
  stiffness: 300,
  damping: 30,
  mass: 1,
};
const springBouncy = {
  type: "spring" as const,
  stiffness: 500,
  damping: 25,
  mass: 0.6,
};

const cWhite = "#FFFDFB";
const cSky = "#76BBDD";
const cSidebarGradStart = "#0f3460";
const cSidebarGradMid = "#123865";
const cSidebarGradEnd = "#285487";
const cChipActiveBg = "rgba(118,187,221,0.4)";
const cChipHoverBg = "rgba(118,187,221,0.18)";
const cTextDefault = "rgba(255,255,255,0.7)";
const cDivider = "rgba(255,255,255,0.7)";
const cDiscussionText = "#08233f";
const cDiscussionMuted = "#334155";
const cDiscussionBorder = "#c2e0ef";
const cDiscussionCardBg = "#f8fafc";

function isOrdonnanceViewRecommendation(
  recommendation: unknown,
): recommendation is {
  label: string;
  rationale: string;
  warnings: string[];
  ordonnance_draft: {
    remarques: string | null;
    medicaments: Array<{
      medicament_externe_id: string;
      nom_medicament: string;
      dosage: string | null;
      posologie: string;
      duree_traitement: string | null;
      instructions: string | null;
      justification: string;
    }>;
  };
} {
  if (!recommendation || typeof recommendation !== "object") {
    return false;
  }

  return (
    "label" in recommendation &&
    "rationale" in recommendation &&
    "warnings" in recommendation &&
    "ordonnance_draft" in recommendation
  );
}

function isMedicationSuggestion(
  recommendation: unknown,
): recommendation is MedicationSuggestionResultItem {
  if (!recommendation || typeof recommendation !== "object") {
    return false;
  }

  return (
    "medicament_externe_id" in recommendation &&
    "nom_medicament" in recommendation &&
    "posologie" in recommendation &&
    "justification" in recommendation
  );
}

function selectLatestExamen<
  T extends {
    date?: string | null;
    suivi_id: string;
  },
>(examens: T[]): T | null {
  return (
    [...examens].sort((left, right) =>
      (right.date ?? "").localeCompare(left.date ?? ""),
    )[0] ?? null
  );
}

function selectCurrentSuiviFromLists<
  TSuivi extends {
    id: string;
    est_actif?: boolean | null;
  },
  TExamen extends {
    suivi_id: string;
  },
>(suivis: TSuivi[], currentExamen: TExamen | null): TSuivi | null {
  if (currentExamen) {
    return suivis.find((suivi) => suivi.id === currentExamen.suivi_id) ?? null;
  }

  return suivis.find((suivi) => Boolean(suivi.est_actif)) ?? suivis[0] ?? null;
}

function selectLatestCompletedRendezVous(
  rendezVous: PatientRendezVousLite[],
  suiviId: string | null,
): PatientRendezVousLite | null {
  if (!suiviId) {
    return null;
  }

  return (
    [...rendezVous]
      .filter((item) => item.suivi_id === suiviId && item.statut === "termine")
      .sort((left, right) => {
        const leftTime = new Date(`${left.date}T${left.heure}`).getTime();
        const rightTime = new Date(`${right.date}T${right.heure}`).getTime();
        return rightTime - leftTime;
      })[0] ?? null
  );
}

function StethoscopeThinkingIcon() {
  const bars = [
    { height: 6, delay: 0 },
    { height: 10, delay: 0.12 },
    { height: 14, delay: 0.24 },
    { height: 10, delay: 0.36 },
    { height: 6, delay: 0.48 },
  ];

  return (
    <div className="flex items-center gap-1.5">
      <Stethoscope size={15} style={{ color: cSky, flexShrink: 0 }} />
      <div className="flex items-center gap-[2.5px]" style={{ height: 16 }}>
        {bars.map((bar, index) => (
          <motion.div
            key={index}
            className="rounded-full"
            style={{
              width: 2.5,
              background: cSky,
              originY: 0.5,
            }}
            animate={{
              height: [bar.height * 0.35, bar.height, bar.height * 0.35],
              opacity: [0.4, 0.9, 0.4],
            }}
            transition={{
              duration: 1.2,
              repeat: Number.POSITIVE_INFINITY,
              delay: bar.delay,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>
    </div>
  );
}

export function AIAssistantPanel() {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [hoveredAction, setHoveredAction] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [viewerModal, setViewerModal] = useState<AssistantResultView | null>(
    null,
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(0);

  const currentPatientId = useMemo(() => {
    const match = location.pathname.match(/^\/patients\/([^/]+)/);
    return match?.[1] ?? null;
  }, [location.pathname]);

  const suivisQuery = useQuery({
    ...trpc.consultation.getPatientSuivis.queryOptions({
      patient_id: currentPatientId ?? ZERO_UUID,
    }),
    enabled: isOpen && Boolean(currentPatientId),
  });

  const examensQuery = useQuery({
    ...trpc.consultation.getExamensPatient.queryOptions({
      patient_id: currentPatientId ?? ZERO_UUID,
    }),
    enabled: isOpen && Boolean(currentPatientId),
  });

  const patientFullRecordQuery = useQuery({
    ...trpc.patient.getPatientFullRecord.queryOptions({
      id: currentPatientId ?? ZERO_UUID,
    }),
    enabled: isOpen && Boolean(currentPatientId),
  });

  const currentExamen = useMemo(
    () => selectLatestExamen(examensQuery.data ?? []),
    [examensQuery.data],
  );

  const currentSuivi = useMemo(() => {
    return selectCurrentSuiviFromLists(suivisQuery.data ?? [], currentExamen);
  }, [currentExamen, suivisQuery.data]);

  const currentRendezVous = useMemo(
    () =>
      selectLatestCompletedRendezVous(
        ((patientFullRecordQuery.data?.rendez_vous ?? []) as PatientRendezVousLite[]),
        currentSuivi?.id ?? null,
      ),
    [currentSuivi?.id, patientFullRecordQuery.data?.rendez_vous],
  );

  const currentContextLabel =
    currentSuivi?.motif?.trim() ||
    (currentPatientId ? "Dossier patient ouvert" : "Aucun dossier patient");

  const scrollToBottom = () => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }, 80);
  };

  const handleNewChat = () => {
    setMessages([]);
    setInputValue("");
    setIsProcessing(false);
    setViewerModal(null);
  };

  const acceptOrdonnanceMutation = useMutation({
    mutationFn: async (payload: OrdonnanceViewPayload) => {
      if (!payload.rendezVousId) {
        throw new Error(
          "Aucun rendez-vous terminé n'est disponible pour enregistrer cette ordonnance.",
        );
      }

      return trpcClient.ordonnance.creerOrdonnance.mutate({
        patient_id: payload.patientId,
        rendez_vous_id: payload.rendezVousId,
        date_prescription: new Date().toISOString().slice(0, 10),
        remarques: payload.remarks,
        medicaments: payload.medications.map((medication) => ({
          medicament_externe_id: medication.medicament_externe_id,
          dosage: medication.dosage,
          posologie: medication.posologie,
          duree_traitement: medication.duree_traitement,
          instructions: medication.instructions,
        })),
      });
    },
    onSuccess: async (
      _: unknown,
      payload: OrdonnanceViewPayload,
    ) => {
      await Promise.all([
        queryClient.invalidateQueries(
          trpc.ordonnance.getOrdonnancesByPatient.queryFilter({
            patientId: payload.patientId,
          }),
        ),
        queryClient.invalidateQueries(
          trpc.patient.getPatientFullRecord.queryFilter({ id: payload.patientId }),
        ),
        queryClient.invalidateQueries(
          trpc.treatment.getActivePatientTreatments.queryFilter({
            patient_id: payload.patientId,
          }),
        ),
        queryClient.invalidateQueries(
          trpc.treatment.getPatientTreatments.queryFilter({
            patient_id: payload.patientId,
          }),
        ),
        queryClient.invalidateQueries(
          trpc.documents.getDocumentsByPatient.queryFilter({
            patientId: payload.patientId,
          }),
        ),
      ]);

      setViewerModal(null);
      toast.success("Ordonnance enregistrée avec succès");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const beginAssistantRun = (userText: string, thinkingText: string) => {
    if (isProcessing) {
      return null;
    }

    const userMsg: Message = {
      id: ++idRef.current,
      type: "user",
      text: userText,
    };
    const assistantId = ++idRef.current;
    const assistantMsg: Message = {
      id: assistantId,
      type: "assistant",
      text: "",
      status: "thinking",
      thinkingText,
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setIsProcessing(true);
    scrollToBottom();

    return assistantId;
  };

  const finishAssistantRun = (
    assistantId: number,
    payload: AssistantResponsePayload,
  ) => {
    setMessages((prev) =>
      prev.map((message) =>
        message.id === assistantId
          ? {
              ...message,
              status: "done",
              text: payload.done,
              resultCard: payload.card,
            }
          : message,
      ),
    );
    setIsProcessing(false);
    scrollToBottom();
  };

  const failAssistantRun = (assistantId: number, message: string) => {
    setMessages((prev) =>
      prev.map((item) =>
        item.id === assistantId
          ? { ...item, status: "done", text: message, resultCard: undefined }
          : item,
      ),
    );
    setIsProcessing(false);
    scrollToBottom();
  };

  const runAssistantTask = async (options: {
    userText: string;
    thinkingText: string;
    task: () => Promise<AssistantResponsePayload>;
  }) => {
    const assistantId = beginAssistantRun(
      options.userText,
      options.thinkingText,
    );
    if (!assistantId) {
      return;
    }

    try {
      const [payload] = await Promise.all([
        options.task(),
        new Promise((resolve) => window.setTimeout(resolve, 1100)),
      ]);

      finishAssistantRun(assistantId, payload);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "La demande n'a pas pu être traitée.";
      failAssistantRun(assistantId, message);
      toast.error(message);
    }
  };

  const buildHypothesisResponse = (
    result: HypothesisGenerationResult,
  ): AssistantResponsePayload => {
    const primaryHypothesis = result.analysis.hypotheses[0];
    const confidenceLabel = `${Math.round((primaryHypothesis?.confidence ?? 0) * 100)}%`;

    return {
      done: "Hypothese diagnostique generee a partir des donnees du dossier patient en cours.",
      card: {
        title: "Hypothese diagnostique",
        description: primaryHypothesis
          ? `${primaryHypothesis.label} · confiance ${confidenceLabel}`
          : result.analysis.chief_problem,
        buttonLabel: "Voir l'hypothese",
        icon: Stethoscope,
        view: {
          type: "hypothesis",
          payload: {
            title: currentContextLabel,
            chiefProblem: result.analysis.chief_problem,
            recommendationReadiness: result.analysis.recommendation_readiness,
            diagnosticSummary: result.analysis.diagnostic_summary,
            redFlags: result.analysis.red_flags,
            cautionNotes: result.analysis.caution_notes,
            missingInformation: result.analysis.global_missing_information,
            hypotheses: result.analysis.hypotheses.map((hypothesis) => ({
              label: hypothesis.label,
              confidence: hypothesis.confidence,
              reasoning: hypothesis.reasoning,
              evidenceFor: hypothesis.evidence_for,
              evidenceAgainst: hypothesis.evidence_against,
              recommendedNextQuestions: hypothesis.recommended_next_questions,
              recommendedNextChecks: hypothesis.recommended_next_checks,
            })),
            disclaimer: result.disclaimer,
          },
        },
      },
    };
  };

  const buildOrdonnanceResponse = (
    result: OrdonnanceGenerationResult,
    source: {
      patientId: string;
      suiviId: string;
      rendezVousId: string | null;
    },
  ): AssistantResponsePayload => {
    const primaryRecommendation = result.recommendations.find((item) =>
      isOrdonnanceViewRecommendation(item),
    );

    if (
      !primaryRecommendation ||
      !isOrdonnanceViewRecommendation(primaryRecommendation)
    ) {
      throw new Error(
        "Aucune recommandation fiable n’a pu être produite pour ce contexte.",
      );
    }

    const medicationSummary = primaryRecommendation.ordonnance_draft.medicaments
      .slice(0, 3)
      .map(
        (item) =>
          `${item.nom_medicament}${item.dosage ? ` ${item.dosage}` : ""}`,
      )
      .join(", ");

    const durationSummary =
      primaryRecommendation.ordonnance_draft.medicaments.find(
        (item) => item.duree_traitement,
      )?.duree_traitement ?? null;

    return {
      done: "Ordonnance preparee selon le diagnostic et les contraintes du patient.",
      card: {
        title: "Ordonnance generee",
        description: durationSummary
          ? `${medicationSummary}, ${durationSummary}`
          : medicationSummary,
        buttonLabel: "Voir l'ordonnance",
        icon: FileText,
        view: {
          type: "ordonnance",
          payload: {
            title: currentContextLabel,
            patientId: source.patientId,
            suiviId: source.suiviId,
            rendezVousId: source.rendezVousId,
            clinicalProblem: result.clinical_problem_basis.chief_problem,
            label: primaryRecommendation.label,
            rationale: primaryRecommendation.rationale,
            warnings: primaryRecommendation.warnings,
            globalWarnings: result.global_warnings,
            remarks: primaryRecommendation.ordonnance_draft.remarques,
            medications: primaryRecommendation.ordonnance_draft.medicaments,
            disclaimer: result.disclaimer,
          },
        },
      },
    };
  };

  const buildOrdonnanceResponseFromMedicationSuggestions = (
    result: OrdonnanceGenerationResult,
    source: {
      patientId: string;
      suiviId: string;
      rendezVousId: string | null;
    },
  ): AssistantResponsePayload => {
    const suggestions = result.recommendations
      .filter(isMedicationSuggestion)
      .slice(0, 3);

    if (suggestions.length === 0) {
      throw new Error(
        "Aucune recommandation fiable n’a pu être produite pour ce contexte.",
      );
    }

    const sharedWarnings = [
      ...new Set([
        ...result.global_warnings,
        ...suggestions.flatMap((item) => item.warnings),
      ]),
    ];

    const medications = suggestions.map((item) => ({
      medicament_externe_id: item.medicament_externe_id,
      nom_medicament: item.nom_medicament,
      dosage: item.dosage,
      dci: item.dci,
      posologie: item.posologie,
      duree_traitement: item.duree_traitement,
      instructions: item.instructions,
      justification: item.justification,
    }));

    const medicationSummary = medications
      .map(
        (item) => `${item.nom_medicament}${item.dosage ? ` ${item.dosage}` : ""}`,
      )
      .join(", ");

    return {
      done: "Ordonnance preparee a partir des suggestions medicamenteuses les plus pertinentes pour ce patient.",
      card: {
        title: "Ordonnance generee",
        description: medicationSummary,
        buttonLabel: "Voir l'ordonnance",
        icon: FileText,
        view: {
          type: "ordonnance",
          payload: {
            title: currentContextLabel,
            patientId: source.patientId,
            suiviId: source.suiviId,
            rendezVousId: source.rendezVousId,
            clinicalProblem: result.clinical_problem_basis.chief_problem,
            label: "Ordonnance assistee par l'IA",
            rationale:
              "Cette proposition a ete reconstruite a partir des suggestions medicamenteuses les plus pertinentes pour le contexte clinique courant.",
            warnings: sharedWarnings.slice(0, 6),
            globalWarnings: sharedWarnings,
            remarks:
              "Verifier la priorisation, les interactions et la posologie finale avant validation.",
            medications,
            disclaimer: result.disclaimer,
          },
        },
      },
    };
  };

  const buildClinicalProblemOverride = (
    result: HypothesisGenerationResult,
  ): string | undefined => {
    const normalizeSnippet = (value: string) =>
      value.replace(/\s+/g, " ").trim();

    const snippets = [
      result.analysis.chief_problem,
      ...result.analysis.hypotheses
        .slice(0, 1)
        .map((hypothesis) => hypothesis.label),
    ]
      .map(normalizeSnippet)
      .filter(Boolean);

    if (snippets.length === 0) {
      return undefined;
    }

    const compactOverride = [...new Set(snippets)].join(". ");
    if (compactOverride.length <= CLINICAL_PROBLEM_OVERRIDE_MAX_LENGTH) {
      return compactOverride;
    }

    return `${compactOverride.slice(
      0,
      CLINICAL_PROBLEM_OVERRIDE_MAX_LENGTH - 3,
    ).trimEnd()}...`;
  };

  const resolveFreshClinicalContext = async () => {
    if (!currentPatientId) {
      return {
        patientId: currentPatientId,
        suivi: currentSuivi,
        examen: currentExamen,
        rendezVous: currentRendezVous,
      };
    }

    const [suivisResult, examensResult, patientFullRecordResult] = await Promise.all([
      suivisQuery.refetch(),
      examensQuery.refetch(),
      patientFullRecordQuery.refetch(),
    ]);
    const freshExamens = examensResult.data ?? examensQuery.data ?? [];
    const freshSuivis = suivisResult.data ?? suivisQuery.data ?? [];
    const examen = selectLatestExamen(freshExamens);
    const suivi = selectCurrentSuiviFromLists(freshSuivis, examen);
    const rendezVous = selectLatestCompletedRendezVous(
      ((patientFullRecordResult.data?.rendez_vous ?? []) as PatientRendezVousLite[]),
      suivi?.id ?? null,
    );

    return { patientId: currentPatientId, suivi, examen, rendezVous };
  };

  const openOrdonnanceEditorFromAssistant = (payload: OrdonnanceViewPayload) => {
    window.dispatchEvent(
      new CustomEvent("patient-popup-open", {
        detail: {
          type: "ordonnance",
          initialValues: {
            mode: "manuel",
            suivi_id: payload.suiviId,
            rendez_vous_id: payload.rendezVousId ?? undefined,
            remarques: payload.remarks ?? "",
            medicaments: payload.medications.map((medication) => ({
              medicament_externe_id: medication.medicament_externe_id,
              nom_medicament: medication.nom_medicament,
              dosage: medication.dosage ?? "",
              posologie: medication.posologie,
              duree_traitement: medication.duree_traitement ?? "",
              instructions: medication.instructions ?? "",
            })),
          },
        },
      }),
    );
    setViewerModal(null);
  };

  const sendWithResponse = (
    userText: string,
    response: { thinking: string; done: string; card?: ResultCard },
  ) => {
    void runAssistantTask({
      userText,
      thinkingText: response.thinking,
      task: async () => ({
        done: response.done,
        card: response.card,
      }),
    });
  };

  const buildAssistantChatHistory = (userText: string): AssistantChatMessageInput[] => {
    const recentMessages = messages
      .filter(
        (message) =>
          message.status !== "thinking" &&
          message.text.trim().length > 0 &&
          (message.type === "user" || message.type === "assistant"),
      )
      .slice(-7)
      .map((message) => ({
        role: message.type,
        content: message.text.trim(),
      }));

    return [...recentMessages, { role: "user", content: userText }];
  };

  const handleDiagnosticAction = () => {
    void runAssistantTask({
      userText: diagnosticActionLabel,
      thinkingText: responses[diagnosticActionLabel].thinking,
      task: async () => {
        const { suivi, examen, patientId } = await resolveFreshClinicalContext();

        if (
          patientId &&
          (suivisQuery.isLoading || examensQuery.isLoading)
        ) {
          return {
            done: "Le contexte patient est en cours de chargement. Reessayez dans un instant.",
          };
        }

        if (!patientId || !suivi) {
          return {
            done: "Ce cas necessite le contexte d'un patient ouvert pour produire une hypothese diagnostique fiable.",
          };
        }

        const result = await trpcClient.ai.hypotheseDiagnostic.generate.mutate({
          suivi_id: suivi.id,
          examen_id: examen?.id,
          include_historical_context: true,
          max_historical_suivis: 5,
          max_historical_treatments: 8,
        });

        return buildHypothesisResponse(result);
      },
    });
  };

  const handleOrdonnanceAction = () => {
    void runAssistantTask({
      userText: ordonnanceActionLabel,
      thinkingText: responses[ordonnanceActionLabel].thinking,
      task: async () => {
        const { patientId, suivi, examen, rendezVous } =
          await resolveFreshClinicalContext();

        if (
          patientId &&
          (suivisQuery.isLoading || examensQuery.isLoading)
        ) {
          return {
            done: "Le contexte patient est en cours de chargement. Reessayez dans un instant.",
          };
        }

        if (!patientId || !suivi) {
          return {
            done: "Ce cas necessite le contexte d'un patient ouvert pour generer une ordonnance assistee.",
          };
        }

        let clinicalProblemOverride: string | undefined;
        try {
          const diagnosticResult = await trpcClient.ai.hypotheseDiagnostic.generate.mutate({
            suivi_id: suivi.id,
            examen_id: examen?.id,
            include_historical_context: true,
            max_historical_suivis: 5,
            max_historical_treatments: 8,
          });
          clinicalProblemOverride = buildClinicalProblemOverride(diagnosticResult);
        } catch {
          // The ordonnance service keeps its own fallback path if the hypothesis step fails.
        }

        const result =
          await trpcClient.ai.ordonnanceRecommendation.generate.mutate({
            suivi_id: suivi.id,
            examen_id: examen?.id,
            include_historical_context: true,
            max_historical_suivis: 5,
            max_historical_treatments: 8,
            clinical_problem_override: clinicalProblemOverride,
            response_mode: "ordonnance",
          });

        if (result.recommendations.some(isOrdonnanceViewRecommendation)) {
          return buildOrdonnanceResponse(result, {
            patientId,
            suiviId: suivi.id,
            rendezVousId: rendezVous?.id ?? null,
          });
        }

        const medicationFallback =
          await trpcClient.ai.ordonnanceRecommendation.generate.mutate({
            suivi_id: suivi.id,
            examen_id: examen?.id,
            include_historical_context: true,
            max_historical_suivis: 5,
            max_historical_treatments: 8,
            clinical_problem_override: clinicalProblemOverride,
            response_mode: "medicaments",
          });

        return buildOrdonnanceResponseFromMedicationSuggestions(
          medicationFallback,
          {
            patientId,
            suiviId: suivi.id,
            rendezVousId: rendezVous?.id ?? null,
          },
        );
      },
    });
  };

  const handleAction = (label: string) => {
    if (label === diagnosticActionLabel) {
      handleDiagnosticAction();
      return;
    }

    if (label === ordonnanceActionLabel) {
      handleOrdonnanceAction();
      return;
    }

    const response = responses[label];
    if (!response) {
      return;
    }
    sendWithResponse(label, response);
  };

  const handleSend = () => {
    const text = inputValue.trim();
    if (!text || isProcessing) {
      return;
    }
    setInputValue("");

    const matchedAction = [
      diagnosticActionLabel,
      ordonnanceActionLabel,
      documentActionLabel,
    ].find((key) => text.toLowerCase() === key.toLowerCase());
    if (matchedAction) {
      handleAction(matchedAction);
      return;
    }

    void runAssistantTask({
      userText: text,
      thinkingText: "Analyse de votre demande en cours...",
      task: async () => {
        const result = await trpcClient.ai.assistant.chat.mutate({
          messages: buildAssistantChatHistory(text),
          patient_id: currentPatientId ?? undefined,
          max_history_messages: 8,
        });

        const chatResult = result as AssistantChatResult;

        return {
          done: chatResult.answer,
        };
      },
    });
  };

  const hasMessages = messages.length > 0;

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="pointer-events-none fixed inset-0 z-[60]"
              style={{ background: "transparent" }}
            />

            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.92, filter: "blur(8px)" }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: 20, scale: 0.95, filter: "blur(4px)" }}
              transition={springGentle}
              className="fixed bottom-[5.5rem] right-3 z-[70] flex max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-3xl sm:right-6"
              style={{
                width: 390,
                height: hasMessages ? 530 : "auto",
                maxHeight: "calc(100vh - 130px)",
                background: `linear-gradient(160deg, ${cSidebarGradStart} 0%, ${cSidebarGradMid} 60%, ${cSidebarGradEnd} 100%)`,
                boxShadow: "none",
              }}
            >
              <div
                className="flex flex-shrink-0 items-start justify-between gap-3 px-5 py-4"
                style={{
                  background: `linear-gradient(135deg, ${cSidebarGradStart} 0%, ${cSidebarGradMid} 65%, ${cSidebarGradEnd} 100%)`,
                  borderBottom: `1px solid ${cDivider}`,
                }}
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <AnimatePresence mode="wait">
                    {hasMessages && (
                      <motion.button
                        initial={{ opacity: 0, x: -8, scale: 0.8 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: -8, scale: 0.8 }}
                        transition={springBouncy}
                        onClick={handleNewChat}
                        className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors"
                        style={{ background: "transparent" }}
                        title="Retour"
                      >
                        <ArrowLeft size={15} style={{ color: cWhite }} />
                      </motion.button>
                    )}
                  </AnimatePresence>

                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-xl"
                    style={{
                      background: cChipHoverBg,
                      backdropFilter: "blur(12px)",
                    }}
                  >
                    <Sparkles size={17} style={{ color: cWhite }} />
                  </div>

                  <div className="min-w-0">
                    <span
                      style={{
                        fontSize: 15,
                        fontWeight: 600,
                        color: cWhite,
                        letterSpacing: "-0.01em",
                      }}
                    >
                      Assistant IA
                    </span>
                    <AnimatePresence mode="wait">
                      <motion.p
                        key={hasMessages ? "active" : "idle"}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.2 }}
                        style={{
                          fontSize: 11,
                          color: cTextDefault,
                          marginTop: 1,
                        }}
                      >
                        {hasMessages
                          ? currentContextLabel
                          : currentPatientId
                            ? "Que souhaitez-vous faire ?"
                            : "Ouvrez un dossier patient pour lancer une action clinique"}
                      </motion.p>
                    </AnimatePresence>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <AnimatePresence>
                    {hasMessages && (
                      <motion.button
                        initial={{ opacity: 0, scale: 0.5, rotate: -90 }}
                        animate={{ opacity: 1, scale: 1, rotate: 0 }}
                        exit={{ opacity: 0, scale: 0.5, rotate: 90 }}
                        transition={springBouncy}
                        onClick={handleNewChat}
                        className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors"
                        style={{ background: "transparent" }}
                        title="Nouveau chat"
                      >
                        <Plus size={15} style={{ color: cWhite }} />
                      </motion.button>
                    )}
                  </AnimatePresence>
                  <motion.button
                    whileHover={{ scale: 1.1, background: cChipHoverBg }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setIsOpen(false)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors"
                  >
                    <X size={14} style={{ color: cTextDefault }} />
                  </motion.button>
                </div>
              </div>

              <div
                ref={scrollRef}
                className="min-h-0 flex-1 overflow-y-auto"
                style={{
                  scrollbarWidth: "thin",
                  scrollbarColor: `${cDiscussionBorder} transparent`,
                  background: cWhite,
                }}
              >
                <AnimatePresence mode="wait">
                  {!hasMessages ? (
                    <motion.div
                      key="home"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0, x: -30, filter: "blur(4px)" }}
                      transition={{ duration: 0.25 }}
                    >
                      <div className="flex flex-col gap-1.5 px-4 pb-3 pt-5">
                        <motion.div
                          initial={{ opacity: 0, y: 4, scale: 0.96 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          transition={{ ...springBouncy, delay: 0.1 }}
                          className="mb-2 inline-flex w-fit max-w-[160px] items-center gap-2 self-start rounded-full px-3 py-1.5"
                          style={{
                            background: "rgba(118,187,221,0.08)",
                            border: `1px solid ${cDiscussionBorder}`,
                          }}
                        >
                          <motion.div
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ background: cSky }}
                            animate={{
                              scale: [1, 1.2, 1],
                              opacity: [0.75, 1, 0.75],
                            }}
                            transition={{
                              duration: 2,
                              repeat: Number.POSITIVE_INFINITY,
                              ease: "easeInOut",
                            }}
                          />
                          <span
                            className="truncate"
                            style={{
                              fontSize: 11.5,
                              fontWeight: 600,
                              color: cDiscussionText,
                              lineHeight: 1.2,
                            }}
                          >
                            {currentContextLabel}
                          </span>
                        </motion.div>

                        <motion.p
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.2 }}
                          className="mb-1 px-2"
                          style={{
                            fontSize: 10,
                            fontWeight: 600,
                            color: cDiscussionMuted,
                            textTransform: "uppercase",
                            letterSpacing: "0.08em",
                          }}
                        >
                          Actions suggerees
                        </motion.p>
                        {actions.map((action, index) => (
                          <motion.button
                            key={index}
                            initial={{ opacity: 0, x: -16 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{
                              ...springPop,
                              delay: 0.25 + index * 0.08,
                            }}
                            onClick={() => handleAction(action.label)}
                            className="group relative flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left"
                            onMouseEnter={() => setHoveredAction(index)}
                            onMouseLeave={() => setHoveredAction(null)}
                            whileHover={{ x: 3 }}
                            whileTap={{ scale: 0.98 }}
                          >
                            <motion.div
                              className="absolute inset-0 rounded-2xl"
                              initial={false}
                              animate={{
                                opacity: hoveredAction === index ? 1 : 0,
                                scale: hoveredAction === index ? 1 : 0.97,
                              }}
                              transition={{ duration: 0.15 }}
                              style={{ background: cDiscussionCardBg }}
                            />
                            <motion.div
                              className="relative z-10 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl"
                              style={{
                                background:
                                  hoveredAction === index
                                    ? cDiscussionBorder
                                    : cDiscussionCardBg,
                              }}
                              animate={{
                                scale: hoveredAction === index ? 1.05 : 1,
                              }}
                              transition={springBouncy}
                            >
                              <action.icon
                                size={16}
                                style={{ color: action.color }}
                              />
                            </motion.div>
                            <span
                              className="relative z-10"
                              style={{
                                fontSize: 13,
                                fontWeight: 450,
                                color: cDiscussionText,
                                lineHeight: "1.35",
                              }}
                            >
                              {action.label}
                            </span>
                            <motion.div
                              className="relative z-10 ml-auto"
                              animate={{
                                opacity: hoveredAction === index ? 1 : 0,
                                x: hoveredAction === index ? 0 : -4,
                              }}
                              transition={{ duration: 0.15 }}
                            >
                              <ChevronRight
                                size={14}
                                style={{ color: cDiscussionMuted }}
                              />
                            </motion.div>
                          </motion.button>
                        ))}
                      </div>

                      <motion.div
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{ delay: 0.4, duration: 0.3 }}
                        className="mx-5 my-1 origin-left"
                        style={{
                          height: 1,
                          background: `linear-gradient(90deg, ${cDiscussionBorder}, transparent)`,
                        }}
                      />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="chat"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.2 }}
                      className="flex flex-col gap-4 px-4 py-4"
                    >
                      {messages.map((message) => (
                        <motion.div
                          key={message.id}
                          initial={{ opacity: 0, y: 16, scale: 0.97 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          transition={{ ...springPop, delay: 0.05 }}
                        >
                          {message.type === "user" ? (
                            <div className="flex justify-end">
                              <motion.div
                                className="max-w-[85%] rounded-2xl rounded-br-lg px-4 py-[10px]"
                                style={{
                                  background: "rgba(118,187,221,0.22)",
                                  border: `1px solid ${cDiscussionBorder}`,
                                }}
                                whileHover={{ scale: 1.01 }}
                                transition={springBouncy}
                              >
                                <span
                                  style={{
                                    fontSize: 12.75,
                                    color: cDiscussionText,
                                    lineHeight: "1.5",
                                  }}
                                >
                                  {message.text}
                                </span>
                              </motion.div>
                            </div>
                          ) : (
                            <div className="flex gap-2.5">
                              <motion.div
                                className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg"
                                style={{
                                  background: cDiscussionCardBg,
                                  border: `1px solid ${cDiscussionBorder}`,
                                }}
                                initial={{ scale: 0, rotate: -45 }}
                                animate={{ scale: 1, rotate: 0 }}
                                transition={springBouncy}
                              >
                                <Sparkles size={13} style={{ color: cSky }} />
                              </motion.div>
                              <div className="min-w-0 flex-1">
                                <AnimatePresence mode="wait">
                                  {message.status === "thinking" ? (
                                    <motion.div
                                      key="thinking"
                                      initial={{ opacity: 0 }}
                                      animate={{ opacity: 1 }}
                                      exit={{ opacity: 0, scale: 0.98 }}
                                      transition={{ duration: 0.2 }}
                                    >
                                      <ThinkingBlock
                                        text={message.thinkingText || ""}
                                      />
                                    </motion.div>
                                  ) : (
                                    <motion.div
                                      key="done"
                                      initial={{ opacity: 0 }}
                                      animate={{ opacity: 1 }}
                                      transition={{ duration: 0.3 }}
                                    >
                                      <DoneBlock
                                        card={message.resultCard}
                                        onOpenView={setViewerModal}
                                        text={message.text}
                                      />
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            </div>
                          )}
                        </motion.div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <motion.div
                className="relative flex-shrink-0 overflow-hidden px-4 py-3.5"
                style={{
                  borderTop: `1px solid ${cDivider}`,
                  background: `linear-gradient(180deg, rgba(14,49,88,0.98) 0%, ${cSidebarGradMid} 58%, rgba(26,76,126,0.98) 100%)`,
                }}
              >
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 top-0 h-px"
                  style={{
                    background:
                      "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.45) 18%, rgba(255,255,255,0.85) 50%, rgba(255,255,255,0.45) 82%, transparent 100%)",
                  }}
                />
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute left-6 right-6 top-2 h-12 rounded-full"
                  style={{
                    background:
                      "radial-gradient(circle at center, rgba(118,187,221,0.22) 0%, rgba(118,187,221,0.1) 38%, rgba(118,187,221,0) 78%)",
                    filter: "blur(10px)",
                  }}
                />
                <motion.div
                  className="relative flex items-end gap-2 rounded-[22px] px-3.5 py-2.5 transition-all duration-200"
                  animate={{
                    boxShadow: inputFocused
                      ? `0 0 0 2px ${cSky}, 0 10px 24px rgba(7, 29, 53, 0.32)`
                      : `0 0 0 1px rgba(255,255,255,0.62), 0 10px 24px rgba(7, 29, 53, 0.22)`,
                  }}
                  style={{
                    background:
                      "linear-gradient(180deg, rgba(255,255,255,0.99) 0%, rgba(247,251,255,0.97) 100%)",
                    backdropFilter: "blur(10px)",
                  }}
                >
                  <textarea
                    value={inputValue}
                    onChange={(event) => setInputValue(event.target.value)}
                    onFocus={() => setInputFocused(true)}
                    onBlur={() => setInputFocused(false)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        handleSend();
                      }
                    }}
                    placeholder="Posez une question ou demandez une action..."
                    rows={1}
                    className="mx-[0px] my-[6px] flex-1 resize-none bg-transparent outline-none"
                    style={{
                      fontSize: 13,
                      lineHeight: "1.5",
                      color: cDiscussionText,
                    }}
                  />
                  <motion.button
                    onClick={handleSend}
                    disabled={isProcessing || !inputValue.trim()}
                    className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl"
                    animate={{
                      scale: inputValue.trim() && !isProcessing ? 1 : 0.9,
                      background:
                        inputValue.trim() && !isProcessing ? cSky : "#e2ecf3",
                      border: `1px solid ${cDivider}`,
                    }}
                    whileHover={
                      inputValue.trim() && !isProcessing ? { scale: 1.08 } : {}
                    }
                    whileTap={
                      inputValue.trim() && !isProcessing ? { scale: 0.92 } : {}
                    }
                    transition={springBouncy}
                  >
                    <Send
                      size={14}
                      style={{
                        color:
                          inputValue.trim() && !isProcessing
                            ? cWhite
                            : cDiscussionMuted,
                      }}
                    />
                  </motion.button>
                </motion.div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {viewerModal ? (
        <AssistantResultModal
          isAcceptingOrdonnance={acceptOrdonnanceMutation.isPending}
          onAcceptOrdonnance={(payload) => {
            void acceptOrdonnanceMutation.mutateAsync(payload);
          }}
          onClose={() => setViewerModal(null)}
          onEditOrdonnance={openOrdonnanceEditorFromAssistant}
          view={viewerModal}
        />
      ) : null}
      </AnimatePresence>

      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-[70] flex h-[3.25rem] w-[3.25rem] items-center justify-center rounded-2xl"
        style={{
          background: `linear-gradient(135deg, ${cSidebarGradStart} 0%, ${cSidebarGradMid} 65%, ${cSidebarGradEnd} 100%)`,
          border: `1px solid ${cDivider}`,
          boxShadow: "0 4px 20px rgba(0,0,0,0.35)",
        }}
        whileHover={{
          scale: 1.08,
          boxShadow: "0 6px 28px rgba(0,0,0,0.45)",
        }}
        whileTap={{ scale: 0.92 }}
        transition={springBouncy}
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div
              key="close"
              initial={{ rotate: -90, scale: 0, opacity: 0 }}
              animate={{ rotate: 0, scale: 1, opacity: 1 }}
              exit={{ rotate: 90, scale: 0, opacity: 0 }}
              transition={springBouncy}
            >
              <X size={20} style={{ color: cWhite }} />
            </motion.div>
          ) : (
            <motion.div
              key="spark"
              initial={{ rotate: 90, scale: 0, opacity: 0 }}
              animate={{ rotate: 0, scale: 1, opacity: 1 }}
              exit={{ rotate: -90, scale: 0, opacity: 0 }}
              transition={springBouncy}
            >
              <Sparkles size={20} style={{ color: cWhite }} />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
    </>
  );
}

function ThinkingBlock({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(true);
  const [displayedText, setDisplayedText] = useState("");

  useEffect(() => {
    setDisplayedText("");
    let index = 0;
    const interval = setInterval(() => {
      if (index < text.length) {
        setDisplayedText(text.slice(0, index + 1));
        index += 1;
      } else {
        clearInterval(interval);
      }
    }, 22);

    return () => clearInterval(interval);
  }, [text]);

  return (
    <div className="flex flex-col gap-2">
      <motion.button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2"
        whileTap={{ scale: 0.97 }}
      >
        <StethoscopeThinkingIcon />
        <span
          style={{ fontSize: 12, fontWeight: 500, color: cDiscussionMuted }}
        >
          Reflexion en cours
        </span>
        <motion.div
          animate={{ rotate: expanded ? 90 : 0 }}
          transition={springBouncy}
        >
          <ChevronRight size={11} style={{ color: cDiscussionMuted }} />
        </motion.div>
      </motion.button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ ...springGentle, opacity: { duration: 0.15 } }}
            className="overflow-hidden"
          >
            <motion.div
              className="relative py-2 pl-5"
              style={{ borderLeft: `2px solid ${cDiscussionBorder}` }}
            >
              <motion.div
                className="absolute left-0 top-0 h-6 w-0.5 rounded-full"
                style={{
                  background: `linear-gradient(180deg, ${cSky}, transparent)`,
                }}
                animate={{ top: ["0%", "80%", "0%"] }}
                transition={{
                  duration: 2,
                  repeat: Number.POSITIVE_INFINITY,
                  ease: "easeInOut",
                }}
              />
              <p
                style={{
                  fontSize: 12,
                  color: cDiscussionMuted,
                  lineHeight: "1.55",
                }}
              >
                {displayedText}
                <motion.span
                  animate={{ opacity: [1, 0] }}
                  transition={{
                    duration: 0.5,
                    repeat: Number.POSITIVE_INFINITY,
                  }}
                  style={{ color: cSky }}
                >
                  |
                </motion.span>
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DoneBlock({
  text,
  card,
  onOpenView,
}: {
  text: string;
  card?: ResultCard;
  onOpenView: (view: AssistantResultView) => void;
}) {
  const [displayedText, setDisplayedText] = useState("");

  useEffect(() => {
    setDisplayedText("");
    let index = 0;
    const interval = setInterval(() => {
      if (index < text.length) {
        setDisplayedText(text.slice(0, index + 1));
        index += 1;
      } else {
        clearInterval(interval);
      }
    }, 15);

    return () => clearInterval(interval);
  }, [text]);

  const textDone = displayedText.length >= text.length;
  const parsedText = useMemo(() => parseAssistantStructuredText(text), [text]);

  return (
    <div className="flex flex-col gap-3">
      <ThoughtCollapsed />

      {textDone && parsedText.hasStructure ? (
        <StructuredAssistantText parsed={parsedText} />
      ) : (
        <SimpleAssistantText text={displayedText} textDone={textDone} />
      )}

      {card && textDone && (
        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ ...springPop, delay: 0.1 }}
          className="group relative overflow-hidden rounded-2xl"
          style={{
            border: `1px solid ${cDiscussionBorder}`,
            background: cDiscussionCardBg,
          }}
        >
          <motion.div
            className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            style={{ boxShadow: "inset 0 0 20px rgba(118,187,221,0.14)" }}
          />

          <div className="relative z-10 flex items-stretch">
            <div className="flex-1 px-4 py-3.5">
              <div className="mb-1.5 flex items-center gap-2">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ ...springBouncy, delay: 0.3 }}
                  className="flex h-5 w-5 items-center justify-center rounded-md"
                  style={{ background: cDiscussionCardBg }}
                >
                  <Check size={11} style={{ color: cSky }} />
                </motion.div>
                <p
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: cDiscussionText,
                  }}
                >
                  {card.title}
                </p>
              </div>
              <p
                style={{
                  fontSize: 12,
                  color: cDiscussionMuted,
                  lineHeight: "1.4",
                }}
              >
                {card.description}
              </p>
              {card.view && card.buttonLabel ? (
                <motion.button
                  className="mt-3 flex items-center gap-2 rounded-xl px-4 py-2 transition-all"
                  style={{
                    background: cSky,
                    color: cWhite,
                    fontSize: 12,
                    fontWeight: 500,
                  }}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => onOpenView(card.view!)}
                  type="button"
                  transition={{ delay: 0.4 }}
                  whileHover={{
                    scale: 1.03,
                    boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
                  }}
                  whileTap={{ scale: 0.97 }}
                >
                  <Eye size={13} />
                  {card.buttonLabel}
                </motion.button>
              ) : null}
            </div>
            <motion.div
              className="flex w-16 flex-shrink-0 items-center justify-center"
              style={{ background: cDiscussionCardBg }}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.25 }}
            >
              <motion.div
                animate={{ y: [0, -3, 0] }}
                transition={{
                  duration: 3,
                  repeat: Number.POSITIVE_INFINITY,
                  ease: "easeInOut",
                }}
              >
                <card.icon size={22} style={{ color: cSky }} />
              </motion.div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </div>
  );
}

interface ParsedAssistantSection {
  title: string;
  items: string[];
  paragraphs: string[];
}

interface ParsedAssistantText {
  heading: string | null;
  intro: string[];
  items: string[];
  sections: ParsedAssistantSection[];
  hasStructure: boolean;
}

function StructuredAssistantText({ parsed }: { parsed: ParsedAssistantText }) {
  const hasBodyContent =
    parsed.intro.length > 0 || parsed.items.length > 0 || parsed.sections.length > 0;

  return (
    <div
      className="overflow-hidden rounded-2xl border"
      style={{
        borderColor: cDiscussionBorder,
        background: cDiscussionCardBg,
      }}
    >
      {parsed.heading ? (
        <div
          className="px-4 py-3"
          style={{
            borderBottom: hasBodyContent ? `1px solid ${cDiscussionBorder}` : undefined,
            background: "rgba(118,187,221,0.08)",
          }}
        >
          <p
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: cDiscussionText,
              lineHeight: "1.45",
            }}
          >
            {parsed.heading}
          </p>
        </div>
      ) : null}

      <div className="space-y-3 px-4 py-3">
        {parsed.intro.length > 0 ? (
          <div className="space-y-2">
            {parsed.intro.map((paragraph, index) => (
              <p
                key={`assistant-intro-${index}`}
                style={{
                  fontSize: 12.5,
                  color: cDiscussionText,
                  lineHeight: "1.65",
                }}
              >
                {paragraph}
              </p>
            ))}
          </div>
        ) : null}

        {parsed.items.length > 0 ? (
          <AssistantBulletList
            items={parsed.items}
            itemKeyPrefix="assistant-top-item"
          />
        ) : null}

        {parsed.sections.map((section, index) => (
          <div
            key={`${section.title}-${index}`}
            className="space-y-2 border-t pt-3 first:border-t-0 first:pt-0"
            style={{ borderColor: cDiscussionBorder }}
          >
            <p
              style={{
                fontSize: 11.5,
                fontWeight: 700,
                color: cDiscussionMuted,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              {section.title}
            </p>

            {section.paragraphs.length > 0 ? (
              <div className="space-y-2">
                {section.paragraphs.map((paragraph, paragraphIndex) => (
                  <p
                    key={`${section.title}-paragraph-${paragraphIndex}`}
                    style={{
                      fontSize: 12.5,
                      color: cDiscussionText,
                      lineHeight: "1.65",
                    }}
                  >
                    {paragraph}
                  </p>
                ))}
              </div>
            ) : null}

            {section.items.length > 0 ? (
              <AssistantBulletList
                items={section.items}
                itemKeyPrefix={`${section.title}-item`}
              />
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function parseAssistantStructuredText(text: string): ParsedAssistantText {
  const normalized = normalizeAssistantStructuredSource(text);

  const headingRegex = /\*\*([^*]+?)\*\*/g;
  const matches = [...normalized.matchAll(headingRegex)];

  if (matches.length === 0) {
    return parseAssistantLineStructuredText(normalized);
  }

  const intro = cleanAssistantText(
    normalized.slice(0, matches[0]?.index ?? 0),
  );
  const sections: ParsedAssistantSection[] = [];

  for (let index = 0; index < matches.length; index += 1) {
    const current = matches[index];
    const next = matches[index + 1];
    const rawTitle = cleanAssistantText(current?.[1] ?? "");
    const title = rawTitle.replace(/:\s*$/, "").trim();
    const chunk = normalized
      .slice(
        (current?.index ?? 0) + (current?.[0]?.length ?? 0),
        next?.index ?? normalized.length,
      )
      .trim();

    const bulletMatches = [
      ...chunk.matchAll(/(?:^|\s)\*\s+(.+?)(?=(?:\s+\*\s+)|$)/gs),
    ];
    const items = bulletMatches
      .map((match) => cleanAssistantText(match[1] ?? ""))
      .filter(Boolean);

    const chunkWithoutBullets = cleanAssistantText(
      chunk.replace(/(?:^|\s)\*\s+(.+?)(?=(?:\s+\*\s+)|$)/gs, " "),
    );

    sections.push({
      title: title || `Section ${index + 1}`,
      items,
      paragraphs: splitParagraphs(chunkWithoutBullets),
    });
  }

  const hasStructure = sections.some(
    (section) => section.items.length > 0 || section.paragraphs.length > 0,
  );

  const introParagraphs = splitParagraphs(intro);

  return {
    heading: deriveStructuredHeading(introParagraphs, sections.length > 0),
    intro: normalizeStructuredIntro(introParagraphs, sections.length > 0),
    items: [],
    sections,
    hasStructure,
  };
}

function cleanAssistantText(value: string): string {
  return value
    .replace(/\*\*/g, "")
    .replace(/(^|\s)\*(?=\s|$)/g, " ")
    .replace(/\s+:\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function splitParagraphs(value: string): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(/\n{2,}|(?<=\.)\s+(?=[A-ZÀ-ÖØ-Ý])/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function normalizeAssistantStructuredSource(text: string): string {
  return text
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\*\*\s*/g, "**")
    .replace(/:\s+[-•]\s+/g, ":\n- ")
    .replace(/([.;])\s+[-•]\s+/g, "$1\n- ")
    .replace(/\s+\*\s+(?=[A-ZÀ-ÖØ-Ý(])/g, "\n")
    .replace(/\s+\*\s*$/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseAssistantLineStructuredText(text: string): ParsedAssistantText {
  const lines = text
    .split(/\n+/)
    .map((line) => cleanAssistantText(line))
    .filter(Boolean);

  if (lines.length === 0) {
    return {
      heading: null,
      intro: [],
      items: [],
      sections: [],
      hasStructure: false,
    };
  }

  const sections: ParsedAssistantSection[] = [];
  const intro: string[] = [];
  const items: string[] = [];
  let currentSection: ParsedAssistantSection | null = null;

  for (const line of lines) {
    if (isAssistantSectionHeading(line)) {
      currentSection = {
        title: line.replace(/:\s*$/, ""),
        items: [],
        paragraphs: [],
      };
      sections.push(currentSection);
      continue;
    }

    if (line.startsWith("- ") || line.startsWith("• ")) {
      const item = cleanAssistantText(line.slice(2));
      if (currentSection) {
        currentSection.items.push(item);
      } else {
        items.push(item);
      }
      continue;
    }

    if (!currentSection) {
      intro.push(line);
      continue;
    }

    currentSection.paragraphs.push(line);
  }

  const hasStructure =
    items.length > 0 ||
    (sections.length > 0 &&
      sections.some(
        (section) => section.items.length > 0 || section.paragraphs.length > 0,
      ));

  return {
    heading: deriveStructuredHeading(
      intro,
      items.length > 0 || sections.length > 0,
    ),
    intro: normalizeStructuredIntro(intro, items.length > 0 || sections.length > 0),
    items,
    sections,
    hasStructure,
  };
}

function deriveStructuredHeading(
  intro: string[],
  hasStructuredBody: boolean,
): string | null {
  if (!hasStructuredBody || intro.length === 0) {
    return null;
  }

  const first = intro[0]?.replace(/:\s*$/, "").trim();
  if (!first) {
    return null;
  }

  if (intro.length === 1) {
    return first;
  }

  if (first.length <= 90 && !/[.!?]$/.test(first)) {
    return first;
  }

  return null;
}

function normalizeStructuredIntro(
  intro: string[],
  hasStructuredBody: boolean,
): string[] {
  if (!hasStructuredBody || intro.length === 0) {
    return intro;
  }

  if (intro.length === 1) {
    return [];
  }

  const first = intro[0]?.replace(/:\s*$/, "").trim();
  if (first && first.length <= 90 && !/[.!?]$/.test(first)) {
    return intro.slice(1);
  }

  return intro;
}

function AssistantBulletList({
  items,
  itemKeyPrefix,
}: {
  items: string[];
  itemKeyPrefix: string;
}) {
  return (
    <ul className="space-y-2">
      {items.map((item, index) => (
        <li
          key={`${itemKeyPrefix}-${index}`}
          className="flex items-start gap-2"
          style={{
            fontSize: 12.5,
            color: cDiscussionText,
            lineHeight: "1.6",
          }}
        >
          <span
            className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ background: cSky }}
          />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function isAssistantSectionHeading(line: string): boolean {
  const normalized = line.trim();
  if (!normalized) {
    return false;
  }

  const normalizedWithoutColon = normalized.replace(/:\s*$/, "");
  const sectionKeywords = [
    "historique",
    "antécédents personnels",
    "antécédents familiaux",
    "allergies",
    "traitements actuels",
    "suivis médicaux actifs",
    "suivis medicaux actifs",
    "vaccinations",
    "vaccinations de la patiente",
    "vaccinations du patient",
    "red flags",
    "points de prudence",
    "informations manquantes",
    "arguments en faveur",
    "points de reserve",
    "questions a poser",
    "verifications conseillees",
  ];

  if (
    sectionKeywords.some(
      (keyword) => keyword === normalizedWithoutColon.toLowerCase(),
    )
  ) {
    return true;
  }

  const words = normalizedWithoutColon.split(/\s+/);
  const isCompactHeading = words.length <= 8 && normalizedWithoutColon.length <= 60;
  const hasSentencePunctuation = /[.!?]$/.test(normalizedWithoutColon);
  const uppercaseRatio =
    normalizedWithoutColon.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ]/g, "").length > 0
      ? normalizedWithoutColon
          .replace(/[^A-Za-zÀ-ÖØ-öø-ÿ]/g, "")
          .split("")
          .filter((char) => char === char.toUpperCase()).length /
        normalizedWithoutColon.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ]/g, "").length
      : 0;

  return isCompactHeading && !hasSentencePunctuation && uppercaseRatio > 0.45;
}

function SimpleAssistantText({
  text,
  textDone,
}: {
  text: string;
  textDone: boolean;
}) {
  const tone = classifyAssistantTextTone(text);

  if (!textDone) {
    return (
      <p style={{ fontSize: 13, color: cDiscussionText, lineHeight: "1.55" }}>
        {text}
        <motion.span
          animate={{ opacity: [1, 0] }}
          transition={{ duration: 0.5, repeat: Number.POSITIVE_INFINITY }}
          style={{ color: cSky }}
        >
          |
        </motion.span>
      </p>
    );
  }

  if (tone === "notice" || tone === "warning") {
    const Icon = tone === "warning" ? AlertTriangle : Sparkles;
    return (
      <div
        className="rounded-2xl border px-4 py-3"
        style={{
          borderColor: tone === "warning" ? "#f7cba8" : cDiscussionBorder,
          background:
            tone === "warning"
              ? "rgba(249,115,22,0.06)"
              : "rgba(118,187,221,0.08)",
        }}
      >
        <div className="flex items-start gap-3">
          <div
            className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl"
            style={{
              background:
                tone === "warning"
                  ? "rgba(249,115,22,0.12)"
                  : "rgba(118,187,221,0.16)",
            }}
          >
            <Icon
              size={14}
              style={{ color: tone === "warning" ? "#f97316" : cSky }}
            />
          </div>
          <p
            style={{
              fontSize: 12.5,
              color: cDiscussionText,
              lineHeight: "1.65",
            }}
          >
            {text}
          </p>
        </div>
      </div>
    );
  }

  return (
    <p style={{ fontSize: 12.75, color: cDiscussionText, lineHeight: "1.62" }}>
      {text}
    </p>
  );
}

function classifyAssistantTextTone(text: string): "plain" | "notice" | "warning" {
  const normalized = text.trim().toLowerCase();

  if (
    normalized.startsWith("pour répondre à cette question sur un patient précis") ||
    normalized.startsWith("pour repondre a cette question sur un patient precis")
  ) {
    return "notice";
  }

  if (
    normalized.startsWith("je n'ai pas pu") ||
    normalized.startsWith("aucune ") ||
    normalized.startsWith("ce cas necessite")
  ) {
    return "warning";
  }

  return "plain";
}

function AssistantResultModal({
  view,
  onClose,
  onEditOrdonnance,
  onAcceptOrdonnance,
  isAcceptingOrdonnance,
}: {
  view: AssistantResultView;
  onClose: () => void;
  onEditOrdonnance: (payload: OrdonnanceViewPayload) => void;
  onAcceptOrdonnance: (payload: OrdonnanceViewPayload) => void;
  isAcceptingOrdonnance: boolean;
}) {
  const title =
    view.type === "hypothesis"
      ? "Hypothese diagnostique"
      : view.type === "ordonnance"
        ? "Ordonnance generee"
        : view.payload.title;

  const subtitle =
    view.type === "hypothesis"
      ? view.payload.title
      : view.type === "ordonnance"
        ? view.payload.title
        : "Resultat de l'assistant";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[95] flex items-center justify-center bg-[rgba(10,35,65,0.36)] px-4 py-8"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) {
          onClose();
        }
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.98 }}
        transition={springGentle}
        className="flex max-h-[min(84vh,780px)] w-full max-w-[860px] flex-col overflow-hidden rounded-[24px] border"
        style={{
          background: cWhite,
          borderColor: cDiscussionBorder,
          boxShadow: "0 24px 64px rgba(8,35,63,0.22)",
        }}
      >
        <div
          className="flex items-start justify-between px-6 py-5"
          style={{
            borderBottom: `1px solid ${cDiscussionBorder}`,
            background:
              "linear-gradient(160deg, rgba(240,246,255,0.95) 0%, rgba(255,253,251,1) 100%)",
          }}
        >
          <div>
            <p
              style={{ fontSize: 21, fontWeight: 700, color: cDiscussionText }}
            >
              {title}
            </p>
            <p
              style={{
                marginTop: 4,
                fontSize: 13,
                color: cDiscussionMuted,
              }}
            >
              {subtitle}
            </p>
          </div>

          <button
            className="flex h-9 w-9 items-center justify-center rounded-xl transition-colors"
            onClick={onClose}
            style={{ background: cDiscussionCardBg }}
            type="button"
          >
            <X size={16} style={{ color: cDiscussionText }} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {view.type === "hypothesis" ? (
            <HypothesisResultView payload={view.payload} />
          ) : view.type === "ordonnance" ? (
            <OrdonnanceResultView payload={view.payload} />
          ) : (
            <SimpleResultView payload={view.payload} />
          )}
        </div>

        {view.type === "ordonnance" ? (
          <div
            className="flex items-center justify-between gap-3 px-6 py-4"
            style={{
              borderTop: `1px solid ${cDiscussionBorder}`,
              background: "rgba(240,246,255,0.45)",
            }}
          >
            <button
              className="inline-flex h-[42px] items-center justify-center rounded-[12px] border px-4 text-[14px] font-medium transition-colors"
              onClick={onClose}
              style={{
                borderColor: "#f97316",
                color: "#f97316",
                background: "#fffdfb",
              }}
              type="button"
            >
              Refuser
            </button>

            <div className="flex items-center gap-3">
              <button
                className="inline-flex h-[42px] items-center justify-center rounded-[12px] border px-4 text-[14px] font-medium transition-colors hover:bg-[#f8fbff]"
                onClick={() => onEditOrdonnance(view.payload)}
                style={{
                  borderColor: cDiscussionBorder,
                  color: cDiscussionText,
                  background: cWhite,
                }}
                type="button"
              >
                Modifier
              </button>
              <button
                className="inline-flex h-[42px] min-w-[112px] items-center justify-center rounded-[12px] px-4 text-[14px] font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isAcceptingOrdonnance || !view.payload.rendezVousId}
                onClick={() => onAcceptOrdonnance(view.payload)}
                style={{
                  background: isAcceptingOrdonnance ? "#63b0d6" : cSky,
                }}
                type="button"
              >
                {isAcceptingOrdonnance ? "Enregistrement..." : "Accepter"}
              </button>
            </div>
          </div>
        ) : null}
      </motion.div>
    </motion.div>
  );
}

function HypothesisResultView({ payload }: { payload: HypothesisViewPayload }) {
  return (
    <div className="space-y-6">
      <div
        className="rounded-[22px] border px-5 py-5"
        style={{
          borderColor: cDiscussionBorder,
          background:
            "linear-gradient(180deg, rgba(248,250,252,1) 0%, rgba(240,246,255,0.9) 100%)",
        }}
      >
        <div className="flex flex-wrap items-center gap-3">
          <span
            className="rounded-full px-3 py-1"
            style={{
              background: "rgba(118,187,221,0.18)",
              color: cDiscussionText,
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {formatReadiness(payload.recommendationReadiness)}
          </span>
          <span
            className="rounded-full px-3 py-1"
            style={{
              background: "rgba(15,52,96,0.06)",
              color: cDiscussionMuted,
              fontSize: 12,
              fontWeight: 500,
            }}
          >
            Probleme principal
          </span>
        </div>

        <div className="mt-4 space-y-3">
          <div
            className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl px-4 py-3"
            style={{
              background: "rgba(255,255,255,0.72)",
              border: `1px solid ${cDiscussionBorder}`,
            }}
          >
            <span
              className="rounded-full px-2.5 py-1"
              style={{
                background: "rgba(15,52,96,0.08)",
                color: cDiscussionMuted,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.03em",
                textTransform: "uppercase",
              }}
            >
              Contexte principal
            </span>
            <p
              className="min-w-0 flex-1"
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: cDiscussionText,
                lineHeight: "1.6",
              }}
            >
              {payload.chiefProblem}
            </p>
          </div>

          <div
            className="rounded-2xl px-4 py-3.5"
            style={{ background: "rgba(255,255,255,0.78)" }}
          >
            <p style={{ fontSize: 12, fontWeight: 700, color: cDiscussionMuted }}>
              Synthese clinique
            </p>
            <p
              style={{
                marginTop: 6,
                fontSize: 13,
                color: cDiscussionText,
                lineHeight: "1.7",
              }}
            >
              {payload.diagnosticSummary}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {payload.hypotheses.map((hypothesis, index) => (
          <div
            key={`${hypothesis.label}-${index}`}
            className="rounded-[22px] border px-5 py-5"
            style={{
              borderColor: cDiscussionBorder,
              background: "#fffdfb",
            }}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <p
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: cDiscussionMuted,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Hypothese {index + 1}
                </p>
                <p
                  style={{
                    fontSize: 19,
                    fontWeight: 700,
                    color: cDiscussionText,
                    lineHeight: 1.3,
                  }}
                >
                  {hypothesis.label}
                </p>
              </div>
              <span
                className="rounded-full px-3 py-1.5"
                style={{
                  background: "rgba(118,187,221,0.14)",
                  color: cDiscussionText,
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                Confiance {Math.round(hypothesis.confidence * 100)}%
              </span>
            </div>

            <div
              className="mt-4 rounded-2xl border px-4 py-3"
              style={{
                borderColor: cDiscussionBorder,
                background: cDiscussionCardBg,
              }}
            >
              <p
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: cDiscussionMuted,
                }}
              >
                Lecture clinique
              </p>
              <p
                style={{
                  marginTop: 8,
                  fontSize: 13,
                  color: cDiscussionText,
                  lineHeight: "1.7",
                }}
              >
                {hypothesis.reasoning}
              </p>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <ListSection
                items={hypothesis.evidenceFor}
                title="Arguments en faveur"
              />
              <ListSection
                items={hypothesis.evidenceAgainst}
                title="Points de reserve"
              />
              <ListSection
                items={hypothesis.recommendedNextQuestions}
                title="Questions a poser"
              />
              <ListSection
                items={hypothesis.recommendedNextChecks}
                title="Verifications conseillees"
              />
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <ListSection
          items={payload.redFlags}
          title="Red flags"
          tone="warning"
        />
        <ListSection items={payload.cautionNotes} title="Points de prudence" />
        <ListSection
          items={payload.missingInformation}
          title="Informations manquantes"
        />
      </div>

      <Disclaimer text={payload.disclaimer} />
    </div>
  );
}

function OrdonnanceResultView({ payload }: { payload: OrdonnanceViewPayload }) {
  return (
    <div className="space-y-5">
      <div
        className="rounded-2xl border px-4 py-4"
        style={{
          borderColor: cDiscussionBorder,
          background: cDiscussionCardBg,
        }}
      >
        <p style={{ fontSize: 12, fontWeight: 700, color: cDiscussionMuted }}>
          Probleme clinique
        </p>
        <p
          style={{
            marginTop: 6,
            fontSize: 16,
            fontWeight: 700,
            color: cDiscussionText,
          }}
        >
          {payload.label}
        </p>
        <p style={{ marginTop: 4, fontSize: 13, color: cDiscussionMuted }}>
          {payload.clinicalProblem}
        </p>
        <p
          style={{
            marginTop: 12,
            fontSize: 13,
            color: cDiscussionText,
            lineHeight: "1.6",
          }}
        >
          {payload.rationale}
        </p>
      </div>

      <div className="space-y-3">
        {payload.medications.map((medication, index) => (
          <div
            key={`${medication.medicament_externe_id}-${index}`}
            className="rounded-2xl border px-4 py-4"
            style={{ borderColor: cDiscussionBorder }}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: cDiscussionText,
                  }}
                >
                  {medication.nom_medicament}
                </p>
                <p
                  style={{
                    marginTop: 4,
                    fontSize: 12,
                    color: cDiscussionMuted,
                  }}
                >
                  {medication.dosage || "Dosage a confirmer"}
                </p>
              </div>
              <span
                className="rounded-full px-3 py-1"
                style={{
                  background: "rgba(118,187,221,0.16)",
                  color: cDiscussionText,
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {medication.duree_traitement || "Duree non precisee"}
              </span>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <KeyValue label="Posologie" value={medication.posologie} />
              <KeyValue
                label="Instructions"
                value={
                  medication.instructions || "Aucune instruction specifique"
                }
              />
            </div>

            <div
              className="mt-4 rounded-2xl px-4 py-3"
              style={{ background: cDiscussionCardBg }}
            >
              <p
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: cDiscussionMuted,
                }}
              >
                Justification
              </p>
              <p
                style={{
                  marginTop: 6,
                  fontSize: 13,
                  color: cDiscussionText,
                  lineHeight: "1.6",
                }}
              >
                {medication.justification}
              </p>
            </div>
          </div>
        ))}
      </div>

      {payload.remarks ? (
        <div
          className="rounded-2xl border px-4 py-4"
          style={{ borderColor: cDiscussionBorder }}
        >
          <p style={{ fontSize: 12, fontWeight: 700, color: cDiscussionMuted }}>
            Remarques
          </p>
          <p
            style={{
              marginTop: 6,
              fontSize: 13,
              color: cDiscussionText,
              lineHeight: "1.6",
            }}
          >
            {payload.remarks}
          </p>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <ListSection
          items={payload.warnings}
          title="Avertissements"
          tone="warning"
        />
        <ListSection
          items={payload.globalWarnings}
          title="Points globaux de vigilance"
          tone="warning"
        />
      </div>

      <Disclaimer text={payload.disclaimer} />
    </div>
  );
}

function SimpleResultView({ payload }: { payload: SimpleViewPayload }) {
  return (
    <div className="space-y-4">
      <div
        className="rounded-2xl border px-4 py-4"
        style={{
          borderColor: cDiscussionBorder,
          background: cDiscussionCardBg,
        }}
      >
        <p
          style={{
            fontSize: 14,
            color: cDiscussionText,
            lineHeight: "1.65",
          }}
        >
          {payload.summary}
        </p>
      </div>
      <ListSection items={payload.bulletPoints} title="Details" />
    </div>
  );
}

function ListSection({
  title,
  items,
  tone = "default",
}: {
  title: string;
  items: string[];
  tone?: "default" | "warning";
}) {
  if (!items.length) {
    return null;
  }

  return (
    <div
      className="rounded-2xl border px-4 py-4"
      style={{
        borderColor:
          tone === "warning" ? "rgba(249,115,22,0.28)" : cDiscussionBorder,
        background: tone === "warning" ? "#fff7ed" : cDiscussionCardBg,
      }}
    >
      <p
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: cDiscussionMuted,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
      >
        {title}
      </p>
      <ul className="mt-3 space-y-2.5">
        {items.map((item, index) => (
          <li
            key={`${title}-${index}-${item}`}
            className="flex items-start gap-2"
            style={{ fontSize: 12.5, color: cDiscussionText, lineHeight: "1.65" }}
          >
            {tone === "warning" ? (
              <AlertTriangle
                className="mt-[2px] size-4 shrink-0"
                style={{ color: "#f97316" }}
              />
            ) : (
              <span
                className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: cSky }}
              />
            )}
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Disclaimer({ text }: { text: string }) {
  return (
    <div
      className="rounded-2xl border px-4 py-3"
      style={{ borderColor: cDiscussionBorder, background: cDiscussionCardBg }}
    >
      <p style={{ fontSize: 12, color: cDiscussionMuted, lineHeight: "1.6" }}>
        {text}
      </p>
    </div>
  );
}

function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-2xl px-4 py-3"
      style={{ background: cDiscussionCardBg }}
    >
      <p style={{ fontSize: 12, fontWeight: 700, color: cDiscussionMuted }}>
        {label}
      </p>
      <p
        style={{
          marginTop: 6,
          fontSize: 13,
          color: cDiscussionText,
          lineHeight: "1.6",
        }}
      >
        {value}
      </p>
    </div>
  );
}

function formatReadiness(value: string) {
  switch (value) {
    case "ready_for_recommendation":
      return "Pret pour recommandation";
    case "needs_more_information":
      return "Informations supplementaires necessaires";
    case "urgent_medical_review":
      return "Revue medicale urgente";
    default:
      return value;
  }
}

function ThoughtCollapsed() {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.button
      onClick={() => setExpanded(!expanded)}
      className="w-fit rounded-lg px-2.5 py-1"
      style={{ background: "transparent" }}
      whileHover={{ background: cDiscussionCardBg }}
      whileTap={{ scale: 0.97 }}
    >
      <div className="flex items-center gap-2">
        <motion.div
          className="flex h-4 w-4 items-center justify-center rounded-full"
          style={{ background: cDiscussionCardBg }}
        >
          <Check size={9} style={{ color: cSky }} />
        </motion.div>
        <span
          style={{ fontSize: 11, fontWeight: 500, color: cDiscussionMuted }}
        >
          Reflexion terminee
        </span>
        <motion.div
          animate={{ rotate: expanded ? 90 : 0 }}
          transition={springBouncy}
        >
          <ChevronRight size={10} style={{ color: cDiscussionMuted }} />
        </motion.div>
      </div>
    </motion.button>
  );
}
