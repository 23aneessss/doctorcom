import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { CircleHelp, Syringe, X } from "lucide-react";
import { useEffect, useMemo } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { trpcClient } from "@/utils/trpc";

type VaccinationDialogValues = {
  vaccin?: string;
  date_vaccination?: string;
  notes?: string | null;
};

export function NouvelleVaccinationDialog({
  open,
  onOpenChange,
  patientId,
  onCreated,
  mode = "create",
  vaccinationId,
  values,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  onCreated?: () => void;
  mode?: "create" | "edit" | "delete";
  vaccinationId?: string;
  values?: VaccinationDialogValues;
}) {
  const initialValues = useMemo(
    () => ({
      vaccin: values?.vaccin ?? "",
      date_vaccination:
        formatIsoDateToDisplay(values?.date_vaccination) || getTodayDisplayDate(),
      notes: values?.notes ?? "",
    }),
    [values],
  );

  const createMutation = useMutation({
    mutationFn: async (payload: {
      vaccin: string;
      date_vaccination: string;
      notes: string | null;
    }) => {
      return trpcClient.vaccination.recordVaccination.mutate({
        patient_id: patientId,
        vaccin: payload.vaccin,
        date_vaccination: payload.date_vaccination,
        notes: payload.notes,
      });
    },
    onSuccess: () => {
      toast.success("Vaccination ajoutée");
      onOpenChange(false);
      onCreated?.();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: {
      vaccinationId: string;
      changes: {
        vaccin?: string;
        date_vaccination?: string;
        notes?: string | null;
      };
    }) => {
      return trpcClient.vaccination.updateVaccination.mutate({
        vaccination_id: payload.vaccinationId,
        donnees: payload.changes,
      });
    },
    onSuccess: () => {
      toast.success("Vaccination modifiée");
      onOpenChange(false);
      onCreated?.();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (targetVaccinationId: string) => {
      return trpcClient.vaccination.deleteVaccination.mutate({
        vaccination_id: targetVaccinationId,
      });
    },
    onSuccess: () => {
      toast.success("Vaccination supprimée");
      onOpenChange(false);
      onCreated?.();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const form = useForm({
    defaultValues: initialValues,
    validators: {
      onSubmit: z.object({
        vaccin: z.string().trim().min(1, "Le nom du vaccin est requis"),
        date_vaccination: z
          .string()
          .trim()
          .min(1, "La date de vaccination est requise")
          .regex(/^\d{2}\/\d{2}\/\d{4}$/, "Format attendu : JJ/MM/AAAA")
          .refine(
            (value) => parseDisplayDateToIso(value) !== null,
            "Date de vaccination invalide",
          ),
        notes: z.string(),
      }),
    },
    onSubmit: async ({ value }) => {
      const dateIso = parseDisplayDateToIso(value.date_vaccination);
      if (!dateIso) {
        toast.error("Date de vaccination invalide");
        return;
      }

      if (mode === "edit") {
        if (!vaccinationId) {
          toast.error("Vaccination introuvable");
          return;
        }

        const changes: {
          vaccin?: string;
          date_vaccination?: string;
          notes?: string | null;
        } = {};

        const nextVaccin = value.vaccin.trim();
        const previousVaccin = initialValues.vaccin.trim();
        if (nextVaccin !== previousVaccin) {
          changes.vaccin = nextVaccin;
        }

        const previousIsoDate = parseDisplayDateToIso(initialValues.date_vaccination);
        if (dateIso !== previousIsoDate) {
          changes.date_vaccination = dateIso;
        }

        const nextNotes = normalizeOptionalText(value.notes);
        const previousNotes = normalizeOptionalText(initialValues.notes);
        if (nextNotes !== previousNotes) {
          changes.notes = nextNotes;
        }

        if (Object.keys(changes).length === 0) {
          toast.info("Aucune modification détectée");
          return;
        }

        await updateMutation.mutateAsync({ vaccinationId, changes });
        return;
      }

      await createMutation.mutateAsync({
        vaccin: value.vaccin.trim(),
        date_vaccination: dateIso,
        notes: normalizeOptionalText(value.notes),
      });
    },
  });

  useEffect(() => {
    form.reset(initialValues);
  }, [form, initialValues, mode, open]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onOpenChange]);

  if (!open) return null;

  const isPending =
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending;

  return (
    <>
      <style>
        {`
          @keyframes patientClinicalOverlayIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }

          @keyframes patientClinicalDialogIn {
            from {
              opacity: 0;
              transform: translateY(14px) scale(0.985);
            }
            to {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
          }
        `}
      </style>
      <div
        className="fixed inset-0 z-[140] flex items-center justify-center overflow-hidden bg-[rgba(10,35,65,0.24)] px-4 py-8 backdrop-blur-[4px]"
        onMouseDown={(event) => {
          if (event.currentTarget === event.target) onOpenChange(false);
        }}
        style={{ animation: "patientClinicalOverlayIn 180ms ease-out" }}
      >
      <div
        className="flex max-h-[calc(100dvh-64px)] w-full max-w-[672px] overflow-hidden rounded-[18px] border border-[#c2e0ef] bg-white shadow-[0px_30px_60px_-16px_rgba(15,52,96,0.28)]"
        style={{
          animation:
            "patientClinicalDialogIn 220ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        <form
          className="flex min-h-0 w-full flex-col"
          onSubmit={(event) => {
            event.preventDefault();
            if (mode === "delete") return;
            form.handleSubmit();
          }}
        >
          <DialogHeader
            title={
              mode === "edit"
                ? "Modifier vaccination"
                : mode === "delete"
                  ? "Supprimer vaccination"
                  : "Nouvelle vaccination"
            }
            onClose={() => onOpenChange(false)}
          />

          {mode === "delete" ? (
            <DeleteContent values={values} />
          ) : (
            <div className="consultation-modal-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pb-5 pt-6 sm:px-6">
              <FieldInput
                form={form}
                label="NOM DU VACCIN"
                name="vaccin"
                placeholder="Ex: COVID-19 (Pfizer), Grippe saisonnière..."
                required
              />

              <FieldInput
                form={form}
                label="DATE DE VACCINATION"
                name="date_vaccination"
                placeholder="16/03/2026"
                required
              />

              <FieldTextarea
                form={form}
                label="NOTES"
                name="notes"
                placeholder="Observations, effets secondaires, rappel prévu..."
              />
            </div>
          )}

          <DialogFooter
            mode={mode}
            isPending={isPending}
            onCancel={() => onOpenChange(false)}
            onDelete={async () => {
              if (!vaccinationId) {
                toast.error("Vaccination introuvable");
                return;
              }
              await deleteMutation.mutateAsync(vaccinationId);
            }}
          />
        </form>
      </div>
      </div>
    </>
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
    <div className="flex h-[72px] shrink-0 items-center justify-between border-b-[0.8px] border-[#c2e0ef] bg-[#f8fafc] px-6">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-[13px] bg-[#eef8fd] text-[#0f3460]">
          <Syringe className="size-5" />
        </span>
        <h3 className="font-['Plus_Jakarta_Sans'] text-[22px] font-semibold leading-7 text-[#0f3460]">
          {title}
        </h3>
      </div>

      <div className="flex items-center gap-4">
        <button
          aria-label="Aide"
          className="flex size-5 items-center justify-center text-[#0f3460]"
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

function FieldInput({
  form,
  name,
  label,
  required,
  placeholder,
}: {
  form: any;
  name: string;
  label: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <form.Field name={name}>
      {(field: any) => (
        <div className="space-y-[6px]">
          <label className="font-['Inter'] text-[14px] font-medium uppercase leading-5 text-[#0f3460]">
            {label} {required ? <span className="text-[#f97316]">*</span> : null}
          </label>
          <input
            className="h-[44px] w-full rounded-[12px] border border-[#c2e0ef] bg-white px-3 font-['Inter'] text-[14px] leading-5 text-[#0f3460] outline-none transition-colors placeholder:text-[rgba(100,116,139,0.9)] focus:border-[#76bbdd] focus:ring-2 focus:ring-[#c2e0ef]/50"
            onBlur={field.handleBlur}
            onChange={(e) => field.handleChange(e.target.value)}
            placeholder={placeholder}
            value={field.state.value}
          />
          {field.state.meta.errors[0]?.message ? (
            <p className="font-['Inter'] text-xs text-red-600">
              {field.state.meta.errors[0].message}
            </p>
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
          <label className="font-['Inter'] text-[14px] font-medium uppercase leading-5 text-[#0f3460]">
            {label}
          </label>
          <textarea
            className="h-[110px] w-full resize-none rounded-[12px] border border-[#c2e0ef] bg-white px-3 py-2 font-['Inter'] text-[14px] leading-5 text-[#0f3460] outline-none transition-colors placeholder:text-[rgba(100,116,139,0.9)] focus:border-[#76bbdd] focus:ring-2 focus:ring-[#c2e0ef]/50"
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

function DeleteContent({ values }: { values?: VaccinationDialogValues }) {
  return (
    <div className="min-h-0 flex-1 px-5 pb-5 pt-6 sm:px-6">
      <p className="font-['Inter'] text-[14px] leading-5 text-[#0f3460]">
        Confirmer la suppression de cette vaccination ?
      </p>

      <div className="mt-4 rounded-[10px] border-[0.8px] border-[#c2e0ef] bg-[#f8fafc] p-3">
        <p className="font-['Inter'] text-[12px] uppercase leading-4 text-[rgba(100,116,139,0.9)]">
          Vaccin
        </p>
        <p className="mt-1 font-['Inter'] text-[14px] leading-5 text-[#0f3460]">
          {values?.vaccin ?? "—"}
        </p>

        <p className="mt-3 font-['Inter'] text-[12px] uppercase leading-4 text-[rgba(100,116,139,0.9)]">
          Date
        </p>
        <p className="mt-1 font-['Inter'] text-[14px] leading-5 text-[#0f3460]">
          {formatIsoDateToDisplay(values?.date_vaccination) || "—"}
        </p>

        <p className="mt-3 font-['Inter'] text-[12px] uppercase leading-4 text-[rgba(100,116,139,0.9)]">
          Notes
        </p>
        <p className="mt-1 font-['Inter'] text-[14px] leading-5 text-[#0f3460]">
          {values?.notes?.trim() || "Sans notes"}
        </p>
      </div>
    </div>
  );
}

function DialogFooter({
  mode,
  isPending,
  onCancel,
  onDelete,
}: {
  mode: "create" | "edit" | "delete";
  isPending: boolean;
  onCancel: () => void;
  onDelete: () => Promise<void>;
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

      {mode === "delete" ? (
        <button
          className="h-[37.6px] cursor-pointer rounded-[12px] bg-[#e7000b] px-4 font-['Plus_Jakarta_Sans'] text-[14px] font-medium leading-5 text-white shadow-[0px_4px_12px_0px_rgba(231,0,11,0.35)] transition-colors hover:bg-[#c50009] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isPending}
          onClick={() => {
            void onDelete();
          }}
          type="button"
        >
          {isPending ? "Suppression..." : "Supprimer"}
        </button>
      ) : (
        <button
          className="h-[37.6px] cursor-pointer rounded-[12px] bg-[#76bbdd] px-4 font-['Plus_Jakarta_Sans'] text-[14px] font-medium leading-5 text-white shadow-[0px_4px_12px_0px_rgba(118,187,221,0.5)] transition-colors hover:bg-[#65afd4] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isPending}
          type="submit"
        >
          {isPending
            ? mode === "edit"
              ? "Enregistrement..."
              : "Ajout..."
            : mode === "edit"
              ? "Enregistrer"
              : "Ajouter"}
        </button>
      )}
    </div>
  );
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getTodayDisplayDate() {
  const today = new Date();
  const day = String(today.getDate()).padStart(2, "0");
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const year = String(today.getFullYear());
  return `${day}/${month}/${year}`;
}

function formatIsoDateToDisplay(value?: string | null) {
  if (!value) return "";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return "";
  return `${match[3]}/${match[2]}/${match[1]}`;
}

function parseDisplayDateToIso(value: string) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  const candidate = new Date(year, month - 1, day);
  if (
    candidate.getFullYear() !== year ||
    candidate.getMonth() !== month - 1 ||
    candidate.getDate() !== day
  ) {
    return null;
  }

  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
