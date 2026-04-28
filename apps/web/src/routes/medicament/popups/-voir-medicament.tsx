import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  ClipboardList,
  FileText,
  Pill,
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
    validators: {
      onSubmit: medicationFormSchema,
    },
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
    if (!open) {
      return;
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }

      if (isEditing) {
        onEditModeChange(false);
        if (initialValues) {
          form.reset(initialValues);
        }
        return;
      }

      onOpenChange(false);
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [form, initialValues, isEditing, onEditModeChange, onOpenChange, open]);

  useEffect(() => {
    if (initialValues) {
      form.reset(initialValues);
    }
  }, [form, initialValues]);

  const updateMutation = useMutation({
    mutationFn: async (payload: { id: number; data: Record<string, unknown> }) => {
      return trpcClient.medicaments.mettreAJourMedicament.mutate({
        id: payload.id,
        data: payload.data,
      });
    },
    onSuccess: async () => {
      toast.success("Médicament modifié");
      onEditModeChange(false);
      await detailQuery.refetch();
      onUpdated?.();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  if (!open) {
    return null;
  }

  if (detailQuery.isLoading) {
    return (
      <div className="mx-auto w-[1144px] max-w-[calc(100%-48px)] px-[24px] pb-10 pt-[16px]">
        <div className="rounded-[10px] border border-[#dbeaf3] bg-white px-6 py-10 font-['Inter'] text-[14px] text-[#0f3460] shadow-[0px_4px_16px_rgba(194,224,239,0.18)]">
          Chargement du médicament...
        </div>
      </div>
    );
  }

  if (detailQuery.isError || !detailQuery.data || !medicamentId || !initialValues) {
    return (
      <div className="mx-auto w-[1144px] max-w-[calc(100%-48px)] px-[24px] pb-10 pt-[16px]">
        <div className="rounded-[10px] border border-[#dbeaf3] bg-white px-6 py-10 font-['Inter'] text-[14px] text-red-600 shadow-[0px_4px_16px_rgba(194,224,239,0.18)]">
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
      onSubmit={(event) => {
        event.preventDefault();
        form.handleSubmit();
      }}
    >
      <section className="ml-[24px] w-[1096px] max-w-full rounded-[8px] bg-[#1B4574] px-[24px] pb-[14px] pt-[14px] text-[#FFFDFB] shadow-[0px_4px_16px_rgba(15,52,96,0.16)]">
        <button
          type="button"
          onClick={() => {
            onEditModeChange(false);
            onOpenChange(false);
          }}
          className="inline-flex h-[24px] items-center gap-[4px] font-['Inter'] text-[12px] font-medium text-[#FFFDFB]"
        >
          <ArrowLeft className="size-[12px]" strokeWidth={2.4} />
          <span className="border-b border-[rgba(255,253,251,0.55)] leading-[24px]">
            Retour aux médicaments
          </span>
        </button>

        <div className="mt-[12px] flex items-start justify-between gap-6">
          <div className="flex min-w-0 items-center gap-[10px]">
            <div className="flex size-[52px] shrink-0 items-center justify-center">
              <Pill className="size-[24px] rotate-[135deg] text-[#FFFDFB]" strokeWidth={2.1} />
            </div>
            <div className="min-w-0">
              <h1 className="truncate font-['Plus_Jakarta_Sans'] text-[28px] font-bold leading-[31px] text-[#FFFDFB]">
                {summary.name}
              </h1>
              <p className="mt-[2px] truncate font-['Inter'] text-[15px] font-medium leading-[22px] text-[rgba(255,253,251,0.86)]">
                {summary.genericName}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-[12px] pt-[4px]">
            {isEditing ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    form.reset(initialValues);
                    onEditModeChange(false);
                  }}
                  className="h-[40px] min-w-[112px] rounded-[10px] border border-[#76BBDD] bg-transparent px-[24px] font-['Plus_Jakarta_Sans'] text-[14px] font-medium text-[#FFFDFB]"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="h-[40px] min-w-[130px] rounded-[10px] bg-[#76BBDD] px-[24px] font-['Plus_Jakarta_Sans'] text-[14px] font-medium text-[#FFFDFB] shadow-[0px_4px_12px_rgba(118,187,221,0.35)] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {updateMutation.isPending ? "Enregistrement..." : "Enregistrer"}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => onEditModeChange(true)}
                  className="h-[40px] min-w-[112px] rounded-[10px] bg-[#76BBDD] px-[24px] font-['Plus_Jakarta_Sans'] text-[14px] font-medium text-[#FFFDFB] shadow-[0px_4px_12px_rgba(118,187,221,0.35)]"
                >
                  Modifier
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => onDelete(medicamentId)}
                  className="h-[40px] min-w-[130px] rounded-[10px] bg-[#76BBDD] px-[24px] font-['Plus_Jakarta_Sans'] text-[14px] font-medium text-[#FFFDFB] shadow-[0px_4px_12px_rgba(118,187,221,0.35)] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isDeleting ? "Suppression..." : "Supprimer"}
                </button>
              </>
            )}
          </div>
        </div>
      </section>

      <DetailSectionCard className="mt-[32px]">
        <div className="grid grid-cols-[503.2px_503.2px] gap-x-[24px] gap-y-[24px]">
          <EditableField form={form} isEditing={isEditing} label="Catégorie" value={summary.category} icon={<Tag className="size-[16px] text-[#0F3460]" strokeWidth={1.8} />} asTag />
          <EditableField form={form} isEditing={isEditing} label="Usage" name="indications" value={summary.usage} icon={<ClipboardList className="size-[16px] text-[#0F3460]" strokeWidth={1.8} />} />
          <EditableField form={form} isEditing={isEditing} label="Famille" name="famille_pharmacologique" value={summary.family} />
          <EditableField form={form} isEditing={isEditing} label="Dosage" value={summary.dosage} />
          <EditableField form={form} isEditing={isEditing} label="Nom générique" name="nom_generique" value={summary.genericName} />
          <EditableField form={form} isEditing={isEditing} label="Classe thérapeutique" name="classe_therapeutique" value={summary.classification || "-"} />
          <EditableField form={form} isEditing={isEditing} label="Famille pharmacologique" name="famille_pharmacologique" value={summary.pharmacologicalFamily} fullWidth />
          <EditableField form={form} isEditing={isEditing} label="Forme" name="presentations" value={summary.forme} fullWidth />
        </div>
      </DetailSectionCard>

      <DetailSectionCard className="mt-[24px]" title="Posologie" icon={<Pill className="size-[16px] text-[#0F3460]" strokeWidth={1.8} />}>
        <div className="grid grid-cols-[503.2px_503.2px] gap-x-[24px] gap-y-[24px]">
          <EditableField form={form} isEditing={isEditing} label="Posologie adulte" name="posologie_adulte" value={summary.adultDosage} multiline />
          <EditableField form={form} isEditing={isEditing} label="Posologie enfant" name="posologie_enfant" value={summary.childDosage} />
          <EditableField form={form} isEditing={isEditing} label="Dose maximale" name="dose_maximale" value={summary.maxDose} />
          <EditableField form={form} isEditing={isEditing} label="Fréquence d'administration" name="frequence_administration" value={summary.administrationFrequency} />
        </div>
      </DetailSectionCard>

      <DetailSectionCard className="mt-[24px]" title="INFORMATIONS CLINIQUES" icon={<ClipboardList className="size-[18px] text-[#0F3460]" strokeWidth={1.8} />}>
        <div className="space-y-[24px]">
          <EditableField form={form} isEditing={isEditing} label="Indications" name="indications" value={summary.indications} fullWidth multiline />
          <EditableField form={form} isEditing={isEditing} label="Contre-indications" name="contre_indications" value={summary.contraIndications} fullWidth multiline />
          <EditableField form={form} isEditing={isEditing} label="Précautions" name="precautions" value={summary.precautions} fullWidth multiline />
          <EditableField form={form} isEditing={isEditing} label="Effets indésirables" name="effets_indesirables" value={summary.sideEffects} fullWidth multiline />
        </div>
      </DetailSectionCard>

      <DetailSectionCard className="mt-[24px]" title="Sécurité" icon={<Shield className="size-[16px] text-[#0F3460]" strokeWidth={1.8} />}>
        <div className="grid grid-cols-[503.2px_503.2px] gap-x-[24px] gap-y-[24px]">
          <EditableField form={form} isEditing={isEditing} label="Grossesse" name="grossesse" value={summary.pregnancy} />
          <EditableField form={form} isEditing={isEditing} label="Allaitement" name="allaitement" value={summary.breastfeeding} />
        </div>
      </DetailSectionCard>

      <DetailSectionCard className="mt-[24px]" title="Description" icon={<FileText className="size-[16px] text-[#0F3460]" strokeWidth={1.8} />}>
        <EditableField form={form} isEditing={isEditing} label="Description" name="indications" value={summary.description} hideLabel fullWidth multiline />
      </DetailSectionCard>

      <DetailSectionCard className="mt-[24px]" title="Classification" icon={<ClipboardList className="size-[16px] text-[#0F3460]" strokeWidth={1.8} />}>
        <EditableField form={form} isEditing={isEditing} label="Classification" name="classe_therapeutique" value={summary.classification} hideLabel fullWidth multiline minHeight="h-[100px]" />
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
    <section className={`ml-[24px] w-[1096px] max-w-full rounded-[10px] border border-[#E2ECF4] bg-[#FFFDFB] px-[32.8px] pb-[32.8px] pt-[32.8px] shadow-[0px_4px_14px_rgba(194,224,239,0.14)] ${className}`}>
      {title ? (
        <div className="mb-[24px] flex items-center gap-[8px]">
          {icon}
          <h2 className="font-['Plus_Jakarta_Sans'] text-[18px] font-semibold uppercase leading-[22.5px] tracking-[0.01em] text-[#0F3460]">
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
  minHeight?: string;
}) {
  const containerClass = fullWidth ? "col-span-2" : "";
  const boxClass = `${minHeight ?? ""} rounded-[8px] border border-[#D8E8F2] bg-[#FFFDFB] px-[16.8px] py-[10.8px] font-['Inter'] text-[13px] leading-[21px] text-[#0F3460]`;

  if (!isEditing || !name) {
    return (
      <div className={containerClass}>
        {!hideLabel ? (
          <div className="mb-[8px] flex items-center gap-[8px]">
            {icon}
            <p className="font-['Inter'] text-[12px] font-semibold leading-[19.5px] text-[#0F3460]">
              {label}
            </p>
          </div>
        ) : null}
        {asTag ? (
          <div className="inline-flex h-[40.2px] items-center rounded-[8px] bg-[#173FB8] px-[16px] font-['Plus_Jakarta_Sans'] text-[14px] font-semibold leading-[21px] text-[#FFFDFB]">
            {value}
          </div>
        ) : (
          <div className={boxClass}>
            <p className={multiline ? "max-w-full whitespace-pre-wrap break-words" : "truncate"}>{value || "-"}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={containerClass}>
      {!hideLabel ? (
        <div className="mb-[8px] flex items-center gap-[8px]">
          {icon}
          <p className="font-['Inter'] text-[12px] font-semibold leading-[19.5px] text-[#0F3460]">
            {label}
          </p>
        </div>
      ) : null}
      <form.Field name={name}>
        {(field: any) =>
          multiline ? (
            <textarea
              className={`${boxClass} ${minHeight ?? "min-h-[70px]"} w-full resize-none outline-none`}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
              value={field.state.value}
            />
          ) : (
            <input
              className={`${boxClass} h-[42.6px] w-full outline-none`}
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
  const forme = joinList(
    uniqueDefined(detail.presentations.map((item) => item.forme)),
  );
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
    sideEffects:
      joinList(
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
  if (dosages.length > 0) {
    return dosages.join(" - ");
  }

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
