import { useMutation } from "@tanstack/react-query";
import { AlertTriangle, Loader2, Sparkles, X } from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";

import { trpcClient } from "@/utils/trpc";

type MedicationAssistantResult = {
  answer: string;
  referenced_medicaments: Array<{
    medicament_externe_id: string;
    nom_medicament: string;
    dci: string | null;
    classe_therapeutique: string | null;
    why_relevant: string;
    highlights: string[];
  }>;
  warnings: string[];
};

export function MedicamentSugAiDialog({
  open,
  onOpenChange,
  suiviLabel,
  onSelectMedicament,
  variant = "overlay",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suiviLabel?: string;
  onSelectMedicament: (payload: {
    medicament_externe_id: string;
    nom_medicament: string;
    dci: string | null;
    classe_therapeutique: string | null;
  }) => void;
  variant?: "overlay" | "side-panel";
}) {
  const chatMutation = useMutation({
    mutationFn: async () => {
      const userMessage = suiviLabel
        ? `Suggère 6 médicaments pertinents pour ce contexte clinique: ${suiviLabel}. Retourne les options les plus utiles.`
        : "Suggère 6 médicaments polyvalents courants en médecine générale.";

      return (await trpcClient.ai.medicationAssistant.chat.mutate({
        messages: [{ role: "user", content: userMessage }],
        max_candidates: 8,
      })) as MedicationAssistantResult;
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const suggestions = chatMutation.data?.referenced_medicaments ?? [];

  const warningText = useMemo(() => {
    return chatMutation.data?.warnings?.[0] ?? null;
  }, [chatMutation.data?.warnings]);

  if (!open) {
    return null;
  }

  const content = (
    <div className="h-[723px] w-full max-w-[613px] overflow-hidden rounded-[14px] border-[1.6px] border-[#c2e0ef] bg-white shadow-[0px_10px_15px_0px_rgba(118,187,221,0.2),0px_4px_6px_0px_rgba(118,187,221,0.2)]">
        <div className="flex items-start justify-between px-6 pt-6">
          <div className="flex gap-3">
            <div className="flex size-12 items-center justify-center rounded-[10px] bg-[#265284] text-white">
              <Sparkles className="size-5" />
            </div>
            <div>
              <p className="font-['Plus_Jakarta_Sans'] text-[18px] font-bold leading-[28px] text-[#265284]">
                Médicament suggérée par l&apos;IA
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

        <div className="px-6 pt-4">
          <button
            className="inline-flex h-[42px] cursor-pointer items-center gap-2 rounded-[10px] bg-[#76bbdd] px-4 font-['Plus_Jakarta_Sans'] text-[14px] font-medium text-white transition-colors hover:bg-[#63b0d6] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={chatMutation.isPending}
            onClick={() => chatMutation.mutate()}
            type="button"
          >
            {chatMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            {chatMutation.isPending ? "Génération..." : "Générer des suggestions"}
          </button>
        </div>

        <div className="consultation-modal-scrollbar mt-4 grid max-h-[510px] grid-cols-2 gap-x-[10px] gap-y-4 overflow-y-auto px-6 pb-4">
          {suggestions.length === 0 ? (
            <div className="col-span-2 rounded-[16px] border border-[#c2e0ef] bg-white p-6 text-center font-['Inter'] text-[14px] text-[rgba(100,116,139,0.9)]">
              Cliquez sur "Générer des suggestions" pour afficher les médicaments proposés.
            </div>
          ) : (
            suggestions.slice(0, 6).map((item) => (
              <button
                key={item.medicament_externe_id}
                className="h-[151px] cursor-pointer rounded-[16px] border border-[#c2e0ef] bg-white px-[10px] py-5 text-left shadow-[0px_4px_20px_0px_rgba(194,224,239,0.5)] transition-colors hover:bg-[#f8fbff]"
                onClick={() => {
                  onSelectMedicament({
                    medicament_externe_id: item.medicament_externe_id,
                    nom_medicament: item.nom_medicament,
                    dci: item.dci,
                    classe_therapeutique: item.classe_therapeutique,
                  });
                }}
                type="button"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-['Plus_Jakarta_Sans'] text-[17px] font-bold text-[#0f3460]">
                      {item.nom_medicament}
                    </p>
                    <p className="font-['Plus_Jakarta_Sans'] text-[13px] text-[#265284]/70">
                      {item.dci ?? "DCI non renseignée"}
                    </p>
                  </div>
                  <span className="rounded-[8px] bg-[#265284] px-3 py-1 font-['Plus_Jakarta_Sans'] text-[12px] font-semibold text-white">
                    IA
                  </span>
                </div>
                <div className="mt-3 rounded-[8px] border border-[#c2e0ef] bg-[#fffdfb] px-3 py-1 font-['Plus_Jakarta_Sans'] text-[12px] font-semibold text-[#265284]">
                  {item.classe_therapeutique ?? "Classe thérapeutique"}
                </div>
                <p className="mt-2 line-clamp-1 font-['Plus_Jakarta_Sans'] text-[14px] text-[#265284]">
                  {item.why_relevant}
                </p>
              </button>
            ))
          )}
        </div>

        <div className="mx-6 border-t-[0.8px] border-[#c2e0ef] pt-4">
          <p className="text-center font-['Inter'] text-[12px] text-[rgba(100,116,139,0.9)]">
            ⚠️ Les suggestions IA sont basées sur les données cliniques du patient et{" "}
            <span className="font-semibold text-[#265284]">doivent être validées par le médecin</span>
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
