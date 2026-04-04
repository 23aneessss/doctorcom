import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CircleHelp, Package, X } from "lucide-react";
import { useEffect, useMemo } from "react";
import { toast } from "sonner";
import { z } from "zod";

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

export function ModifierTraitementDialog({
  open,
  onOpenChange,
  traitementId,
  onCreated,
  values,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  traitementId?: string;
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
      date_prescription: values?.date_prescription ?? new Date().toISOString().slice(0, 10),
      est_actif: values?.est_actif ?? true,
      prescrit_par: "Dr. Admin",
    }),
    [values]
  );

  const form = useForm({
    defaultValues: initialValues,
    validators: {
      onSubmit: z.object({
        medicament_externe_id: z
          .string()
          .regex(/^[1-9]\d*$/, "Veuillez sélectionner un médicament valide"),
        nom_medicament: z.string().trim().min(1, "Le médicament est requis"),
        indication: z.string().trim().min(1, "L'indication est requise"),
        dosage: z.string(),
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
      if (!traitementId) {
        toast.error("Traitement introuvable");
        return;
      }

      const changes: {
        medicament_externe_id?: string;
        dosage?: string | null;
        posologie?: string;
        date_prescription?: string;
        est_actif?: boolean;
      } = {};

      if (value.medicament_externe_id !== initialValues.medicament_externe_id) {
        changes.medicament_externe_id = value.medicament_externe_id;
      }
      if ((value.dosage ?? "").trim() !== (initialValues.dosage ?? "").trim()) {
        changes.dosage = value.dosage.trim() || null;
      }
      if (value.posologie.trim() !== initialValues.posologie.trim()) {
        changes.posologie = value.posologie.trim();
      }
      if (value.date_prescription !== initialValues.date_prescription) {
        changes.date_prescription = value.date_prescription;
      }
      if (value.est_actif !== initialValues.est_actif) {
        changes.est_actif = value.est_actif;
      }

      if (Object.keys(changes).length === 0) {
        toast.info("Aucune modification détectée");
        return;
      }

      await updateMutation.mutateAsync({ traitementId, changes });
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
    10
  );
  const medicamentDetailsQuery = useQuery({
    ...trpc.medicaments.getMedicamentById.queryOptions({
      id: Number.isInteger(selectedMedicationId) && selectedMedicationId > 0
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
        details.contre_indications[0]?.description ?? ""
      );
    }
    if (!form.state.values.effets_indesirables.trim()) {
      form.setFieldValue(
        "effets_indesirables",
        details.effets_indesirables[0]?.effet ?? ""
      );
    }
  }, [medicamentDetailsQuery.data]);

  const updateMutation = useMutation({
    mutationFn: async (payload: {
      traitementId: string;
      changes: {
        medicament_externe_id?: string;
        dosage?: string | null;
        posologie?: string;
        date_prescription?: string;
        est_actif?: boolean;
      };
    }) => {
      return trpcClient.treatment.updateTreatment.mutate({
        treatment_id: payload.traitementId,
        donnees: payload.changes,
      });
    },
    onSuccess: () => {
      toast.success("Traitement modifié");
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(10,35,65,0.2)]"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onOpenChange(false);
      }}
    >
      <div className="w-[672px] overflow-hidden rounded-[14px] bg-white shadow-[0px_25px_50px_-12px_rgba(15,52,96,0.2)]">
        <div className="flex h-[75px] items-center justify-between border-b-[0.8px] border-[#c2e0ef] bg-[#f8fafc] px-5">
          <h3 className="font-['Plus_Jakarta_Sans'] text-[18px] font-semibold text-[#0f3460]">
            Modifier le traitement
          </h3>
          <div className="flex items-center gap-4">
            <button className="flex size-5 items-center justify-center text-[#0f3460]" type="button">
              <CircleHelp className="size-5" />
            </button>
            <button
              className="flex size-5 cursor-pointer items-center justify-center text-[#0f3460]"
              onClick={() => onOpenChange(false)}
              type="button"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        <form
          className="flex max-h-[641px] flex-col"
          onSubmit={(event) => {
            event.preventDefault();
            form.handleSubmit();
          }}
        >
          <div className="space-y-5 overflow-y-auto px-6 pb-4 pt-6">
            <FieldInput form={form} name="nom_medicament" label="DCI / Nom du médicament" required placeholder="Ex: Paracétamol 500mg" />
            {medicamentsQuery.data?.items?.length ? (
              <div className="-mt-2 rounded-[10px] border-[0.8px] border-[#c2e0ef] bg-white p-2">
                {medicamentsQuery.data.items.slice(0, 5).map((item) => (
                  <button
                    key={item.id}
                    className="flex w-full items-center justify-between rounded-[8px] px-2 py-1.5 text-left hover:bg-[#f8fafc]"
                    onClick={() => {
                      form.setFieldValue("medicament_externe_id", String(item.id));
                      form.setFieldValue("nom_medicament", item.nom_medicament);
                    }}
                    type="button"
                  >
                    <span className="font-['Inter'] text-[14px] text-[#0f3460]">{item.nom_medicament}</span>
                    <Package className="size-4 text-[#76bbdd]" />
                  </button>
                ))}
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-4">
              <FieldInput form={form} name="indication" label="Indication" required placeholder="Ex: Douleur et fièvre" />
              <FieldInput form={form} name="dosage" label="Dosage" required placeholder="Ex: 500mg" />
            </div>

            <FieldInput form={form} name="posologie" label="Posologie" required placeholder="Ex: 1 cp x3/j" />
            <FieldTextarea form={form} name="contre_indications" label="Contre-indications" placeholder="Ex: Insuffisance hépatique, allergie..." />
            <FieldTextarea form={form} name="effets_indesirables" label="Effets indésirables" placeholder="Ex: Nausées, somnolence..." />

            <div className="grid grid-cols-2 gap-4">
              <FieldInput form={form} name="date_prescription" label="Date de prescription" placeholder="2026-03-20" />
              <FieldInput form={form} name="prescrit_par" label="Prescrit par" readOnly />
            </div>

            <form.Field name="est_actif">
              {(field) => (
                <label className="flex h-[45.6px] w-full cursor-pointer items-center gap-[10px] rounded-[4px] border-[0.8px] border-[#c2e0ef] bg-[#f8fafc] py-[0.8px] pl-[12.8px] pr-[0.8px]">
                  <input
                    checked={field.state.value}
                    className="peer sr-only"
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.checked)}
                    type="checkbox"
                  />
                  <span className={`flex size-4 items-center justify-center rounded-[4px] border ${field.state.value ? "border-[#76bbdd] bg-[#76bbdd]" : "border-[#c2e0ef] bg-white"}`}>
                    <svg className={`size-[12px] text-white ${field.state.value ? "opacity-100" : "opacity-0"}`} fill="none" viewBox="0 0 12 12">
                      <path d="M2.6 6.3L5.1 8.7L9.4 4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                    </svg>
                  </span>
                  <span className="font-['Inter'] text-[14px] font-medium text-[#0f3460]">Traitement actif (en cours)</span>
                </label>
              )}
            </form.Field>
          </div>

          <div className="flex items-center justify-end gap-3 border-t-[0.67px] border-[rgba(194,224,239,0.4)] px-5 py-[8px]">
            <button className="h-[37.6px] rounded-[12px] border border-[#f77a21] px-4 font-['Plus_Jakarta_Sans'] text-[14px] font-medium text-[#f77a21]" onClick={() => onOpenChange(false)} type="button">
              Annuler
            </button>
            <button className="h-[37.6px] rounded-[12px] bg-[#76bbdd] px-4 font-['Plus_Jakarta_Sans'] text-[14px] font-medium text-white shadow-[0px_4px_12px_0px_rgba(118,187,221,0.5)]" disabled={updateMutation.isPending} type="submit">
              {updateMutation.isPending ? "Enregistrement..." : "Modifier"}
            </button>
          </div>
        </form>
      </div>
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
      {(field: any) => (
        <div className="space-y-[6px]">
          <label className="font-['Inter'] text-[14px] font-medium text-[#0f3460]">
            {label} {required ? <span className="text-[#f97316]">*</span> : null}
          </label>
          <input
            className="h-[37.6px] w-full rounded-[10px] border-[0.8px] border-[#c2e0ef] px-3 font-['Inter'] text-[14px] text-[#0f3460] placeholder:text-[rgba(100,116,139,0.9)]"
            onBlur={field.handleBlur}
            onChange={(e) => field.handleChange(e.target.value)}
            placeholder={placeholder}
            readOnly={readOnly}
            value={field.state.value}
          />
          {field.state.meta.errors[0]?.message ? (
            <p className="text-xs text-red-600">{field.state.meta.errors[0].message}</p>
          ) : null}
        </div>
      )}
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
          <label className="font-['Inter'] text-[14px] font-medium text-[#0f3460]">{label}</label>
          <textarea
            className="h-[57.6px] w-full resize-none rounded-[10px] border-[0.8px] border-[#c2e0ef] px-3 py-2 font-['Inter'] text-[14px] text-[#0f3460] placeholder:text-[rgba(100,116,139,0.9)]"
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
