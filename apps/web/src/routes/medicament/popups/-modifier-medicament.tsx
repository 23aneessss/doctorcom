import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { toast } from "sonner";

import { trpc, trpcClient } from "@/utils/trpc";

import {
  aggregateToFormValues,
  buildUpdatePayload,
  EMPTY_MEDICATION_FORM_VALUES,
  type MedicationFormValues,
} from "../components/-medication-helpers";
import {
  MedicationDialogFooter,
  MedicationDialogShell,
  MedicationFieldInput,
  MedicationFieldTextarea,
  medicationFormSchema,
} from "./-medication-dialog-shared";

export function ModifierMedicamentDialog({
  open,
  onOpenChange,
  medicamentId,
  onUpdated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  medicamentId?: number | null;
  onUpdated?: () => void;
}) {
  const detailQuery = useQuery({
    ...trpc.medicaments.getMedicamentById.queryOptions({ id: medicamentId ?? 1 }),
    enabled: open && Boolean(medicamentId),
  });

  const initialValues = useMemo(
    () => (detailQuery.data ? aggregateToFormValues(detailQuery.data) : EMPTY_MEDICATION_FORM_VALUES),
    [detailQuery.data],
  );

  const form = useForm({
    defaultValues: initialValues,
    validators: {
      onSubmit: medicationFormSchema,
    },
    onSubmit: async ({ value }) => {
      if (!medicamentId) {
        toast.error("Médicament introuvable");
        return;
      }

      const payload = buildUpdatePayload(value, initialValues);
      if (Object.keys(payload).length === 0) {
        toast.info("Aucune modification détectée");
        return;
      }

      await updateMutation.mutateAsync({ id: medicamentId, data: payload });
    },
  });

  useEffect(() => {
    form.reset(initialValues);
  }, [form, initialValues, open]);

  const updateMutation = useMutation({
    mutationFn: async (payload: { id: number; data: Record<string, unknown> }) => {
      return trpcClient.medicaments.mettreAJourMedicament.mutate({
        id: payload.id,
        data: payload.data,
      });
    },
    onSuccess: () => {
      toast.success("Médicament modifié");
      onOpenChange(false);
      onUpdated?.();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  return (
    <MedicationDialogShell open={open} title="Modifier le médicament" onOpenChange={onOpenChange}>
      {detailQuery.isLoading ? (
        <div className="px-6 py-8 font-['Inter'] text-[14px] text-[#0f3460]">Chargement du médicament...</div>
      ) : detailQuery.isError ? (
        <div className="px-6 py-8 font-['Inter'] text-[14px] text-red-600">{detailQuery.error.message}</div>
      ) : (
        <form
          className="flex max-h-[78vh] flex-col"
          onSubmit={(event) => {
            event.preventDefault();
            form.handleSubmit();
          }}
        >
          <div className="space-y-5 overflow-y-auto px-6 pb-4 pt-6">
            <div className="grid grid-cols-2 gap-4">
              <MedicationFieldInput form={form} name="nom_medicament" label="Nom du médicament" required placeholder="Ex: Budesonide" />
              <MedicationFieldInput form={form} name="nom_generique" label="Nom générique" placeholder="Ex: Budésonide" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <MedicationFieldInput form={form} name="classe_therapeutique" label="Classe thérapeutique" placeholder="Ex: Anti-inflammatoire" />
              <MedicationFieldInput form={form} name="famille_pharmacologique" label="Famille pharmacologique" placeholder="Ex: Corticostéroïdes" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <MedicationFieldInput form={form} name="posologie_adulte" label="Posologie adulte" placeholder="1 inhalation matin et soir" />
              <MedicationFieldInput form={form} name="posologie_enfant" label="Posologie enfant" placeholder="Adapter selon l'âge" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <MedicationFieldInput form={form} name="dose_maximale" label="Dose maximale" placeholder="Ex: 800 mcg / jour" />
              <MedicationFieldInput form={form} name="frequence_administration" label="Fréquence d'administration" placeholder="Ex: 2 fois / jour" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <MedicationFieldInput form={form} name="grossesse" label="Grossesse" placeholder="Ex: Prudence" />
              <MedicationFieldInput form={form} name="allaitement" label="Allaitement" placeholder="Ex: Compatible" />
            </div>

            <MedicationFieldTextarea form={form} name="substances_actives" label="Substances actives" placeholder="Une substance par ligne" />
            <MedicationFieldTextarea form={form} name="indications" label="Indications" placeholder="Une indication par ligne" />
            <MedicationFieldTextarea form={form} name="contre_indications" label="Contre-indications" placeholder="Une contre-indication par ligne" />
            <MedicationFieldTextarea form={form} name="precautions" label="Précautions" placeholder="Une précaution par ligne" />
            <MedicationFieldTextarea form={form} name="interactions" label="Interactions" placeholder="Une interaction par ligne" />
            <MedicationFieldTextarea form={form} name="effets_indesirables" label="Effets indésirables" placeholder="Format: effet | fréquence" />
            <MedicationFieldTextarea form={form} name="presentations" label="Présentations" placeholder="Format: forme | dosage" />
          </div>

          <MedicationDialogFooter
            isPending={updateMutation.isPending}
            onCancel={() => onOpenChange(false)}
            pendingLabel="Enregistrement..."
            submitLabel="Modifier"
          />
        </form>
      )}
    </MedicationDialogShell>
  );
}
