import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  FileText,
  FlaskConical,
  Shield,
  Tag,
} from "lucide-react";
import { toast } from "sonner";

import { trpc, trpcClient } from "@/utils/trpc";

import {
  aggregateToFormValues,
  buildUpdatePayload,
  getPrimaryCategory,
  type MedicationAggregate,
  type MedicationFormValues,
} from "../components/-medication-helpers";
import { medicationFormSchema } from "./-medication-dialog-shared";

export function VoirMedicamentDialog({
  open,
  onOpenChange,
  medicamentId,
  onDelete,
  isDeleting = false,
  isEditing,
  onEditModeChange,
  onUpdated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  medicamentId?: number | null;
  onDelete: (id: number) => void;
  isDeleting?: boolean;
  isEditing: boolean;
  onEditModeChange: (value: boolean) => void;
  onUpdated?: () => void;
}) {
  const detailQuery = useQuery({
    ...trpc.medicaments.getMedicamentById.queryOptions({ id: medicamentId ?? 1 }),
    enabled: open && Boolean(medicamentId),
  });

  const initialValues = useMemo(
    () => (detailQuery.data ? aggregateToFormValues(detailQuery.data) : null),
    [detailQuery.data],
  );

  const form = useForm({
    defaultValues: initialValues ?? EMPTY_FORM_VALUES,
    validators: { onSubmit: medicationFormSchema },
    onSubmit: async ({ value }) => {
      if (!medicamentId || !initialValues) {
        toast.error("Médicament introuvable");
        return;
      }
      const payload = buildUpdatePayload(value, initialValues);
      if (Object.keys(payload).length === 0) {
        toast.info("Aucune modification détectée");
        onEditModeChange(false);
        return;
      }
      await updateMutation.mutateAsync({ id: medicamentId, data: payload });
    },
  });

  useEffect(() => {
    if (!open) return;
    function handleEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (isEditing) {
        onEditModeChange(false);
        if (initialValues) form.reset(initialValues);
        return;
      }
      onOpenChange(false);
    }
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [form, initialValues, isEditing, onEditModeChange, onOpenChange, open]);

  useEffect(() => {
    if (initialValues) form.reset(initialValues);
  }, [form, initialValues]);

  const updateMutation = useMutation({
    mutationFn: async (payload: { id: number; data: Record<string, unknown> }) =>
      trpcClient.medicaments.mettreAJourMedicament.mutate({ id: payload.id, data: payload.data }),
    onSuccess: async () => {
      toast.success("Médicament modifié");
      onEditModeChange(false);
      await detailQuery.refetch();
      onUpdated?.();
    },
    onError: (error) => toast.error(error.message),
  });

  if (!open) return null;

  if (detailQuery.isLoading) {
    return (
      <div className="mx-auto w-[1144px] max-w-[calc(100%-48px)] px-[24px] pb-10 pt-[16px]">
        <div className="rounded-[14px] border border-[#dbeaf3] bg-white px-6 py-10 font-['Inter'] text-[14px] text-[#0f3460] shadow-[0px_4px_16px_rgba(194,224,239,0.18)]">
          Chargement du médicament...
        </div>
      </div>
    );
  }

  if (detailQuery.isError || !detailQuery.data || !medicamentId || !initialValues) {
    return (
      <div className="mx-auto w-[1144px] max-w-[calc(100%-48px)] px-[24px] pb-10 pt-[16px]">
        <div className="rounded-[14px] border border-[#dbeaf3] bg-white px-6 py-10 font-['Inter'] text-[14px] text-red-600 shadow-[0px_4px_16px_rgba(194,224,239,0.18)]">
          {detailQuery.error?.message ?? "Impossible de charger le médicament."}
        </div>
      </div>
    );
  }

  const detail = detailQuery.data;
  const summary = buildMedicationSummary(detail);

  return (
    <form
      className="mx-auto w-[1144px] max-w-[calc(100%-48px)] pb-[74px] pt-[16px]"
      onSubmit={(event) => { event.preventDefault(); form.handleSubmit(); }}
    >
      {/* ── Hero header ── */}
      <section className="relative ml-[24px] w-[1096px] max-w-full overflow-hidden rounded-[18px] bg-gradient-to-br from-[#1e5291] via-[#1b4574] to-[#0d2d52] px-[28px] pb-[24px] pt-[16px] shadow-[0px_10px_32px_-8px_rgba(15,52,96,0.45)]">
        {/* Decorative background circles */}
        <div className="pointer-events-none absolute -right-[50px] -top-[50px] size-[200px] rounded-full bg-[rgba(255,255,255,0.04)]" />
        <div className="pointer-events-none absolute bottom-[-70px] right-[80px] size-[240px] rounded-full bg-[rgba(118,187,221,0.05)]" />
        <div className="pointer-events-none absolute -left-[30px] bottom-[-40px] size-[160px] rounded-full bg-[rgba(255,255,255,0.03)]" />

        <button
          type="button"
          onClick={() => { onEditModeChange(false); onOpenChange(false); }}
          className="relative inline-flex h-[24px] items-center gap-[6px] font-['Inter'] text-[12px] font-medium text-[rgba(255,253,251,0.65)] transition-colors hover:text-[#FFFDFB]"
        >
          <ArrowLeft className="size-[12px]" strokeWidth={2.4} />
          <span className="border-b border-[rgba(255,253,251,0.35)]">Retour aux médicaments</span>
        </button>

        <div className="relative mt-[16px] flex items-center justify-between gap-6">
          <div className="flex min-w-0 items-center gap-[16px]">
            {/* Icon badge */}
            <div className="flex size-[56px] shrink-0 items-center justify-center rounded-[15px] border border-[rgba(255,255,255,0.18)] bg-[rgba(255,255,255,0.12)] shadow-[inset_0px_1px_0px_rgba(255,255,255,0.15),0px_4px_12px_rgba(0,0,0,0.12)]">
              <FlaskConical className="size-[24px] text-[#c8e8f5]" strokeWidth={1.8} />
            </div>

            {/* Name + meta */}
            <div className="min-w-0">
              <h1 className="truncate font-['Plus_Jakarta_Sans'] text-[27px] font-bold leading-[1.2] tracking-[-0.01em] text-[#FFFDFB]">
                {summary.name}
              </h1>
              {summary.genericName !== summary.name && (
                <p className="mt-[2px] truncate font-['Inter'] text-[13px] font-normal leading-[1.5] text-[rgba(255,253,251,0.6)]">
                  {summary.genericName}
                </p>
              )}
              {/* Category badge + stats row */}
              <div className="mt-[10px] flex items-center gap-[10px]">
                <span className="inline-flex h-[22px] items-center gap-[5px] rounded-full border border-[rgba(118,187,221,0.35)] bg-[rgba(118,187,221,0.15)] px-[10px] font-['Inter'] text-[11px] font-semibold text-[#a8d8ef]">
                  <Tag className="size-[10px]" strokeWidth={2.2} />
                  {summary.category}
                </span>
                {detail.presentations.length > 0 && (
                  <span className="font-['Inter'] text-[11px] text-[rgba(255,253,251,0.38)]">
                    {detail.presentations.length} présentation{detail.presentations.length > 1 ? "s" : ""}
                  </span>
                )}
                {detail.substances_actives.length > 0 && (
                  <span className="font-['Inter'] text-[11px] text-[rgba(255,253,251,0.38)]">
                    {detail.substances_actives.length} substance{detail.substances_actives.length > 1 ? "s" : ""}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-[10px]">
            {isEditing ? (
              <>
                <button
                  type="button"
                  onClick={() => { form.reset(initialValues); onEditModeChange(false); }}
                  className="h-[38px] min-w-[100px] rounded-[10px] border border-[rgba(255,255,255,0.25)] bg-transparent px-5 font-['Plus_Jakarta_Sans'] text-[13px] font-medium text-[rgba(255,253,251,0.85)] transition-colors hover:bg-[rgba(255,255,255,0.08)]"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="h-[38px] min-w-[120px] rounded-[10px] bg-[#76BBDD] px-5 font-['Plus_Jakarta_Sans'] text-[13px] font-semibold text-[#FFFDFB] shadow-[0px_4px_14px_rgba(118,187,221,0.45)] transition-[background-color,opacity] hover:bg-[#69b2d6] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {updateMutation.isPending ? "Enregistrement..." : "Enregistrer"}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => onEditModeChange(true)}
                  className="h-[38px] min-w-[100px] rounded-[10px] bg-[#76BBDD] px-5 font-['Plus_Jakarta_Sans'] text-[13px] font-semibold text-[#FFFDFB] shadow-[0px_4px_14px_rgba(118,187,221,0.45)] transition-colors hover:bg-[#69b2d6]"
                >
                  Modifier
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => onDelete(medicamentId)}
                  className="h-[38px] min-w-[100px] rounded-[10px] border border-[rgba(255,255,255,0.2)] bg-[rgba(255,255,255,0.07)] px-5 font-['Plus_Jakarta_Sans'] text-[13px] font-medium text-[rgba(255,253,251,0.85)] transition-colors hover:bg-[rgba(255,255,255,0.14)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isDeleting ? "Suppression..." : "Supprimer"}
                </button>
              </>
            )}
          </div>
        </div>
      </section>

      {/* ── Info principale ── */}
      <DetailSectionCard className="mt-[24px]">
        <div className="flex flex-col gap-[18px]">

          {/* Row 1 — Identifiers: two short fields, equal height */}
          <div className="grid grid-cols-2 gap-x-[24px]">
            <EditableField form={form} isEditing={isEditing} label="Catégorie" value={summary.category} icon={<Tag className="size-[14px] text-[#265284]" strokeWidth={1.8} />} asTag />
            <EditableField form={form} isEditing={isEditing} label="Nom générique" name="nom_generique" value={summary.genericName} />
          </div>

          {/* Row 2 — Family fields: both short one-line values */}
          <div className="grid grid-cols-2 gap-x-[24px]">
            <EditableField form={form} isEditing={isEditing} label="Famille" name="famille_pharmacologique" value={summary.family} />
            <EditableField form={form} isEditing={isEditing} label="Famille pharmacologique" name="famille_pharmacologique" value={summary.pharmacologicalFamily} />
          </div>

          {/* Row 3 — Usage: full width, long expandable */}
          <EditableField form={form} isEditing={isEditing} label="Usage" name="indications" value={summary.usage} icon={<ClipboardList className="size-[14px] text-[#265284]" strokeWidth={1.8} />} collapsible />

          {/* Row 4 — Dosage + Classe: similar height, both collapsible */}
          <div className="grid grid-cols-2 gap-x-[24px]">
            <EditableField form={form} isEditing={isEditing} label="Dosage" value={summary.dosage} collapsible />
            <EditableField form={form} isEditing={isEditing} label="Classe thérapeutique" name="classe_therapeutique" value={summary.classification || "-"} collapsible />
          </div>

          {/* Row 5 — Forme: full width, very long expandable */}
          <EditableField form={form} isEditing={isEditing} label="Forme" name="presentations" value={summary.forme} collapsible />

        </div>
      </DetailSectionCard>

      {/* ── Posologie ── */}
      <DetailSectionCard className="mt-[20px]" title="Posologie" icon={<FlaskConical className="size-[15px] text-[#265284]" strokeWidth={1.8} />}>
        <div className="flex flex-col gap-[18px]">

          {/* Posologie adulte: full width — often very long */}
          <EditableField form={form} isEditing={isEditing} label="Posologie adulte" name="posologie_adulte" value={summary.adultDosage} multiline collapsible />

          {/* Shorter dosage fields: same-height pair */}
          <div className="grid grid-cols-2 gap-x-[24px]">
            <EditableField form={form} isEditing={isEditing} label="Posologie enfant" name="posologie_enfant" value={summary.childDosage} collapsible />
            <EditableField form={form} isEditing={isEditing} label="Dose maximale" name="dose_maximale" value={summary.maxDose} collapsible />
          </div>

          {/* Fréquence: half-width */}
          <div className="grid grid-cols-2 gap-x-[24px]">
            <EditableField form={form} isEditing={isEditing} label="Fréquence d'administration" name="frequence_administration" value={summary.administrationFrequency} />
          </div>

        </div>
      </DetailSectionCard>

      {/* ── Informations cliniques ── */}
      <DetailSectionCard className="mt-[20px]" title="Informations cliniques" icon={<ClipboardList className="size-[15px] text-[#265284]" strokeWidth={1.8} />}>
        <div className="space-y-[20px]">
          <EditableField form={form} isEditing={isEditing} label="Indications" name="indications" value={summary.indications} fullWidth multiline collapsible />
          <EditableField form={form} isEditing={isEditing} label="Contre-indications" name="contre_indications" value={summary.contraIndications} fullWidth multiline collapsible />
          <EditableField form={form} isEditing={isEditing} label="Précautions" name="precautions" value={summary.precautions} fullWidth multiline collapsible />
          <EditableField form={form} isEditing={isEditing} label="Effets indésirables" name="effets_indesirables" value={summary.sideEffects} fullWidth multiline collapsible />
        </div>
      </DetailSectionCard>

      {/* ── Sécurité ── */}
      <DetailSectionCard className="mt-[20px]" title="Sécurité" icon={<Shield className="size-[15px] text-[#265284]" strokeWidth={1.8} />}>
        <div className="grid grid-cols-[1fr_1fr] gap-x-[24px] gap-y-[20px]">
          <EditableField form={form} isEditing={isEditing} label="Grossesse" name="grossesse" value={summary.pregnancy} collapsible />
          <EditableField form={form} isEditing={isEditing} label="Allaitement" name="allaitement" value={summary.breastfeeding} collapsible />
        </div>
      </DetailSectionCard>

      {/* ── Description ── */}
      <DetailSectionCard className="mt-[20px]" title="Description" icon={<FileText className="size-[15px] text-[#265284]" strokeWidth={1.8} />}>
        <EditableField form={form} isEditing={isEditing} label="Description" name="indications" value={summary.description} hideLabel fullWidth multiline collapsible />
      </DetailSectionCard>

      {/* ── Classification ── */}
      <DetailSectionCard className="mt-[20px]" title="Classification" icon={<ClipboardList className="size-[15px] text-[#265284]" strokeWidth={1.8} />}>
        <EditableField form={form} isEditing={isEditing} label="Classification" name="classe_therapeutique" value={summary.classification} hideLabel fullWidth multiline collapsible minHeight="h-[100px]" />
      </DetailSectionCard>
    </form>
  );
}

function DetailSectionCard({
  children,
  title,
  icon,
  className = "",
}: {
  children: ReactNode;
  title?: string;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`ml-[24px] w-[1096px] max-w-full rounded-[14px] border border-[#e2ecf4] bg-white px-[28px] pb-[28px] pt-[24px] shadow-[0px_4px_20px_-8px_rgba(15,52,96,0.1)] ${className}`}>
      {title ? (
        <div className="mb-[20px] flex items-center gap-[8px] border-b border-[#edf5fb] pb-[14px]">
          {icon}
          <h2 className="font-['Plus_Jakarta_Sans'] text-[14px] font-semibold uppercase tracking-[0.06em] text-[#265284]">
            {title}
          </h2>
        </div>
      ) : null}
      {children}
    </section>
  );
}

function EditableField({
  form,
  isEditing,
  label,
  value,
  name,
  icon,
  asTag = false,
  fullWidth = false,
  multiline = false,
  hideLabel = false,
  collapsible = false,
  minHeight,
}: {
  form: any;
  isEditing: boolean;
  label: string;
  value: string;
  name?: keyof MedicationFormValues;
  icon?: ReactNode;
  asTag?: boolean;
  fullWidth?: boolean;
  multiline?: boolean;
  hideLabel?: boolean;
  collapsible?: boolean;
  minHeight?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [isClamped, setIsClamped] = useState(false);
  const textRef = useRef<HTMLParagraphElement>(null);

  useLayoutEffect(() => {
    const el = textRef.current;
    if (!el || !collapsible || isEditing || expanded) return;
    setIsClamped(el.scrollHeight > el.clientHeight + 1);
  }, [value, collapsible, isEditing, expanded]);

  const boxClass = `rounded-[10px] border border-[#deeef8] bg-[#f8fbff] px-4 py-[10px] font-['Inter'] text-[13px] leading-[21px] text-[#1a3d5c] ${minHeight ?? ""}`;
  const showToggle = collapsible && isClamped && !isEditing;

  if (!isEditing || !name) {
    return (
      <div>
        {!hideLabel ? (
          <div className="mb-[7px] flex items-center gap-[6px]">
            {icon}
            <p className="font-['Inter'] text-[11px] font-semibold uppercase tracking-[0.05em] text-[#6b8da8]">
              {label}
            </p>
          </div>
        ) : null}
        {asTag ? (
          <div className="inline-flex h-[36px] items-center rounded-[8px] bg-[#173FB8] px-4 font-['Plus_Jakarta_Sans'] text-[13px] font-semibold text-white">
            {value}
          </div>
        ) : (
          <div className={`${boxClass} relative`}>
            <p
              ref={textRef}
              className={`${multiline ? "whitespace-pre-wrap break-words" : ""} ${collapsible && !expanded ? "line-clamp-3" : ""}`}
            >
              {value || "-"}
            </p>
            {showToggle && (
              <button
                type="button"
                onClick={() => setExpanded((prev) => !prev)}
                className="mt-1.5 flex items-center gap-1 font-['Inter'] text-[11px] font-semibold text-[#4d7fa8] transition-colors hover:text-[#265284]"
              >
                {expanded ? (
                  <>
                    <ChevronUp className="size-[13px]" strokeWidth={2.2} />
                    <span>Réduire</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="size-[13px]" strokeWidth={2.2} />
                    <span>Voir plus</span>
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      {!hideLabel ? (
        <div className="mb-[7px] flex items-center gap-[6px]">
          {icon}
          <p className="font-['Inter'] text-[11px] font-semibold uppercase tracking-[0.05em] text-[#6b8da8]">
            {label}
          </p>
        </div>
      ) : null}
      <form.Field name={name}>
        {(field: any) =>
          multiline ? (
            <textarea
              className={`${boxClass} ${minHeight ?? "min-h-[80px]"} w-full resize-none outline-none focus:border-[#9fcbdf] focus:bg-white`}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
              value={field.state.value}
            />
          ) : (
            <input
              className={`${boxClass} h-[42px] w-full outline-none focus:border-[#9fcbdf] focus:bg-white`}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
              value={field.state.value}
            />
          )
        }
      </form.Field>
    </div>
  );
}

type MedicationSummary = {
  name: string;
  genericName: string;
  category: string;
  usage: string;
  family: string;
  pharmacologicalFamily: string;
  dosage: string;
  forme: string;
  classification: string;
  adultDosage: string;
  childDosage: string;
  maxDose: string;
  administrationFrequency: string;
  indications: string;
  contraIndications: string;
  precautions: string;
  sideEffects: string;
  pregnancy: string;
  breastfeeding: string;
  description: string;
};

function buildMedicationSummary(detail: MedicationAggregate): MedicationSummary {
  const category = getPrimaryCategory(
    detail.medicament.classe_therapeutique,
    detail.medicament.famille_pharmacologique,
  );
  const usage = joinList(detail.indications.map((item) => item.indication));
  const pharmacologicalFamily = detail.medicament.famille_pharmacologique ?? "-";
  const family = shortFamily(pharmacologicalFamily || category);
  const dosage = buildDosage(detail);
  const forme = joinList(uniqueDefined(detail.presentations.map((item) => item.forme)));
  const classification = detail.medicament.classe_therapeutique ?? "";
  const description =
    detail.indications[0]?.indication
      ? `${detail.medicament.nom_medicament} utilisé pour traiter ${detail.indications[0].indication.toLowerCase()}.`
      : classification || pharmacologicalFamily || category;

  return {
    name: detail.medicament.nom_medicament,
    genericName: detail.medicament.nom_generique ?? detail.medicament.nom_medicament,
    category,
    usage: usage || "-",
    family,
    pharmacologicalFamily,
    dosage,
    forme,
    classification,
    adultDosage: detail.medicament.posologie_adulte ?? "-",
    childDosage: detail.medicament.posologie_enfant ?? "-",
    maxDose: detail.medicament.dose_maximale ?? "-",
    administrationFrequency: detail.medicament.frequence_administration ?? "-",
    indications: usage || "-",
    contraIndications: joinList(detail.contre_indications.map((item) => item.description)) || "-",
    precautions: joinList(detail.precautions.map((item) => item.description)) || "-",
    sideEffects: joinList(
      detail.effets_indesirables.map((item) =>
        item.frequence ? `${item.effet} | ${item.frequence}` : item.effet,
      ),
    ) || "-",
    pregnancy: detail.medicament.grossesse ?? "-",
    breastfeeding: detail.medicament.allaitement ?? "-",
    description,
  };
}

function uniqueDefined(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => value?.trim()).filter(Boolean))) as string[];
}

function shortFamily(value: string) {
  return value.split(">")[0]?.trim() || value;
}

function buildDosage(detail: MedicationAggregate) {
  const dosages = uniqueDefined(detail.presentations.map((item) => item.dosage));
  if (dosages.length > 0) return dosages.join(" - ");
  return detail.medicament.dose_maximale ?? "-";
}

function joinList(values: string[]) {
  return values.filter(Boolean).join(", ");
}

const EMPTY_FORM_VALUES: MedicationFormValues = {
  nom_medicament: "",
  nom_generique: "",
  classe_therapeutique: "",
  famille_pharmacologique: "",
  posologie_adulte: "",
  posologie_enfant: "",
  dose_maximale: "",
  frequence_administration: "",
  grossesse: "",
  allaitement: "",
  substances_actives: "",
  indications: "",
  contre_indications: "",
  precautions: "",
  interactions: "",
  effets_indesirables: "",
  presentations: "",
};
