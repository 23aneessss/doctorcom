import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle, Bot, Loader2, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { trpcClient } from "@/utils/trpc";

export type OrdonnanceAiDraftMedicament = {
  medicament_externe_id: string;
  nom_medicament: string;
  dci: string | null;
  dosage: string | null;
  posologie: string;
  duree_traitement: string | null;
  instructions: string | null;
  justification: string;
  is_active_treatment?: boolean;
};

export type OrdonnanceAiRecommendation = {
  label: string;
  rationale: string;
  warnings: string[];
  ordonnance_draft: {
    remarques: string | null;
    medicaments: OrdonnanceAiDraftMedicament[];
  };
};

type OrdonnanceAiResult = {
  status: "ready" | "blocked";
  ordonnance_draft: {
    remarques: string | null;
    medicaments: OrdonnanceAiDraftMedicament[];
  } | null;
  clinical_problem_basis: {
    chief_problem: string;
  };
  global_warnings: string[];
  verification_justification?: string | null;
  disclaimer: string;
};

type OrdonnanceAiAsyncResult = {
  generation_id: string;
  verification_status:
    | "draft_ready"
    | "verifying"
    | "verified"
    | "verification_failed";
  verification_error: string | null;
  verification_justification: string | null;
  poll_after_ms: number;
  result: OrdonnanceAiResult;
  draft_result: OrdonnanceAiResult;
  verified_result: OrdonnanceAiResult | null;
  updated_at: string;
};

export function OrdonnanceSugAiDialog({
  open,
  onOpenChange,
  suiviId,
  onAccept,
  variant = "overlay",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suiviId?: string;
  onAccept: (recommendation: OrdonnanceAiRecommendation) => void;
  variant?: "overlay" | "side-panel";
}) {
  const [selectedRank, setSelectedRank] = useState<number | null>(null);

  const recommendationMutation = useMutation({
    mutationFn: async () => {
      if (!suiviId) {
        throw new Error("Veuillez sélectionner un suivi avant de lancer la recommandation IA.");
      }

      return (await trpcClient.ai.ordonnanceRecommendation.startAsyncOrdonnance.mutate({
        suivi_id: suiviId,
      })) as OrdonnanceAiAsyncResult;
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const generationId = recommendationMutation.data?.generation_id;
  const statusQuery = useQuery({
    queryKey: ["ordonnance-ai-generation", generationId],
    enabled:
      open &&
      Boolean(generationId) &&
      recommendationMutation.data?.verification_status !== "verified" &&
      recommendationMutation.data?.verification_status !== "verification_failed",
    queryFn: async () => {
      return (await trpcClient.ai.ordonnanceRecommendation.getGenerationStatus.query({
        generation_id: generationId!,
      })) as OrdonnanceAiAsyncResult;
    },
    refetchInterval: (query) => {
      const data = query.state.data as OrdonnanceAiAsyncResult | undefined;
      if (
        !data ||
        data.verification_status === "draft_ready" ||
        data.verification_status === "verifying"
      ) {
        return recommendationMutation.data?.poll_after_ms ?? 2000;
      }
      return false;
    },
  });

  const activeResult = statusQuery.data?.result ?? recommendationMutation.data?.result;
  const draft = activeResult?.ordonnance_draft;
  const recommendations: OrdonnanceAiRecommendation[] = draft
      ? [
          {
            label: activeResult?.clinical_problem_basis.chief_problem ?? "Ordonnance IA",
            rationale:
              "Brouillon construit a partir des meilleurs candidats medicamenteux valides.",
            warnings: activeResult?.global_warnings ?? [],
            ordonnance_draft: draft,
          },
        ]
    : [];

  const selectedRecommendation = useMemo(() => {
    if (selectedRank === null) {
      return recommendations[0] ?? null;
    }
    return recommendations[selectedRank - 1] ?? null;
  }, [recommendations, selectedRank]);

  useEffect(() => {
    if (!open || !suiviId || recommendationMutation.isPending || recommendationMutation.data) {
      return;
    }

    recommendationMutation.mutate();
  }, [open, suiviId, recommendationMutation.isPending, recommendationMutation.data]);

  if (!open) {
    return null;
  }

  const content = (
    <div className="h-[680px] w-full max-w-[600px] overflow-hidden rounded-[14px] border-[1.6px] border-[#c2e0ef] bg-white shadow-[0px_10px_15px_0px_rgba(118,187,221,0.2),0px_4px_6px_0px_rgba(118,187,221,0.2)]">
        <div className="flex items-start justify-between px-6 pt-6">
          <div className="flex gap-3">
            <div className="flex size-12 items-center justify-center rounded-[10px] bg-[#265284] text-white">
              <Sparkles className="size-5" />
            </div>
            <div>
              <p className="font-['Plus_Jakarta_Sans'] text-[18px] font-bold leading-[28px] text-[#265284]">
                Ordonnance suggérée par l&apos;IA
              </p>
              <p className="font-['Inter'] text-[14px] text-[rgba(100,116,139,0.9)]">
                Basée sur le diagnostic, l&apos;historique médical et les allergies du patient
              </p>
            </div>
          </div>
          <button
            className="cursor-pointer text-[#265284] transition-colors hover:text-[#0f3460]"
            onClick={() => onOpenChange(false)}
            type="button"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="px-6 pt-3">
          <button
            className="inline-flex h-[42px] cursor-pointer items-center gap-2 rounded-[10px] bg-[#265284] px-4 font-['Inter'] text-[14px] font-semibold text-white transition-colors hover:bg-[#1f436d] disabled:cursor-not-allowed disabled:opacity-70"
            disabled={recommendationMutation.isPending || !suiviId}
            onClick={() => {
              setSelectedRank(null);
              recommendationMutation.mutate();
            }}
            type="button"
          >
            {recommendationMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Bot className="size-4" />}
            {recommendationMutation.isPending ? "Génération..." : "Régénérer"}
          </button>
        </div>

        <div className="consultation-modal-scrollbar h-[calc(100%-170px)] overflow-y-auto px-6 pb-4 pt-4">
          {!suiviId ? (
            <p className="rounded-[10px] border border-[#f97316] bg-[#fff7ed] px-3 py-2 font-['Inter'] text-[12px] text-[#f97316]">
              Sélectionnez un suivi dans la fenêtre d&apos;ordonnance pour activer l&apos;IA.
            </p>
          ) : null}

          {selectedRecommendation ? (
            <>
              <div className="mb-3 flex items-center gap-2 rounded-[10px] border border-[#c2e0ef] bg-[#f8fbff] px-3 py-2">
                <span className={`rounded-[8px] px-2 py-1 font-['Inter'] text-[11px] font-semibold ${
                  (statusQuery.data?.verification_status ?? recommendationMutation.data?.verification_status) ===
                  "verified"
                    ? "bg-[#dcfce7] text-[#166534]"
                    : (statusQuery.data?.verification_status ?? recommendationMutation.data?.verification_status) ===
                        "verification_failed"
                      ? "bg-[#fee2e2] text-[#b91c1c]"
                      : "bg-[#fff7ed] text-[#c2410c]"
                }`}>
                  {(statusQuery.data?.verification_status ?? recommendationMutation.data?.verification_status) ===
                  "verified"
                    ? "Verifie par l'IA"
                    : (statusQuery.data?.verification_status ?? recommendationMutation.data?.verification_status) ===
                        "verification_failed"
                      ? "Verification IA echouee"
                      : "Verification IA en cours"}
                </span>
                <p className="font-['Inter'] text-[12px] text-[#265284]">
                  {(statusQuery.data?.verification_status ?? recommendationMutation.data?.verification_status) ===
                  "verified"
                    ? "Le brouillon a ete relu par Gemini."
                    : "Le brouillon est deja utilisable pendant que Gemini le verifie en arriere-plan."}
                </p>
              </div>

              <div className="rounded-[10px] border-[0.8px] border-[#c2e0ef] bg-white px-4 py-3">
                <p className="font-['Inter'] text-[12px] font-bold uppercase tracking-[0.3px] text-[#265284]">
                  Diagnostic
                </p>
                <p className="mt-1 font-['Inter'] text-[14px] font-semibold text-[#265284]">
                  {selectedRecommendation.label}
                </p>
              </div>

              <div className="mt-3 space-y-3">
                {selectedRecommendation.ordonnance_draft.medicaments.map((medicament, index) => (
                  <div
                    key={`${medicament.medicament_externe_id}-${index}`}
                    className="rounded-[10px] border-[0.8px] border-[#c2e0ef] bg-white px-4 py-3"
                  >
                    <div className="flex items-start justify-between">
                      <p className="font-['Inter'] text-[14px] font-bold text-[#265284]">
                        {medicament.nom_medicament}
                      </p>
                      <div className="flex items-center gap-2">
                        {medicament.is_active_treatment ? (
                          <span className="rounded-[8px] border border-[#f97316] bg-[#fff7ed] px-2 py-1 font-['Inter'] text-[11px] text-[#c2410c]">
                            Traitement actif
                          </span>
                        ) : null}
                        <span className="rounded-[8px] bg-[#f0f6ff] px-2 py-1 font-['Inter'] text-[11px] text-[#265284]">
                          {medicament.dosage ?? "Sans dosage"}
                        </span>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-3">
                      <InfoLabel label="Posologie" value={medicament.posologie} />
                      <InfoLabel label="Durée" value={medicament.duree_traitement ?? "-"} />
                      <InfoLabel label="Instructions" value={medicament.instructions ?? "-"} />
                    </div>
                  </div>
                ))}
              </div>

              {selectedRecommendation.warnings.length ? (
                <div className="mt-3 space-y-2 rounded-[10px] border border-[#f97316] bg-[#fff7ed] px-3 py-3">
                  {selectedRecommendation.warnings.map((warning, index) => (
                    <div key={`${warning}-${index}`} className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 size-4 text-[#f97316]" />
                      <p className="font-['Inter'] text-[12px] text-[#b45309]">{warning}</p>
                    </div>
                  ))}
                </div>
              ) : null}
              {(statusQuery.data?.verification_error ?? recommendationMutation.data?.verification_error) ? (
                <div className="mt-3 rounded-[10px] border border-[#ef4444] bg-[#fef2f2] px-3 py-3 font-['Inter'] text-[12px] text-[#b91c1c]">
                  {statusQuery.data?.verification_error ?? recommendationMutation.data?.verification_error}
                </div>
              ) : null}

            </>
          ) : (
            <div className="rounded-[10px] border border-dashed border-[#c2e0ef] bg-[#f8fafc] p-6 text-center">
              <p className="font-['Inter'] text-[14px] text-[#64748b]">
                {recommendationMutation.isPending
                  ? "Génération des suggestions IA..."
                  : "Aucune recommandation disponible."}
              </p>
            </div>
          )}
        </div>

        <div className="px-6 pb-4">
          <div className="flex items-center gap-2">
              {recommendations.slice(0, 3).map((item, index) => (
                <button
                  key={`${item.label}-${index}`}
                  className={`h-[30px] cursor-pointer rounded-[8px] px-3 font-['Inter'] text-[12px] ${
                  selectedRecommendation === item
                    ? "bg-[#265284] text-white"
                    : "border border-[#c2e0ef] text-[#265284]"
                }`}
                  onClick={() => setSelectedRank(index + 1)}
                  type="button"
                >
                  Option {index + 1}
                </button>
              ))}
          </div>

          <div className="mt-3 flex items-center justify-end gap-3">
            <button
              className="h-[37.6px] cursor-pointer rounded-[10px] border border-[#f97316] px-4 font-['Inter'] text-[14px] text-[#f97316] transition-colors hover:bg-[#fff7ed]"
              onClick={() => onOpenChange(false)}
              type="button"
            >
              Annuler
            </button>
            <button
              className="inline-flex h-[48px] cursor-pointer items-center gap-2 rounded-[10px] bg-[#76bbdd] px-4 font-['Inter'] text-[16px] font-semibold text-white transition-colors hover:bg-[#63b0d6] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!selectedRecommendation}
              onClick={() => {
                if (!selectedRecommendation) return;
                onAccept(selectedRecommendation);
                toast.success("Suggestion IA appliquée au brouillon");
                onOpenChange(false);
              }}
              type="button"
            >
              Accepter l&apos;ordonnance
            </button>
          </div>

          <p className="mt-3 border-t-[0.8px] border-[#c2e0ef] pt-3 text-center font-['Inter'] text-[12px] text-[rgba(100,116,139,0.9)]">
            ⚠️ Les suggestions IA sont basées sur les données cliniques du patient et{" "}
            <span className="font-semibold text-[#265284]">doivent être validées par le médecin</span>
          </p>
        </div>
      </div>
  );

  if (variant === "side-panel") {
    return content;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(10,35,65,0.2)] px-3"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) {
          onOpenChange(false);
        }
      }}
    >
      {content}
    </div>
  );
}

function InfoLabel({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-['Inter'] text-[11px] text-[rgba(100,116,139,0.9)]">{label}</p>
      <p className="mt-1 font-['Inter'] text-[12px] font-semibold text-[#265284]">{value}</p>
    </div>
  );
}
