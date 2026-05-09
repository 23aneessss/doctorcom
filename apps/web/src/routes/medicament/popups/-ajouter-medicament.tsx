import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  buildCreatePayload,
  EMPTY_MEDICATION_FORM_VALUES,
  type MedicationFormValues,
} from "../components/-medication-helpers";
import { trpcClient } from "@/utils/trpc";

import {
  MedicationDialogFooter,
  MedicationDialogShell,
  MedicationFieldInput,
  MedicationFieldTextarea,
  medicationFormSchema,
} from "./-medication-dialog-shared";

export function AjouterMedicamentDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}) {
  const form = useForm({
    defaultValues: EMPTY_MEDICATION_FORM_VALUES,
    validators: {
      onSubmit: medicationFormSchema,
    },
    onSubmit: async ({ value }) => {
      await createMutation.mutateAsync(value);
    },
  });

  const createMutation = useMutation({
    mutationFn: async (value: MedicationFormValues) => {
      return trpcClient.medicaments.creerMedicament.mutate(buildCreatePayload(value));
    },
    onSuccess: () => {
      toast.success("Médicament ajouté");
      form.reset(EMPTY_MEDICATION_FORM_VALUES);
      onOpenChange(false);
      onCreated?.();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  return (
    <MedicationDialogShell open={open} title="Ajouter un médicament" onOpenChange={onOpenChange}>
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

        <form.Subscribe selector={(state) => state.values}>
          {(currentValues) => (
            <MedicationDialogFooter
              isPending={createMutation.isPending}
              isSubmitBlocked={!medicationFormSchema.safeParse(currentValues).success}
              onCancel={() => onOpenChange(false)}
              pendingLabel="Enregistrement..."
              submitLabel="Ajouter"
            />
          )}
        </form.Subscribe>
      </form>
    </MedicationDialogShell>
  );
}
