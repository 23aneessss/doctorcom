import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { CircleHelp, MapPin, X } from "lucide-react";
import { useEffect, useMemo } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { trpcClient } from "@/utils/trpc";

type VoyageDialogValues = {
  destination?: string;
  date?: string;
  duree_jours?: number | null;
  epidemies_destination?: string | null;
};

export function NouveauVoyageDialog({
  open,
  onOpenChange,
  patientId,
  onCreated,
  mode = "create",
  voyageId,
  values,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  onCreated?: () => void;
  mode?: "create" | "edit" | "delete";
  voyageId?: string;
  values?: VoyageDialogValues;
}) {
  const initialValues = useMemo(
    () => ({
      destination: values?.destination ?? "",
      date: values?.date ?? getTodayIsoDate(),
      duree_jours:
        typeof values?.duree_jours === "number" ? String(values.duree_jours) : "",
      epidemies_destination: values?.epidemies_destination ?? "",
    }),
    [values],
  );

  const createMutation = useMutation({
    mutationFn: async (payload: {
      destination: string;
      date: string;
      duree_jours: number | null;
      epidemies_destination: string | null;
    }) => {
      return trpcClient.travel.createVoyage.mutate({
        patient_id: patientId,
        destination: payload.destination,
        date: payload.date,
        duree_jours: payload.duree_jours,
        epidemies_destination: payload.epidemies_destination,
      });
    },
    onSuccess: () => {
      toast.success("Voyage ajouté");
      onOpenChange(false);
      onCreated?.();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: {
      voyageId: string;
      changes: {
        destination?: string;
        date?: string;
        duree_jours?: number | null;
        epidemies_destination?: string | null;
      };
    }) => {
      return trpcClient.travel.updateVoyage.mutate({
        voyage_id: payload.voyageId,
        donnees: payload.changes,
      });
    },
    onSuccess: () => {
      toast.success("Voyage modifié");
      onOpenChange(false);
      onCreated?.();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (targetVoyageId: string) => {
      return trpcClient.travel.deleteVoyage.mutate({
        voyage_id: targetVoyageId,
      });
    },
    onSuccess: () => {
      toast.success("Voyage supprimé");
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
        destination: z.string().trim().min(1, "La destination est requise"),
        date: z
          .string()
          .trim()
          .min(1, "La date est requise")
          .regex(/^\d{4}-\d{2}-\d{2}$/, "Format attendu : YYYY-MM-DD"),
        duree_jours: z
          .string()
          .trim()
          .refine(
            (value) => value.length === 0 || /^\d+$/.test(value),
            "Durée invalide",
          ),
        epidemies_destination: z.string(),
      }),
    },
    onSubmit: async ({ value }) => {
      const normalizedDuration = normalizeOptionalDuration(value.duree_jours);
      if (normalizedDuration === "invalid") {
        toast.error("Durée invalide");
        return;
      }

      if (mode === "edit") {
        if (!voyageId) {
          toast.error("Voyage introuvable");
          return;
        }

        const changes: {
          destination?: string;
          date?: string;
          duree_jours?: number | null;
          epidemies_destination?: string | null;
        } = {};

        const nextDestination = value.destination.trim();
        const previousDestination = initialValues.destination.trim();
        if (nextDestination !== previousDestination) {
          changes.destination = nextDestination;
        }

        if (value.date !== initialValues.date) {
          changes.date = value.date;
        }

        const previousDuration = normalizeOptionalDuration(initialValues.duree_jours);
        if (normalizedDuration !== previousDuration) {
          changes.duree_jours = normalizedDuration;
        }

        const nextEpidemies = normalizeOptionalText(value.epidemies_destination);
        const previousEpidemies = normalizeOptionalText(
          initialValues.epidemies_destination,
        );
        if (nextEpidemies !== previousEpidemies) {
          changes.epidemies_destination = nextEpidemies;
        }

        if (Object.keys(changes).length === 0) {
          toast.info("Aucune modification détectée");
          return;
        }

        await updateMutation.mutateAsync({ voyageId, changes });
        return;
      }

      await createMutation.mutateAsync({
        destination: value.destination.trim(),
        date: value.date,
        duree_jours: normalizedDuration,
        epidemies_destination: normalizeOptionalText(value.epidemies_destination),
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
    createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

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
                ? "Modifier voyage"
                : mode === "delete"
                  ? "Supprimer voyage"
                  : "Nouveau voyage"
            }
            onClose={() => onOpenChange(false)}
          />

          {mode === "delete" ? (
            <DeleteContent values={values} />
          ) : (
            <div className="consultation-modal-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 pb-5 pt-6 sm:px-6">
              <FieldInput
                form={form}
                label="DESTINATION"
                name="destination"
                placeholder="Ex: Maroc"
                required
              />

              <FieldInput
                form={form}
                label="DATE"
                name="date"
                placeholder="2026-01-15"
                required
              />

              <FieldInput
                form={form}
                label="DURÉE (jours)"
                name="duree_jours"
                placeholder="Ex: 7"
              />

              <FieldTextarea
                form={form}
                label="ÉPIDÉMIES À DESTINATION"
                name="epidemies_destination"
                placeholder="Ex: Dengue, paludisme..."
              />
            </div>
          )}

          <form.Subscribe selector={(state) => state.values}>
            {(currentValues) => (
              <DialogFooter
                mode={mode}
                isPending={isPending}
                isSubmitBlocked={mode !== "delete" && isVoyageSubmitBlocked(currentValues)}
                onCancel={() => onOpenChange(false)}
                onDelete={async () => {
                  if (!voyageId) {
                    toast.error("Voyage introuvable");
                    return;
                  }
                  await deleteMutation.mutateAsync(voyageId);
                }}
              />
            )}
          </form.Subscribe>
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
          <MapPin className="size-5" />
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

function DeleteContent({ values }: { values?: VoyageDialogValues }) {
  return (
    <div className="min-h-0 flex-1 px-5 pb-5 pt-6 sm:px-6">
      <p className="font-['Inter'] text-[14px] leading-5 text-[#0f3460]">
        Confirmer la suppression de ce voyage ?
      </p>

      <div className="mt-4 rounded-[10px] border-[0.8px] border-[#c2e0ef] bg-[#f8fafc] p-3">
        <p className="font-['Inter'] text-[12px] uppercase leading-4 text-[rgba(100,116,139,0.9)]">
          Destination
        </p>
        <p className="mt-1 font-['Inter'] text-[14px] leading-5 text-[#0f3460]">
          {values?.destination ?? "—"}
        </p>

        <p className="mt-3 font-['Inter'] text-[12px] uppercase leading-4 text-[rgba(100,116,139,0.9)]">
          Date
        </p>
        <p className="mt-1 font-['Inter'] text-[14px] leading-5 text-[#0f3460]">
          {values?.date ?? "—"}
        </p>

        <p className="mt-3 font-['Inter'] text-[12px] uppercase leading-4 text-[rgba(100,116,139,0.9)]">
          Durée
        </p>
        <p className="mt-1 font-['Inter'] text-[14px] leading-5 text-[#0f3460]">
          {typeof values?.duree_jours === "number"
            ? `${values.duree_jours} jours`
            : "Durée inconnue"}
        </p>
      </div>
    </div>
  );
}

function DialogFooter({
  mode,
  isPending,
  isSubmitBlocked,
  onCancel,
  onDelete,
}: {
  mode: "create" | "edit" | "delete";
  isPending: boolean;
  isSubmitBlocked: boolean;
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
          className="h-[37.6px] cursor-pointer rounded-[12px] bg-[#76bbdd] px-4 font-['Plus_Jakarta_Sans'] text-[14px] font-medium leading-5 text-white shadow-[0px_4px_12px_0px_rgba(118,187,221,0.5)] transition-colors hover:bg-[#65afd4] disabled:cursor-not-allowed disabled:bg-[#c2e0ef] disabled:text-[#6b819d] disabled:shadow-none"
          disabled={isPending || isSubmitBlocked}
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

function isVoyageSubmitBlocked(values: {
  destination: string;
  date: string;
  duree_jours: string;
}) {
  return (
    !values.destination.trim() ||
    !/^\d{4}-\d{2}-\d{2}$/.test(values.date.trim()) ||
    normalizeOptionalDuration(values.duree_jours) === "invalid"
  );
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeOptionalDuration(value: string): number | null | "invalid" {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (!/^\d+$/.test(trimmed)) {
    return "invalid";
  }

  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return "invalid";
  }

  return parsed;
}

function getTodayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}
