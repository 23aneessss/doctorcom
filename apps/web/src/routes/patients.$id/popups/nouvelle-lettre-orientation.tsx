import { useMutation, useQuery } from "@tanstack/react-query";
import {
  CircleHelp,
  Loader2,
  Mail,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { trpc, trpcClient } from "@/utils/trpc";

type UrgenceLettre = "normale" | "urgente" | "tres_urgente";

type CategoryRow = {
  id: string;
  nom: string;
  description: string | null;
};

type SuiviLite = {
  id: string;
  motif: string;
  date_ouverture: string;
};

type LettreAiResult = {
  output?: {
    contenu_lettre?: string;
    raison?: string;
    examen_demande?: string;
    urgence?: string;
  };
};

type NouvelleLettreOrientationDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  startWithAi?: boolean;
  onCreated?: () => void | Promise<void>;
};

const URGENCE_OPTIONS: Array<{ value: UrgenceLettre; label: string }> = [
  { value: "normale", label: "Normale" },
  { value: "urgente", label: "Urgente" },
  { value: "tres_urgente", label: "Très urgente" },
];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function createGeneratedDocumentKey(prefix: string) {
  const randomPart =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return `generated/${prefix}/${randomPart}.pdf`;
}

function normalizeLabel(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function normalizeUrgence(value: string | undefined): UrgenceLettre {
  const normalized = normalizeLabel(value ?? "");
  if (normalized.includes("tres")) return "tres_urgente";
  if (normalized.includes("urgent")) return "urgente";
  return "normale";
}

async function resolveDocumentCategoryId(
  categories: CategoryRow[],
  preferredNames: string[],
  description: string,
) {
  const normalizedNames = preferredNames.map(normalizeLabel);
  const existing = categories.find((category) => {
    const label = normalizeLabel(category.nom);
    return normalizedNames.some((name) => label.includes(name) || name.includes(label));
  });

  if (existing) return existing.id;

  const created = await trpcClient.documents.creerCategorie.mutate({
    nom: preferredNames[0] ?? "Lettres d'orientation",
    description,
  });

  return created.id;
}

function FieldLabel({
  text,
  required = false,
}: {
  text: string;
  required?: boolean;
}) {
  return (
    <label className="font-['Plus_Jakarta_Sans'] text-[13px] font-semibold uppercase tracking-[0.02em] text-[#71829a]">
      {text}
      {required ? <span className="text-[#f97316]">*</span> : null}
    </label>
  );
}

function inputClassName(extra = "") {
  return [
    "h-[43px] w-full rounded-[12px] border-[1.2px] border-[#c2e0ef]",
    "bg-white px-3 font-['Inter'] text-[14px] text-[#0f3460]",
    "outline-none transition-colors placeholder:text-[#9aa9bb]",
    "focus:border-[#76bbdd] focus:ring-2 focus:ring-[#dff1fa]",
    extra,
  ].join(" ");
}

export function NouvelleLettreOrientationDialog({
  open,
  onOpenChange,
  patientId,
  startWithAi = false,
  onCreated,
}: NouvelleLettreOrientationDialogProps) {
  const [selectedSuiviId, setSelectedSuiviId] = useState("");
  const [typeExploration, setTypeExploration] = useState("Avis spécialisé");
  const [examenDemande, setExamenDemande] = useState("Évaluation spécialisée");
  const [destinataire, setDestinataire] = useState("Service spécialisé");
  const [urgence, setUrgence] = useState<UrgenceLettre>("normale");
  const [raison, setRaison] = useState("");
  const [contenuLettre, setContenuLettre] = useState("");
  const [instructions, setInstructions] = useState("");
  const autoAiTriggeredRef = useRef(false);

  const suivisQuery = useQuery({
    ...trpc.consultation.getPatientSuivis.queryOptions({ patient_id: patientId }),
    enabled: open,
    throwOnError: false,
  });

  const categoriesQuery = useQuery({
    ...trpc.documents.getToutesCategories.queryOptions(),
    enabled: open,
    throwOnError: false,
  });

  const suivis = useMemo(
    () => ((suivisQuery.data ?? []) as SuiviLite[]).filter((suivi) => suivi.id),
    [suivisQuery.data],
  );

  useEffect(() => {
    if (!open) {
      autoAiTriggeredRef.current = false;
      return;
    }

    setSelectedSuiviId("");
    setTypeExploration("Avis spécialisé");
    setExamenDemande("Évaluation spécialisée");
    setDestinataire("Service spécialisé");
    setUrgence("normale");
    setRaison("");
    setContenuLettre("");
    setInstructions("");
  }, [open]);

  useEffect(() => {
    if (open && !selectedSuiviId && suivis[0]) {
      setSelectedSuiviId(suivis[0].id);
    }
  }, [open, selectedSuiviId, suivis]);

  const generateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedSuiviId) {
        throw new Error("Sélectionnez un suivi avant de générer une lettre.");
      }

      return (await trpcClient.ai.documentRecommendation.generateOrientationLetter.mutate({
        patient_id: patientId,
        suivi_id: selectedSuiviId,
        type_exploration: typeExploration.trim() || "Avis spécialisé",
        examen_demande: examenDemande.trim() || "Évaluation spécialisée",
        destinataire: destinataire.trim() || "Service spécialisé",
        urgence,
        user_instructions: instructions.trim() || undefined,
      })) as LettreAiResult;
    },
    onSuccess: (result) => {
      const output = result.output;
      setContenuLettre(output?.contenu_lettre ?? contenuLettre);
      setRaison(output?.raison ?? raison);
      setExamenDemande(output?.examen_demande ?? examenDemande);
      setUrgence(normalizeUrgence(output?.urgence));
      toast.success("Proposition de lettre générée.");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  useEffect(() => {
    if (
      !open ||
      !startWithAi ||
      autoAiTriggeredRef.current ||
      !selectedSuiviId ||
      generateMutation.isPending
    ) {
      return;
    }

    autoAiTriggeredRef.current = true;
    generateMutation.mutate();
  }, [generateMutation, open, selectedSuiviId, startWithAi]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedSuiviId) {
        throw new Error("Sélectionnez un suivi lié.");
      }

      const categories = (categoriesQuery.data ?? []) as CategoryRow[];
      const categorieId = await resolveDocumentCategoryId(
        categories,
        ["Lettres d'orientation", "Lettre d'orientation"],
        "Lettres d'orientation générées ou rédigées depuis le dossier patient.",
      );

      return trpcClient.documents.creerLettre.mutate({
        document: {
          patient_id: patientId,
          categorie_id: categorieId,
          type_document: "lettre_orientation",
          nom_document: `Lettre d'orientation du ${todayIso()}`,
          chemin_fichier: createGeneratedDocumentKey("lettres-orientation"),
          type_fichier: "application/pdf",
          taille_fichier: 0,
          description: raison.trim() || contenuLettre.trim() || null,
        },
        lettre: {
          suivi_id: selectedSuiviId,
          type_exploration: typeExploration.trim() || null,
          examen_demande: examenDemande.trim() || null,
          raison: raison.trim() || null,
          destinataire: destinataire.trim() || null,
          urgence,
          contenu_lettre: contenuLettre.trim() || null,
        },
      });
    },
    onSuccess: async () => {
      await onCreated?.();
      toast.success("Lettre d'orientation enregistrée.");
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[140] flex items-center justify-center overflow-hidden bg-[rgba(10,35,65,0.24)] px-4 py-8 backdrop-blur-[4px]"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onOpenChange(false);
      }}
      style={{ animation: "ordonnanceOverlayIn 180ms ease-out" }}
    >
      <div className="mx-auto flex w-full max-w-[780px] items-center justify-center">
        <div
          className="flex max-h-[calc(100vh-64px)] w-full flex-col overflow-hidden rounded-[18px] bg-white shadow-[0px_30px_60px_-16px_rgba(15,52,96,0.28)]"
          onMouseDown={(event) => event.stopPropagation()}
          style={{
            animation:
              "ordonnanceDialogIn 220ms cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        >
          <div className="flex h-[75px] items-center justify-between border-b-[0.8px] border-[#c2e0ef] bg-[#f8fafc] px-5">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-[14px] bg-[#eef7fc] text-[#0f3460]">
                <Mail className="size-5" />
              </span>
              <div>
                <h3 className="font-['Plus_Jakarta_Sans'] text-[20px] font-semibold text-[#0f3460]">
                  Nouvelle lettre d'orientation
                </h3>
                <p className="font-['Inter'] text-[12px] font-medium text-[#7a93af]">
                  Préparez un courrier professionnel, modifiable avant validation.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 text-[#0f3460]">
              <CircleHelp className="size-5" strokeWidth={1.8} />
              <button
                className="cursor-pointer transition-colors hover:text-[#265284]"
                onClick={() => onOpenChange(false)}
                type="button"
              >
                <X className="size-6" strokeWidth={1.8} />
              </button>
            </div>
          </div>

          <div className="consultation-modal-scrollbar flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overscroll-contain px-5 pb-6 pt-5">
            <div className="grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
              <div className="flex flex-col gap-2">
                <FieldLabel required text="Suivi lié" />
                <select
                  className={inputClassName("appearance-auto")}
                  onChange={(event) => setSelectedSuiviId(event.target.value)}
                  value={selectedSuiviId}
                >
                  <option value="">Sélectionner un suivi</option>
                  {suivis.map((suivi) => (
                    <option key={suivi.id} value={suivi.id}>
                      {suivi.motif} ({suivi.date_ouverture})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <FieldLabel required text="Urgence" />
                <select
                  className={inputClassName("appearance-auto")}
                  onChange={(event) => setUrgence(event.target.value as UrgenceLettre)}
                  value={urgence}
                >
                  {URGENCE_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <FieldLabel required text="Type d'exploration" />
                <input
                  className={inputClassName()}
                  onChange={(event) => setTypeExploration(event.target.value)}
                  placeholder="Ex: Avis cardiologique"
                  value={typeExploration}
                />
              </div>
              <div className="flex flex-col gap-2">
                <FieldLabel required text="Destinataire" />
                <input
                  className={inputClassName()}
                  onChange={(event) => setDestinataire(event.target.value)}
                  placeholder="Ex: Service ORL"
                  value={destinataire}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <FieldLabel required text="Examen demandé" />
              <input
                className={inputClassName()}
                onChange={(event) => setExamenDemande(event.target.value)}
                placeholder="Ex: Bilan spécialisé, exploration fonctionnelle..."
                value={examenDemande}
              />
            </div>

            <div className="rounded-[14px] border-[1.2px] border-[#c2e0ef] bg-[#f8fcff] p-4">
              <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-['Plus_Jakarta_Sans'] text-[14px] font-semibold uppercase tracking-[0.04em] text-[#0f3460]">
                    Contenu médical
                  </p>
                  <p className="font-['Inter'] text-[12px] text-[#7a93af]">
                    Générez une proposition ou rédigez directement le courrier.
                  </p>
                </div>
                <button
                  className="inline-flex h-[38px] cursor-pointer items-center justify-center gap-2 rounded-[12px] border border-[#c2e0ef] bg-white px-4 font-['Inter'] text-[13px] font-semibold text-[#265284] transition-colors hover:bg-[#eef7fc] disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={generateMutation.isPending || !selectedSuiviId}
                  onClick={() => generateMutation.mutate()}
                  type="button"
                >
                  {generateMutation.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Sparkles className="size-4" />
                  )}
                  Générer avec l'IA
                </button>
              </div>

              <div className="grid gap-3">
                <textarea
                  className="min-h-[86px] w-full resize-none rounded-[12px] border-[1.2px] border-[#c2e0ef] bg-white px-3 py-3 font-['Inter'] text-[14px] leading-6 text-[#0f3460] outline-none transition-colors placeholder:text-[#9aa9bb] focus:border-[#76bbdd] focus:ring-2 focus:ring-[#dff1fa]"
                  onChange={(event) => setRaison(event.target.value)}
                  placeholder="Raison clinique de l'orientation..."
                  value={raison}
                />
                <textarea
                  className="min-h-[190px] w-full resize-none rounded-[12px] border-[1.2px] border-[#c2e0ef] bg-white px-3 py-3 font-['Inter'] text-[14px] leading-6 text-[#0f3460] outline-none transition-colors placeholder:text-[#9aa9bb] focus:border-[#76bbdd] focus:ring-2 focus:ring-[#dff1fa]"
                  onChange={(event) => setContenuLettre(event.target.value)}
                  placeholder="Contenu complet de la lettre..."
                  value={contenuLettre}
                />
                <textarea
                  className="min-h-[72px] w-full resize-none rounded-[12px] border-[1.2px] border-[#c2e0ef] bg-white px-3 py-3 font-['Inter'] text-[13px] leading-5 text-[#0f3460] outline-none transition-colors placeholder:text-[#9aa9bb] focus:border-[#76bbdd] focus:ring-2 focus:ring-[#dff1fa]"
                  onChange={(event) => setInstructions(event.target.value)}
                  placeholder="Instructions optionnelles pour l'IA..."
                  value={instructions}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t-[0.67px] border-[rgba(194,224,239,0.45)] bg-white px-5 py-4">
            <button
              className="h-[38px] rounded-[12px] border border-[#f77a21] px-5 font-['Plus_Jakarta_Sans'] text-[14px] font-medium text-[#f77a21] transition-colors hover:bg-[#fff7ed]"
              onClick={() => onOpenChange(false)}
              type="button"
            >
              Annuler
            </button>
            <button
              className="inline-flex h-[38px] min-w-[150px] items-center justify-center gap-2 rounded-[12px] bg-[#76bbdd] px-5 font-['Inter'] text-[14px] font-medium text-white shadow-[0px_4px_12px_0px_rgba(118,187,221,0.5)] transition-colors hover:bg-[#69b2d6] disabled:cursor-not-allowed disabled:opacity-70"
              disabled={saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
              type="button"
            >
              {saveMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              Enregistrer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
