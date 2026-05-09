import { useMutation, useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  CircleHelp,
  FileArchive,
  Loader2,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { trpc, trpcClient } from "@/utils/trpc";

type CertificatType =
  | "arret_travail"
  | "aptitude"
  | "scolaire"
  | "grossesse"
  | "deces";
type CertificatStatut = "brouillon" | "emis" | "annule";

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

type CertificatAiResult = {
  output?: {
    contenu_certificat?: string;
    diagnostic?: string;
    notes?: string;
  };
};

type NouveauCertMedicalDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  startWithAi?: boolean;
  onCreated?: () => void | Promise<void>;
};

const CERTIFICAT_TYPES: Array<{ value: CertificatType; label: string }> = [
  { value: "arret_travail", label: "Arrêt de travail" },
  { value: "aptitude", label: "Certificat d'aptitude" },
  { value: "scolaire", label: "Certificat scolaire" },
  { value: "grossesse", label: "Certificat de grossesse" },
  { value: "deces", label: "Certificat de décès" },
];

const CERTIFICAT_STATUTS: Array<{ value: CertificatStatut; label: string }> = [
  { value: "brouillon", label: "Brouillon" },
  { value: "emis", label: "Émis" },
  { value: "annule", label: "Annulé" },
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
    nom: preferredNames[0] ?? "Certificats médicaux",
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

export function NouveauCertMedicalDialog({
  open,
  onOpenChange,
  patientId,
  startWithAi = false,
  onCreated,
}: NouveauCertMedicalDialogProps) {
  const [selectedSuiviId, setSelectedSuiviId] = useState("");
  const [typeCertificat, setTypeCertificat] =
    useState<CertificatType>("arret_travail");
  const [dateEmission, setDateEmission] = useState(todayIso());
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");
  const [destinataire, setDestinataire] = useState("");
  const [diagnostic, setDiagnostic] = useState("");
  const [notes, setNotes] = useState("");
  const [instructions, setInstructions] = useState("");
  const [statut, setStatut] = useState<CertificatStatut>("emis");
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
    setTypeCertificat("arret_travail");
    setDateEmission(todayIso());
    setDateDebut("");
    setDateFin("");
    setDestinataire("");
    setDiagnostic("");
    setNotes("");
    setInstructions("");
    setStatut("emis");
  }, [open]);

  useEffect(() => {
    if (open && !selectedSuiviId && suivis[0]) {
      setSelectedSuiviId(suivis[0].id);
    }
  }, [open, selectedSuiviId, suivis]);

  const generateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedSuiviId) {
        throw new Error("Sélectionnez un suivi avant de générer un certificat.");
      }

      return (await trpcClient.ai.documentRecommendation.generateCertificat.mutate({
        patient_id: patientId,
        suivi_id: selectedSuiviId,
        type_certificat: typeCertificat,
        date_debut: dateDebut.trim() || undefined,
        date_fin: dateFin.trim() || undefined,
        destinataire: destinataire.trim() || undefined,
        user_instructions: instructions.trim() || undefined,
      })) as CertificatAiResult;
    },
    onSuccess: (result) => {
      const output = result.output;
      setDiagnostic(output?.diagnostic ?? diagnostic);
      const contentParts = [
        output?.contenu_certificat,
        output?.notes ? `Notes: ${output.notes}` : null,
      ].filter(Boolean);
      setNotes(contentParts.join("\n\n"));
      toast.success("Proposition de certificat générée.");
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
        ["Certificats médicaux", "Certificat médical"],
        "Certificats médicaux générés ou rédigés depuis le dossier patient.",
      );
      const typeLabel =
        CERTIFICAT_TYPES.find((item) => item.value === typeCertificat)?.label ??
        "Certificat médical";

      return trpcClient.documents.creerCertificat.mutate({
        document: {
          patient_id: patientId,
          categorie_id: categorieId,
          type_document: "certificat_medical",
          nom_document: `${typeLabel} du ${dateEmission}`,
          chemin_fichier: createGeneratedDocumentKey("certificats-medicaux"),
          type_fichier: "application/pdf",
          taille_fichier: 0,
          description: diagnostic.trim() || notes.trim() || null,
        },
        certificat: {
          suivi_id: selectedSuiviId,
          type_certificat: typeCertificat,
          date_emission: dateEmission,
          date_debut: dateDebut.trim() || null,
          date_fin: dateFin.trim() || null,
          diagnostic: diagnostic.trim() || null,
          destinataire: destinataire.trim() || null,
          notes: notes.trim() || null,
          statut,
        },
      });
    },
    onSuccess: async () => {
      await onCreated?.();
      toast.success("Certificat médical enregistré.");
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  if (!open) return null;

  const isSaveBlocked =
    !selectedSuiviId ||
    !dateEmission ||
    !typeCertificat ||
    !statut;

  return (
    <div
      className="fixed inset-0 z-[140] flex items-center justify-center overflow-hidden bg-[rgba(10,35,65,0.24)] px-4 py-8 backdrop-blur-[4px]"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onOpenChange(false);
      }}
      style={{ animation: "ordonnanceOverlayIn 180ms ease-out" }}
    >
      <div className="mx-auto flex w-full max-w-[760px] items-center justify-center">
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
                <FileArchive className="size-5" />
              </span>
              <div>
                <h3 className="font-['Plus_Jakarta_Sans'] text-[20px] font-semibold text-[#0f3460]">
                  Nouveau certificat médical
                </h3>
                <p className="font-['Inter'] text-[12px] font-medium text-[#7a93af]">
                  Rédaction manuelle ou proposition IA validée par le médecin
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 text-[#0f3460]">
              <button
                aria-label="Aide"
                className="cursor-pointer transition-colors hover:text-[#265284]"
                data-context-help-href="/aide/ordonnances#templates"
                type="button"
              >
                <CircleHelp className="size-5" strokeWidth={1.8} />
              </button>
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
                <FieldLabel required text="Date d'émission" />
                <div className="relative">
                  <CalendarDays className="pointer-events-none absolute left-3 top-[12px] size-4 text-[#7a93af]" />
                  <input
                    className={inputClassName("pl-9")}
                    onChange={(event) => setDateEmission(event.target.value)}
                    type="date"
                    value={dateEmission}
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <FieldLabel required text="Type de certificat" />
                <select
                  className={inputClassName("appearance-auto")}
                  onChange={(event) =>
                    setTypeCertificat(event.target.value as CertificatType)
                  }
                  value={typeCertificat}
                >
                  {CERTIFICAT_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <FieldLabel required text="Statut" />
                <select
                  className={inputClassName("appearance-auto")}
                  onChange={(event) => setStatut(event.target.value as CertificatStatut)}
                  value={statut}
                >
                  {CERTIFICAT_STATUTS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <FieldLabel text="Date de début" />
                <input
                  className={inputClassName()}
                  onChange={(event) => setDateDebut(event.target.value)}
                  type="date"
                  value={dateDebut}
                />
              </div>
              <div className="flex flex-col gap-2">
                <FieldLabel text="Date de fin" />
                <input
                  className={inputClassName()}
                  onChange={(event) => setDateFin(event.target.value)}
                  type="date"
                  value={dateFin}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <FieldLabel text="Destinataire" />
              <input
                className={inputClassName()}
                onChange={(event) => setDestinataire(event.target.value)}
                placeholder="Ex: Employeur, école, administration..."
                value={destinataire}
              />
            </div>

            <div className="rounded-[14px] border-[1.2px] border-[#c2e0ef] bg-[#f8fcff] p-4">
              <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-['Plus_Jakarta_Sans'] text-[14px] font-semibold uppercase tracking-[0.04em] text-[#0f3460]">
                    Rédaction clinique
                  </p>
                  <p className="font-['Inter'] text-[12px] text-[#7a93af]">
                    L'IA prépare un brouillon, le médecin garde la validation finale.
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
                <input
                  className={inputClassName()}
                  onChange={(event) => setDiagnostic(event.target.value)}
                  placeholder="Diagnostic ou motif clinique"
                  value={diagnostic}
                />
                <textarea
                  className="min-h-[150px] w-full resize-none rounded-[12px] border-[1.2px] border-[#c2e0ef] bg-white px-3 py-3 font-['Inter'] text-[14px] leading-6 text-[#0f3460] outline-none transition-colors placeholder:text-[#9aa9bb] focus:border-[#76bbdd] focus:ring-2 focus:ring-[#dff1fa]"
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Contenu du certificat, restrictions, durée, observations..."
                  value={notes}
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
              className="inline-flex h-[38px] min-w-[150px] items-center justify-center gap-2 rounded-[12px] bg-[#76bbdd] px-5 font-['Inter'] text-[14px] font-medium text-white shadow-[0px_4px_12px_0px_rgba(118,187,221,0.5)] transition-colors hover:bg-[#69b2d6] disabled:cursor-not-allowed disabled:bg-[#c2e0ef] disabled:text-[#6b819d] disabled:shadow-none"
              disabled={saveMutation.isPending || isSaveBlocked}
              onClick={() => saveMutation.mutate()}
              type="button"
            >
              {saveMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              Enregistrer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
