import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useEffect, useMemo } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { trpcClient } from "@/utils/trpc";

const nouveauSuiviHeaderIcon =
  "http://localhost:3845/assets/7c0c1a36b9ab3a3ed3c41d3b66e21ef9c3a1212a.svg";
const helpIcon =
  "http://localhost:3845/assets/2ad13c7bb378cd49f58079c0dcd63cb842cb8f1e.svg";

type SuiviDialogValues = {
  motif?: string;
  date_ouverture?: string;
  hypothese_diagnostic?: string;
  historique?: string;
};

export function NouveauSuiviDialog({
  open,
  onOpenChange,
  patientId,
  onCreated,
  mode = "create",
  suiviId,
  values,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  onCreated?: () => void;
  mode?: "create" | "edit";
  suiviId?: string;
  values?: SuiviDialogValues;
}) {
  const createSuiviMutation = useMutation({
    mutationFn: async (value: {
      motif: string;
      date_ouverture: string;
      hypothese_diagnostic?: string;
      historique?: string;
    }) => {
      return trpcClient.consultation.createSuivi.mutate({
        patient_id: patientId,
        motif: value.motif,
        date_ouverture: value.date_ouverture,
        hypothese_diagnostic: value.hypothese_diagnostic?.trim() || null,
        historique: value.historique?.trim() || null,
      });
    },
    onSuccess: () => {
      toast.success("Suivi cree avec succes");
      onOpenChange(false);
      onCreated?.();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateSuiviMutation = useMutation({
    mutationFn: async (payload: {
      suiviId: string;
      changes: {
        motif?: string;
        date_ouverture?: string;
        hypothese_diagnostic?: string | null;
        historique?: string | null;
      };
    }) => {
      return trpcClient.consultation.updateSuivi.mutate({
        suivi_id: payload.suiviId,
        donnees: payload.changes,
      });
    },
    onSuccess: () => {
      toast.success("Suivi modifie avec succes");
      onOpenChange(false);
      onCreated?.();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const initialValues = useMemo(
    () => ({
      motif: values?.motif ?? "",
      date_ouverture:
        values?.date_ouverture ?? new Date().toISOString().split("T")[0] ?? "",
      hypothese_diagnostic: values?.hypothese_diagnostic ?? "",
      historique: values?.historique ?? "",
    }),
    [values]
  );

  const form = useForm({
    defaultValues: initialValues,
    validators: {
      onSubmit: z.object({
        motif: z.string().trim().min(1, "Le motif est requis"),
        date_ouverture: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, "Format de date invalide"),
        hypothese_diagnostic: z.string(),
        historique: z.string(),
      }),
    },
    onSubmit: async ({ value }) => {
      if (mode === "edit") {
        if (!suiviId) {
          toast.error("Suivi introuvable pour modification");
          return;
        }

        const changes: {
          motif?: string;
          date_ouverture?: string;
          hypothese_diagnostic?: string | null;
          historique?: string | null;
        } = {};

        if (value.motif.trim() !== initialValues.motif.trim()) {
          changes.motif = value.motif.trim();
        }
        if (value.date_ouverture !== initialValues.date_ouverture) {
          changes.date_ouverture = value.date_ouverture;
        }
        if (
          (value.hypothese_diagnostic ?? "").trim() !==
          (initialValues.hypothese_diagnostic ?? "").trim()
        ) {
          changes.hypothese_diagnostic =
            value.hypothese_diagnostic.trim() || null;
        }
        if ((value.historique ?? "").trim() !== (initialValues.historique ?? "").trim()) {
          changes.historique = value.historique.trim() || null;
        }

        if (Object.keys(changes).length === 0) {
          toast.info("Aucune modification detectee");
          return;
        }

        await updateSuiviMutation.mutateAsync({ suiviId, changes });
        return;
      }

      await createSuiviMutation.mutateAsync(value);
      form.reset();
    },
  });

  useEffect(() => {
    form.reset(initialValues);
  }, [form, initialValues, mode, open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onOpenChange(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  if (!open) return null;

  const isPending = createSuiviMutation.isPending || updateSuiviMutation.isPending;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(10,35,65,0.2)]"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) {
          onOpenChange(false);
        }
      }}
    >
      <div className="h-[583px] w-[512px] overflow-hidden rounded-[14px] bg-white shadow-[0px_25px_50px_-12px_rgba(15,52,96,0.2)]">
        <div className="flex h-[75px] items-center justify-between border-b-[0.8px] border-[#c2e0ef] bg-[#f8fafc] px-5 pb-[0.8px]">
          <div className="flex items-center gap-2">
            <img alt="" className="size-5" src={nouveauSuiviHeaderIcon} />
            <h3 className="font-['Plus_Jakarta_Sans'] text-[18px] font-semibold leading-[27px] text-[#0f3460]">
              {mode === "edit" ? "Modifier suivi" : "Nouveau suivi"}
            </h3>
          </div>

          <div className="flex items-center gap-4">
            <button
              aria-label="Help"
              className="flex size-5 items-center justify-center text-[#0f3460]"
              type="button"
            >
              <img alt="" className="size-5" src={helpIcon} />
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
          className="flex h-[508px] flex-col justify-between"
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            form.handleSubmit();
          }}
        >
          <div className="flex flex-col gap-4 px-5 pt-5">
            <form.Field name="motif">
              {(field) => (
                <div className="flex h-[74px] flex-col gap-1">
                  <label className="font-['Plus_Jakarta_Sans'] text-[14px] font-semibold uppercase tracking-[0.3px] text-[#0f3460]">
                    Motif <span className="text-[#f97316]">*</span>
                  </label>
                  <input
                    className="h-[40.67px] rounded-[12px] border-[0.8px] border-[#c2e0ef] px-3 py-2 font-['Plus_Jakarta_Sans'] text-[14px] text-[#0f3460] outline-none placeholder:text-[rgba(10,10,10,0.5)]"
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="Ex : Cephalees, Douleur lombaire, Suivi diabete..."
                    value={field.state.value}
                  />
                  {field.state.meta.errors[0]?.message && (
                    <p className="text-xs text-red-600">{field.state.meta.errors[0].message}</p>
                  )}
                </div>
              )}
            </form.Field>

            <form.Field name="hypothese_diagnostic">
              {(field) => (
                <div className="flex h-[74px] flex-col gap-1">
                  <label className="font-['Plus_Jakarta_Sans'] text-[14px] font-semibold uppercase tracking-[0.3px] text-[#0f3460]">
                    Hypothese diagnostique
                  </label>
                  <input
                    className="h-[40.67px] rounded-[12px] border-[0.8px] border-[#c2e0ef] px-3 py-2 font-['Plus_Jakarta_Sans'] text-[14px] text-[#0f3460] outline-none placeholder:text-[rgba(10,10,10,0.5)]"
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="Ex : Migraine, Hernie discale, Diabete type 2..."
                    value={field.state.value}
                  />
                  {field.state.meta.errors[0]?.message && (
                    <p className="text-xs text-red-600">{field.state.meta.errors[0].message}</p>
                  )}
                </div>
              )}
            </form.Field>

            <form.Field name="historique">
              {(field) => (
                <div className="flex h-[107px] flex-col gap-1">
                  <label className="font-['Plus_Jakarta_Sans'] text-[14px] font-semibold uppercase tracking-[0.3px] text-[#0f3460]">
                    Historique / Anamnese
                  </label>
                  <textarea
                    className="h-[77.6px] resize-none rounded-[12px] border-[0.8px] border-[#c2e0ef] px-3 py-2 font-['Plus_Jakarta_Sans'] text-[14px] leading-5 text-[#0f3460] outline-none placeholder:text-[rgba(10,10,10,0.5)]"
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="Resume de l'histoire de la maladie..."
                    value={field.state.value}
                  />
                  {field.state.meta.errors[0]?.message && (
                    <p className="text-xs text-red-600">{field.state.meta.errors[0].message}</p>
                  )}
                </div>
              )}
            </form.Field>

            <form.Field name="date_ouverture">
              {(field) => (
                <div className="flex h-[57.588px] flex-col gap-1">
                  <label className="font-['Plus_Jakarta_Sans'] text-[14px] font-semibold uppercase tracking-[0.3px] text-[#0f3460]">
                    Date d'ouverture
                  </label>
                  <input
                    className="h-[37.6px] rounded-[12px] border-[0.8px] border-[#c2e0ef] px-3 font-['Plus_Jakarta_Sans'] text-[14px] text-[#0f3460] outline-none"
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    type="date"
                    value={field.state.value}
                  />
                  {field.state.meta.errors[0]?.message && (
                    <p className="text-xs text-red-600">{field.state.meta.errors[0].message}</p>
                  )}
                </div>
              )}
            </form.Field>
          </div>

          <div className="flex w-full items-center justify-end gap-3 border-t-[0.67px] border-[rgba(194,224,239,0.4)] pb-2 pr-5 pt-[8.67px]">
            <button
              className="h-[37.6px] w-[90.582px] cursor-pointer rounded-[12px] border border-[#f77a21] font-['Plus_Jakarta_Sans'] text-[14px] font-medium leading-6 text-[#f77a21]"
              onClick={() => onOpenChange(false)}
              type="button"
            >
              Annuler
            </button>

            <button
              className="h-[37.6px] w-[160px] cursor-pointer rounded-[12px] bg-[#76bbdd] font-['Inter'] text-[14px] font-medium leading-5 text-white shadow-[0px_4px_12px_0px_rgba(118,187,221,0.5)] disabled:cursor-not-allowed disabled:opacity-70"
              disabled={isPending}
              type="submit"
            >
              {isPending
                ? "Enregistrement..."
                : mode === "edit"
                  ? "Enregistrer"
                  : "Creer le suivi"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
