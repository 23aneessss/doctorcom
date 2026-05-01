import { useMutation } from "@tanstack/react-query";
import { AlertTriangle, Loader2, Sparkles, X } from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";

import { trpcClient } from "@/utils/trpc";

type RecommendMedicamentsResult = {
  merged_candidates: Array<{
    medicament_externe_id: string;
    nom_medicament: string;
    dci: string | null;
    dosage: string | null;
    posologie: string | null;
    duree_traitement: string | null;
    instructions: string | null;
    justification: string | null;
    is_active_treatment?: boolean;
  }>;
  global_warnings: string[];
};

export function MedicamentSugAiDialog({
  open,
  onOpenChange,
  suiviId,
  suiviLabel,
  onSelectMedicament,
  variant = "overlay",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suiviId?: string;
  suiviLabel?: string;
  onSelectMedicament: (payload: {
    medicament_externe_id: string;
    nom_medicament: string;
    dci: string | null;
    dosage: string | null;
    posologie: string | null;
    duree_traitement: string | null;
    instructions: string | null;
  }) => void;
  variant?: "overlay" | "side-panel";
}) {
  const chatMutation = useMutation({
    mutationFn: async () => {
      if (!suiviId) {
        throw new Error("Veuillez selectionner un suivi avant de lancer la recommandation IA.");
      }

      return (await trpcClient.ai.ordonnanceRecommendation.recommendMedicaments.mutate({
        suivi_id: suiviId,
        include_historical_context: true,
        max_historical_suivis: 5,
        max_historical_treatments: 8,
      })) as RecommendMedicamentsResult;
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const suggestions = chatMutation.data?.merged_candidates ?? [];

  const warningText = useMemo(() => {
    return chatMutation.data?.global_warnings?.[0] ?? null;
  }, [chatMutation.data?.global_warnings]);

  if (!open) {
    return null;
  }

  const content = (
    <div className="flex h-[min(723px,calc(100dvh-2rem))] w-full max-w-[600px] flex-col overflow-hidden rounded-[14px] border-[1.6px] border-[#c2e0ef] bg-white shadow-[0px_10px_15px_0px_rgba(118,187,221,0.2),0px_4px_6px_0px_rgba(118,187,221,0.2)]">
      <div className="flex items-start justify-between px-6 pt-6">
        <div className="flex gap-3">
          <div className="flex size-12 items-center justify-center rounded-[10px] bg-[#265284] text-white">
            <Sparkles className="size-5" />
          </div>
          <div>
            <p className="font-['Plus_Jakarta_Sans'] text-[18px] font-bold leading-[28px] text-[#265284]">
              Medicaments suggeres par l&apos;IA
            </p>
            <p className="font-['Inter'] text-[14px] text-[rgba(100,116,139,0.9)]">
              Base sur le diagnostic, l&apos;historique medical et les allergies du patient
            </p>
            {suiviLabel ? (
              <p className="mt-1 line-clamp-1 font-['Inter'] text-[12px] text-[#64748b]">
                Suivi: {suiviLabel}
              </p>
            ) : null}
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

      <div className="px-6 pt-4">
        <button
          className="inline-flex h-[42px] cursor-pointer items-center gap-2 rounded-[10px] bg-[#76bbdd] px-4 font-['Plus_Jakarta_Sans'] text-[14px] font-medium text-white transition-colors hover:bg-[#63b0d6] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={chatMutation.isPending || !suiviId}
          onClick={() => chatMutation.mutate()}
          type="button"
        >
          {chatMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          {chatMutation.isPending ? "Generation..." : "Generer des suggestions"}
        </button>
      </div>

      <div className="consultation-modal-scrollbar mt-4 grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-y-auto px-5 pb-4 sm:grid-cols-2 sm:px-6">
        {suggestions.length === 0 ? (
          <div className="rounded-[16px] border border-[#c2e0ef] bg-white p-6 text-center font-['Inter'] text-[14px] text-[rgba(100,116,139,0.9)] sm:col-span-2">
            Cliquez sur "Generer des suggestions" pour afficher les medicaments proposes.
          </div>
        ) : (
          suggestions.slice(0, 6).map((item) => (
            <button
              key={item.medicament_externe_id}
              className="min-h-[174px] cursor-pointer rounded-[14px] border border-[#c2e0ef] bg-white px-3 py-4 text-left shadow-[0px_4px_20px_0px_rgba(194,224,239,0.35)] transition-colors hover:bg-[#f8fbff]"
              onClick={() => {
                onSelectMedicament({
                  medicament_externe_id: item.medicament_externe_id,
                  nom_medicament: item.nom_medicament,
                  dci: item.dci,
                  dosage: item.dosage,
                  posologie: item.posologie,
                  duree_traitement: item.duree_traitement,
                  instructions: item.instructions,
                });
              }}
              type="button"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="break-words font-['Plus_Jakarta_Sans'] text-[16px] font-bold leading-[21px] text-[#0f3460]">
                    {item.nom_medicament}
                  </p>
                  <p className="mt-1 line-clamp-2 font-['Plus_Jakarta_Sans'] text-[12px] leading-4 text-[#265284]/70">
                    {item.dci ?? "DCI non renseignee"}
                  </p>
                </div>
                <span className="ml-2 shrink-0 rounded-[8px] bg-[#265284] px-3 py-1 font-['Plus_Jakarta_Sans'] text-[12px] font-semibold text-white">
                  IA
                </span>
              </div>
              {item.is_active_treatment ? (
                <div className="mt-2 inline-flex rounded-[8px] border border-[#f97316] bg-[#fff7ed] px-2 py-1 font-['Plus_Jakarta_Sans'] text-[11px] font-semibold text-[#c2410c]">
                  Traitement actif
                </div>
              ) : null}
              <div className="mt-3 rounded-[8px] border border-[#c2e0ef] bg-[#fffdfb] px-3 py-1 font-['Plus_Jakarta_Sans'] text-[12px] font-semibold text-[#265284]">
                {item.dosage ?? "Dosage a confirmer"}
              </div>
              <p className="mt-2 line-clamp-2 font-['Plus_Jakarta_Sans'] text-[13px] leading-5 text-[#265284]">
                {item.justification ?? "Suggestion issue du moteur de recommandation clinique."}
              </p>
            </button>
          ))
        )}
      </div>

      <div className="mx-5 shrink-0 border-t-[0.8px] border-[#c2e0ef] py-4 sm:mx-6">
        <p className="text-center font-['Inter'] text-[12px] text-[rgba(100,116,139,0.9)]">
          Attention: les suggestions IA sont basees sur les donnees cliniques du patient et{" "}
          <span className="font-semibold text-[#265284]">doivent etre validees par le medecin</span>
        </p>
        {warningText ? (
          <div className="mt-2 flex items-start gap-2 rounded-[8px] border border-[#f97316] bg-[#fff7ed] px-2 py-1.5">
            <AlertTriangle className="size-4 text-[#f97316]" />
            <p className="font-['Inter'] text-[12px] text-[#b45309]">{warningText}</p>
          </div>
        ) : null}
      </div>
    </div>
  );

  if (variant === "side-panel") {
    return content;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-[rgba(10,35,65,0.2)] p-4"
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
