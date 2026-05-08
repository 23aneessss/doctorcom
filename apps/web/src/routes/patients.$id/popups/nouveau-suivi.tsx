import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { X, CircleHelp, ClipboardList, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { trpcClient } from "@/utils/trpc";


type SuiviDialogValues = {
  motif?: string;
  symptoms?: string[];
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
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [symptomDraft, setSymptomDraft] = useState("");

  const createSuiviMutation = useMutation({
    mutationFn: async (value: {
      date_ouverture: string;
      hypothese_diagnostic?: string;
      historique?: string;
    }) => {
      return trpcClient.consultation.createSuivi.mutate({
        patient_id: patientId,
        symptoms,
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
        symptoms?: string[];
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
      motif: values?.symptoms?.join(", ") ?? values?.motif ?? "",
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
        motif: z.string(),
        date_ouverture: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, "Format de date invalide"),
        hypothese_diagnostic: z.string(),
        historique: z.string(),
      }),
    },
    onSubmit: async ({ value }) => {
      const nextSymptoms = normalizeSymptoms(symptoms);
      if (nextSymptoms.length === 0) {
        toast.error("Au moins un symptome est requis");
        return;
      }

      if (mode === "edit") {
        if (!suiviId) {
          toast.error("Suivi introuvable pour modification");
          return;
        }

        const changes: {
          motif?: string;
          symptoms?: string[];
          date_ouverture?: string;
          hypothese_diagnostic?: string | null;
          historique?: string | null;
        } = {};

        if (nextSymptoms.join("\n") !== splitSymptoms(initialValues.motif).join("\n")) {
          changes.symptoms = nextSymptoms;
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
    setSymptoms(splitSymptoms(initialValues.motif));
    setSymptomDraft("");
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

  const addSymptom = () => {
    const nextValue = symptomDraft.trim();
    if (!nextValue) return;
    setSymptoms((current) => normalizeSymptoms([...current, nextValue]));
    setSymptomDraft("");
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(10,35,65,0.2)]"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) {
          onOpenChange(false);
        }
      }}
    >
      <div
        aria-labelledby="nouveau-suivi-title"
        aria-modal="true"
        className="h-[583px] w-[512px] overflow-hidden rounded-[14px] bg-white shadow-[0px_25px_50px_-12px_rgba(15,52,96,0.2)]"
        role="dialog"
      >
        <div className="flex h-[75px] items-center justify-between border-b-[0.8px] border-[#c2e0ef] bg-[#f8fafc] px-5 pb-[0.8px]">
          <div className="flex items-center gap-2">
            <ClipboardList className="size-5 "  color="#0f3460"/>
            <h3
              className="font-['Plus_Jakarta_Sans'] text-[18px] font-semibold leading-[27px] text-[#0f3460]"
              id="nouveau-suivi-title"
            >
              {mode === "edit" ? "Modifier suivi" : "Nouveau suivi"}
            </h3>
          </div>

          <div className="flex items-center gap-4">
            <button
              aria-label="Help"
              className="flex size-5 items-center justify-center text-[#0f3460]"
              type="button"
            >
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
          className="flex h-[508px] flex-col justify-between"
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            form.handleSubmit();
          }}
        >
          <div className="flex flex-col gap-4 px-5 pt-5">
            <div className="flex min-h-[104px] flex-col gap-1">
              <label className="font-['Plus_Jakarta_Sans'] text-[14px] font-semibold uppercase tracking-[0.3px] text-[#0f3460]">
                Symptoms <span className="text-[#f97316]">*</span>
              </label>
              <div className="rounded-[12px] border-[0.8px] border-[#c2e0ef] bg-white px-3 py-2">
                <div className="mb-2 flex flex-wrap gap-2">
                  {symptoms.map((symptom) => (
                    <span
                      className="inline-flex items-center gap-1 rounded-full border border-[#c2e0ef] bg-[#f8fbff] px-3 py-1 font-['Plus_Jakarta_Sans'] text-[12px] font-semibold text-[#0f3460]"
                      key={symptom}
                    >
                      {symptom}
                      <button
                        aria-label={`Retirer ${symptom}`}
                        className="text-[#64748b] hover:text-[#f97316]"
                        onClick={() =>
                          setSymptoms((current) =>
                            current.filter((item) => item !== symptom),
                          )
                        }
                        type="button"
                      >
                        <X className="size-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    className="h-[34px] min-w-0 flex-1 font-['Plus_Jakarta_Sans'] text-[14px] text-[#0f3460] outline-none placeholder:text-[rgba(10,10,10,0.5)]"
                    onChange={(event) => setSymptomDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addSymptom();
                      }
                    }}
                    placeholder="Ajouter un symptome puis Entrer"
                    value={symptomDraft}
                  />
                  <button
                    className="inline-flex h-[34px] items-center gap-1 rounded-[10px] bg-[#eaf3fb] px-3 font-['Plus_Jakarta_Sans'] text-[12px] font-semibold text-[#0f3460] disabled:opacity-50"
                    disabled={!symptomDraft.trim()}
                    onClick={addSymptom}
                    type="button"
                  >
                    <Plus className="size-3" />
                    Ajouter
                  </button>
                </div>
              </div>
              {symptoms.length === 0 ? (
                <p className="text-xs text-red-600">Au moins un symptome est requis</p>
              ) : null}
            </div>

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

            <form.Subscribe selector={(state) => state.values}>
              {(currentValues) => {
                const canSubmit =
                  symptoms.length > 0 &&
                  /^\d{4}-\d{2}-\d{2}$/.test(currentValues.date_ouverture ?? "");

                return (
                  <button
                    className="h-[37.6px] w-[160px] cursor-pointer rounded-[12px] bg-[#76bbdd] font-['Inter'] text-[14px] font-medium leading-5 text-white shadow-[0px_4px_12px_0px_rgba(118,187,221,0.5)] disabled:cursor-not-allowed disabled:bg-[#c2e0ef] disabled:text-[#6b819d] disabled:shadow-none"
                    disabled={isPending || !canSubmit}
                    type="submit"
                  >
                    {isPending
                      ? "Enregistrement..."
                      : mode === "edit"
                        ? "Enregistrer"
                        : "Creer le suivi"}
                  </button>
                );
              }}
            </form.Subscribe>
          </div>
        </form>
      </div>
    </div>
  );
}

function splitSymptoms(value: string): string[] {
  return normalizeSymptoms(
    value
      .split(/\r?\n|,/)
      .map((item) => item.trim())
      .filter(Boolean),
  );
}

function normalizeSymptoms(values: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const value of values) {
    const trimmed = value.trim();
    const key = trimmed.toLowerCase();
    if (!trimmed || seen.has(key)) continue;
    seen.add(key);
    normalized.push(trimmed);
  }

  return normalized;
}
