import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { AlertCircle, CircleHelp, X, Users } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { trpcClient } from "@/utils/trpc";

export function NouvelAntecedentPersonnelDialog({
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
  values?: {
    description?: string;
    type?: string;
    details?: string;
    est_actif?: boolean;
  };
}) {
  const mutation = useMutation({
    mutationFn: async (value: {
      pathologie: string;
      details: string;
      est_actif: boolean;
    }) => {
      const description = value.pathologie.trim();
      return trpcClient.medicalHistory.ajouterAntecedent.mutate({
        patient_id: patientId,
        type: "personnel",
        description,
        personnel: {
          type: description,
          details: value.details.trim() || null,
          est_actif: value.est_actif,
        },
      });
    },
    onSuccess: () => {
      toast.success("Antécédent personnel ajouté");
      onOpenChange(false);
      onCreated?.();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const form = useForm({
    defaultValues: {
      pathologie: values?.description ?? values?.type ?? "",
      details: values?.details ?? "",
      est_actif: values?.est_actif ?? true,
    },
    validators: {
      onSubmit: z.object({
        pathologie: z.string().trim().min(1, "Le type/pathologie est requis"),
        details: z.string(),
        est_actif: z.boolean(),
      }),
    },
    onSubmit: async ({ value }) => {
      await mutation.mutateAsync(value);
    },
  });

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
          <div className="flex items-center gap-2">
            <Users className="size-5 text-[#0f3460]" />
            <h3 className="font-['Plus_Jakarta_Sans'] text-[20px] font-medium text-[#0f3460]">
              Nouvel antécédent personnel
            </h3>
          </div>

          <div className="flex items-center gap-4">
            <button
              aria-label="Aide"
              className="flex size-5 items-center justify-center text-[#0f3460]"
              data-context-help-href="/aide/patients#antecedents"
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
          className="px-5 pb-0 pt-5"
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            form.handleSubmit();
          }}
        >
          <div className="space-y-4">
            <form.Field name="pathologie">
              {(field) => (
                <div className="space-y-2">
                  <label className="font-['Plus_Jakarta_Sans'] text-[14px] font-semibold uppercase tracking-[0.3px] text-[#0f3460]">
                    Type / Pathologie *
                  </label>
                  <input
                    className="h-[37.6px] w-full rounded-[10px] border-[0.8px] border-[#c2e0ef] px-3 font-['Inter'] text-[14px] text-[#0f3460]"
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    value={field.state.value}
                  />
                  {field.state.meta.errors[0]?.message ? (
                    <p className="text-xs text-red-600">{field.state.meta.errors[0].message}</p>
                  ) : null}
                </div>
              )}
            </form.Field>

            <form.Field name="details">
              {(field) => (
                <div className="space-y-2">
                  <label className="font-['Plus_Jakarta_Sans'] text-[14px] font-semibold uppercase tracking-[0.3px] text-[#0f3460]">
                    Détails
                  </label>
                  <textarea
                    className="h-[77.6px] w-full resize-none rounded-[10px] border-[0.8px] border-[#c2e0ef] px-3 py-2 font-['Inter'] text-[14px] text-[#0f3460]"
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    value={field.state.value}
                  />
                </div>
              )}
            </form.Field>

            <form.Field name="est_actif">
              {(field) => (
                <label className="flex h-[45.6px] w-full cursor-pointer items-center gap-[12px] rounded-[10px] border-[0.8px] border-[#e2e8f0] bg-[#f8fafc] py-[0.8px] pl-[12.8px] pr-[0.8px]">
                  <input
                    checked={field.state.value}
                    className="peer sr-only"
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.checked)}
                    type="checkbox"
                  />
                  <span
                    className={`relative flex size-5 items-center justify-center rounded-[4px] border transition-colors peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-[#76bbdd]/35 ${
                      field.state.value ? "border-[#76bbdd] bg-[#76bbdd]" : "border-[#c2e0ef] bg-white"
                    }`}
                  >
                    <svg
                      className={`size-[14px] text-white transition-opacity ${
                        field.state.value ? "opacity-100" : "opacity-0"
                      }`}
                      fill="none"
                      viewBox="0 0 12 12"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M2.6 6.3L5.1 8.7L9.4 4"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                      />
                    </svg>
                  </span>
                  <span className="font-['Inter'] text-[14px] font-medium leading-5 text-[#334155]">
                    Pathologie active (en cours de traitement)
                  </span>
                </label>
              )}
            </form.Field>
          </div>

          <div className="mt-6 flex items-center justify-end gap-3 border-t-[0.8px] border-[rgba(194,224,239,0.4)] py-4">
            <button
              className="h-[37.6px] rounded-[12px] border border-[#f77a21] px-4 font-['Plus_Jakarta_Sans'] text-[14px] font-medium text-[#f77a21]"
              onClick={() => onOpenChange(false)}
              type="button"
            >
              Annuler
            </button>
            <form.Subscribe selector={(state) => state.values}>
              {(currentValues) => (
                <button
                  className="h-[37.6px] rounded-[12px] bg-[#76bbdd] px-4 font-['Plus_Jakarta_Sans'] text-[14px] font-medium text-white shadow-[0px_4px_12px_0px_rgba(118,187,221,0.5)] disabled:cursor-not-allowed disabled:bg-[#c2e0ef] disabled:text-[#6b819d] disabled:shadow-none"
                  disabled={mutation.isPending || !currentValues.pathologie.trim()}
                  type="submit"
                >
                  {mutation.isPending ? "Enregistrement..." : "Ajouter"}
                </button>
              )}
            </form.Subscribe>
          </div>
        </form>
      </div>
    </div>
  );
}
