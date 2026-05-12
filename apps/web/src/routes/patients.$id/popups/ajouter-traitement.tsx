import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, CircleHelp, Package, X } from "lucide-react";
import { useEffect, useMemo } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { cn } from "@/lib/utils";
import { trpc, trpcClient } from "@/utils/trpc";

type TraitementDialogValues = {
  medicament_externe_id?: string;
  nom_medicament?: string;
  indication?: string;
  dosage?: string;
  posologie?: string;
  contre_indications?: string;
  effets_indesirables?: string;
  date_prescription?: string;
  est_actif?: boolean;
};

export function AjouterTraitementDialog({
  open,
  onOpenChange,
  patientId,
  onCreated,
  values,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  onCreated?: () => void;
  values?: TraitementDialogValues;
}) {
  const initialValues = useMemo(
    () => ({
      medicament_externe_id: values?.medicament_externe_id ?? "",
      nom_medicament: values?.nom_medicament ?? "",
      indication: values?.indication ?? "",
      dosage: values?.dosage ?? "",
      posologie: values?.posologie ?? "",
      contre_indications: values?.contre_indications ?? "",
      effets_indesirables: values?.effets_indesirables ?? "",
      date_prescription:
        values?.date_prescription ?? new Date().toISOString().slice(0, 10),
      est_actif: values?.est_actif ?? true,
      prescrit_par: "Dr. Admin",
    }),
    [values],
  );

  const form = useForm({
    defaultValues: initialValues,
    validators: {
      onSubmit: z.object({
        // Optional — the mutation resolves the medicament id from the name when empty
        medicament_externe_id: z.string(),
        nom_medicament: z.string().trim().min(1, "Le médicament est requis"),
        indication: z.string().trim().min(1, "L'indication est requise"),
        dosage: z.string().trim().min(1, "Le dosage est requis"),
        posologie: z.string().trim().min(1, "La posologie est requise"),
        contre_indications: z.string(),
        effets_indesirables: z.string(),
        date_prescription: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide (YYYY-MM-DD)"),
        est_actif: z.boolean(),
        prescrit_par: z.string(),
      }),
    },
    onSubmit: async ({ value }) => {
      await createMutation.mutateAsync(value);
    },
  });

  const searchTerm = form.state.values.nom_medicament.trim();

  const medicamentsQuery = useQuery({
    ...trpc.medicaments.rechercherMedicaments.queryOptions({
      query: searchTerm.length >= 2 ? searchTerm : null,
      page: 1,
      page_size: 8,
    }),
    enabled: open && searchTerm.length >= 2,
  });

  const selectedMedicationId = Number.parseInt(
    form.state.values.medicament_externe_id,
    10,
  );
  const medicamentDetailsQuery = useQuery({
    ...trpc.medicaments.getMedicamentById.queryOptions({
      id:
        Number.isInteger(selectedMedicationId) && selectedMedicationId > 0
          ? selectedMedicationId
          : 1,
    }),
    enabled: open && Number.isInteger(selectedMedicationId) && selectedMedicationId > 0,
  });

  useEffect(() => {
    if (!medicamentDetailsQuery.data) return;
    const details = medicamentDetailsQuery.data;

    if (!form.state.values.indication.trim()) {
      form.setFieldValue("indication", details.indications[0]?.indication ?? "");
    }
    if (!form.state.values.contre_indications.trim()) {
      form.setFieldValue(
        "contre_indications",
        details.contre_indications[0]?.description ?? "",
      );
    }
    if (!form.state.values.effets_indesirables.trim()) {
      form.setFieldValue(
        "effets_indesirables",
        details.effets_indesirables[0]?.effet ?? "",
      );
    }
  }, [medicamentDetailsQuery.data]);

  const createMutation = useMutation({
    mutationFn: async (value: {
      medicament_externe_id: string;
      nom_medicament: string;
      indication: string;
      dosage: string;
      posologie: string;
      contre_indications: string;
      effets_indesirables: string;
      date_prescription: string;
      est_actif: boolean;
      prescrit_par: string;
    }) => {
      let medicamentExterneId = value.medicament_externe_id;
      if (!/^[1-9]\d*$/.test(medicamentExterneId) && value.nom_medicament.trim()) {
        const searchResult = await trpcClient.medicaments.rechercherMedicaments.query({
          query: value.nom_medicament.trim(),
          page: 1,
          page_size: 1,
        });
        const matchedMedication = searchResult.items[0];
        if (!matchedMedication) {
          throw new Error(
            `Aucun médicament "${value.nom_medicament.trim()}" trouvé dans la base. Sélectionnez une suggestion ou modifiez le nom.`,
          );
        }
        medicamentExterneId = String(matchedMedication.id);
      }
      if (!medicamentExterneId) {
        throw new Error("Veuillez saisir un nom de médicament.");
      }

      return trpcClient.treatment.startTreatment.mutate({
        patient_id: patientId,
        medicament_externe_id: medicamentExterneId,
        dosage: value.dosage.trim() || null,
        posologie: value.posologie.trim(),
        date_prescription: value.date_prescription,
        est_actif: value.est_actif,
      });
    },
    onSuccess: () => {
      toast.success("Traitement ajouté");
      onOpenChange(false);
      onCreated?.();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  useEffect(() => {
    form.reset(initialValues);
  }, [form, initialValues, open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(10,35,65,0.2)] p-4"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onOpenChange(false);
      }}
    >
      <div className="flex max-h-[calc(100svh-32px)] w-full max-w-[672px] overflow-hidden rounded-[14px] bg-white shadow-[0px_25px_50px_-12px_rgba(15,52,96,0.2)]">
        <form
          className="flex min-h-0 w-full flex-col"
          onSubmit={(event) => {
            event.preventDefault();
            form.handleSubmit();
          }}
        >
          <DialogHeader title="Ajouter un traitement" onClose={() => onOpenChange(false)} />

          <div className="consultation-modal-scrollbar min-h-0 flex-1 space-y-5 overflow-y-auto px-5 pb-5 pt-6 sm:px-6">
            <FieldInput
              form={form}
              label="DCI / Nom du médicament"
              name="nom_medicament"
              placeholder="Ex: Paracétamol 500mg"
              required
            />

            {medicamentsQuery.data?.items?.length ? (
              <MedicationSuggestions
                items={medicamentsQuery.data.items.slice(0, 5)}
                onSelect={(item) => {
                  form.setFieldValue("medicament_externe_id", String(item.id));
                  form.setFieldValue("nom_medicament", item.nom_medicament);
                }}
              />
            ) : null}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FieldInput
                form={form}
                label="Indication"
                name="indication"
                placeholder="Ex: Douleur et fièvre"
                required
              />
              <FieldInput
                form={form}
                label="Dosage"
                name="dosage"
                placeholder="Ex: 500mg"
                required
              />
            </div>

            <FieldInput
              form={form}
              label="Posologie"
              name="posologie"
              placeholder="Ex: 1 cp x3/j"
              required
            />
            <FieldTextarea
              form={form}
              label="Contre-indications"
              name="contre_indications"
              placeholder="Ex: Insuffisance hépatique, allergie..."
            />
            <FieldTextarea
              form={form}
              label="Effets indésirables"
              name="effets_indesirables"
              placeholder="Ex: Nausées, somnolence..."
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FieldInput
                form={form}
                label="Date de prescription"
                name="date_prescription"
                placeholder="2026-03-20"
              />
              <FieldInput form={form} label="Prescrit par" name="prescrit_par" readOnly />
            </div>

            <StatusCheckbox form={form} />
          </div>

          <form.Subscribe selector={(state) => state.values}>
            {(currentValues) => (
              <DialogFooter
                isPending={createMutation.isPending}
                isSubmitBlocked={isTreatmentSubmitBlocked(currentValues)}
                onCancel={() => onOpenChange(false)}
                submitLabel="Ajouter"
              />
            )}
          </form.Subscribe>
        </form>
      </div>
    </div>
  );
}

function DialogHeader({
  title,
  onClose,
}: {
  title: string;
  onClose: () => void;
}) {
  return (
    <div className="flex h-[75px] shrink-0 items-center justify-between border-b-[0.8px] border-[#c2e0ef] bg-[#f8fafc] px-5">
      <h3 className="font-['Plus_Jakarta_Sans'] text-[18px] font-semibold leading-7 text-[#0f3460]">
        {title}
      </h3>
      <div className="flex items-center gap-4">
        <button
          aria-label="Aide"
          className="flex size-5 items-center justify-center text-[#0f3460]"
          data-context-help-href="/aide/patients#traitements"
          type="button"
        >
          <CircleHelp className="size-5" />
        </button>
        <button
          aria-label="Fermer"
          className="flex size-5 cursor-pointer items-center justify-center text-[#0f3460]"
          onClick={onClose}
          type="button"
        >
          <X className="size-5" />
        </button>
      </div>
    </div>
  );
}

function MedicationSuggestions({
  items,
  onSelect,
}: {
  items: Array<{ id: number; nom_medicament: string }>;
  onSelect: (item: { id: number; nom_medicament: string }) => void;
}) {
  return (
    <div className="-mt-2 rounded-[10px] border-[0.8px] border-[#c2e0ef] bg-white p-2 shadow-[0px_8px_18px_0px_rgba(15,52,96,0.08)]">
      {items.map((item) => (
        <button
          key={item.id}
          className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-[8px] px-2 py-1.5 text-left transition-colors hover:bg-[#f8fafc]"
          onClick={() => onSelect(item)}
          type="button"
        >
          <span className="min-w-0 truncate font-['Inter'] text-[14px] leading-5 text-[#0f3460]">
            {item.nom_medicament}
          </span>
          <Package className="size-4 shrink-0 text-[#76bbdd]" />
        </button>
      ))}
    </div>
  );
}

function FieldInput({
  form,
  name,
  label,
  required,
  placeholder,
  readOnly,
}: {
  form: any;
  name: string;
  label: string;
  required?: boolean;
  placeholder?: string;
  readOnly?: boolean;
}) {
  return (
    <form.Field name={name}>
      {(field: any) => {
        const hasError = Boolean(field.state.meta.errors[0]?.message);
        const isRequiredAndEmpty =
          required && field.state.meta.isTouched && !String(field.state.value ?? "").trim();
        const showError = hasError || isRequiredAndEmpty;
        return (
        <div className="space-y-[6px]">
          <label className="font-['Inter'] text-[14px] font-medium leading-5 text-[#0f3460]">
            {label} {required ? <span className="text-[#f97316]">*</span> : null}
          </label>
          <input
            className={cn(
              "h-[37.6px] w-full rounded-[10px] border-[0.8px] bg-white px-3 font-['Inter'] text-[14px] leading-5 text-[#0f3460] outline-none transition-colors placeholder:text-[rgba(100,116,139,0.9)] focus:ring-2 disabled:cursor-not-allowed disabled:bg-[#f8fafc]",
              showError
                ? "border-red-400 focus:border-red-500 focus:ring-red-200"
                : "border-[#c2e0ef] focus:border-[#76bbdd] focus:ring-[#c2e0ef]/50",
            )}
            onBlur={field.handleBlur}
            onChange={(e) => field.handleChange(e.target.value)}
            placeholder={placeholder}
            readOnly={readOnly}
            value={field.state.value}
          />
          {hasError ? (
            <p className="font-['Inter'] text-xs text-red-600">
              {field.state.meta.errors[0].message}
            </p>
          ) : isRequiredAndEmpty ? (
            <p className="font-['Inter'] text-xs text-red-600">
              Ce champ est requis
            </p>
          ) : null}
        </div>
        );
      }}
    </form.Field>
  );
}

function FieldTextarea({
  form,
  name,
  label,
  placeholder,
}: {
  form: any;
  name: string;
  label: string;
  placeholder?: string;
}) {
  return (
    <form.Field name={name}>
      {(field: any) => (
        <div className="space-y-[6px]">
          <label className="font-['Inter'] text-[14px] font-medium leading-5 text-[#0f3460]">
            {label}
          </label>
          <textarea
            className="min-h-[57.6px] w-full resize-y rounded-[10px] border-[0.8px] border-[#c2e0ef] bg-white px-3 py-2 font-['Inter'] text-[14px] leading-5 text-[#0f3460] outline-none transition-colors placeholder:text-[rgba(100,116,139,0.9)] focus:border-[#76bbdd] focus:ring-2 focus:ring-[#c2e0ef]/50"
            onBlur={field.handleBlur}
            onChange={(e) => field.handleChange(e.target.value)}
            placeholder={placeholder}
            value={field.state.value}
          />
        </div>
      )}
    </form.Field>
  );
}

function StatusCheckbox({ form }: { form: any }) {
  return (
    <form.Field name="est_actif">
      {(field: any) => (
        <label className="flex min-h-[45.6px] w-full cursor-pointer items-center gap-[10px] rounded-[4px] border-[0.8px] border-[#c2e0ef] bg-[#f8fafc] px-[12.8px] py-[10px]">
          <input
            checked={field.state.value}
            className="peer sr-only"
            onBlur={field.handleBlur}
            onChange={(e) => field.handleChange(e.target.checked)}
            type="checkbox"
          />
          <span
            className={cn(
              "flex size-4 shrink-0 items-center justify-center rounded-[4px] border",
              field.state.value
                ? "border-[#76bbdd] bg-[#76bbdd]"
                : "border-[#c2e0ef] bg-white",
            )}
          >
            <Check
              className={cn(
                "size-[12px] text-white",
                field.state.value ? "opacity-100" : "opacity-0",
              )}
            />
          </span>
          <span className="font-['Inter'] text-[14px] font-medium leading-5 text-[#0f3460]">
            Traitement actif (en cours)
          </span>
        </label>
      )}
    </form.Field>
  );
}

function DialogFooter({
  isPending,
  isSubmitBlocked,
  onCancel,
  submitLabel,
}: {
  isPending: boolean;
  isSubmitBlocked: boolean;
  onCancel: () => void;
  submitLabel: string;
}) {
  return (
    <div className="flex shrink-0 items-center justify-end gap-3 border-t-[0.67px] border-[rgba(194,224,239,0.4)] px-5 py-[8px]">
      <button
        className="h-[37.6px] cursor-pointer rounded-[12px] border border-[#f77a21] px-4 font-['Plus_Jakarta_Sans'] text-[14px] font-medium leading-5 text-[#f77a21] transition-colors hover:bg-[#fff7ed]"
        onClick={onCancel}
        type="button"
      >
        Annuler
      </button>
      <button
        className="h-[37.6px] cursor-pointer rounded-[12px] bg-[#76bbdd] px-4 font-['Plus_Jakarta_Sans'] text-[14px] font-medium leading-5 text-white shadow-[0px_4px_12px_0px_rgba(118,187,221,0.5)] transition-colors hover:bg-[#65afd4] disabled:cursor-not-allowed disabled:bg-[#c2e0ef] disabled:text-[#6b819d] disabled:shadow-none"
        disabled={isPending || isSubmitBlocked}
        type="submit"
      >
        {isPending ? "Enregistrement..." : submitLabel}
      </button>
    </div>
  );
}

function isTreatmentSubmitBlocked(values: {
  medicament_externe_id: string;
  nom_medicament: string;
  indication: string;
  dosage: string;
  posologie: string;
  date_prescription: string;
}) {
  return (
    !values.nom_medicament.trim() ||
    !values.indication.trim() ||
    !values.dosage.trim() ||
    !values.posologie.trim() ||
    !/^\d{4}-\d{2}-\d{2}$/.test(values.date_prescription)
  );
}
