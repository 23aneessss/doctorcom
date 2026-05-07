import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { AlertCircle, CircleHelp, X, Users } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { trpcClient } from "@/utils/trpc";

export function ModifierAntecedentFamilialDialog({
  open,
  onOpenChange,
  antecedentId,
  onCreated,
  values,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  antecedentId?: string;
  onCreated?: () => void;
  values?: {
    description?: string;
    details?: string;
    lien_parente?: string;
  };
}) {
  const updateMutation = useMutation({
    mutationFn: async (value: { lien_parente: string; antecedent: string }) => {
      if (!antecedentId) {
        throw new Error("Antecedent introuvable");
      }

      return trpcClient.medicalHistory.mettreAJourAntecedent.mutate({
        antecedent_id: antecedentId,
        donnees: {
          description: value.antecedent.trim(),
          familial: {
            lien_parente: value.lien_parente.trim() || null,
            details: null,
          },
        },
      });
    },
    onSuccess: () => {
      toast.success("Antécédent familial modifié");
      onOpenChange(false);
      onCreated?.();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const form = useForm({
    defaultValues: {
      lien_parente: values?.lien_parente ?? "",
      antecedent: values?.description ?? values?.details ?? "",
    },
    validators: {
      onSubmit: z.object({
        lien_parente: z.string().trim().min(1, "Le lien de parenté est requis"),
        antecedent: z.string().trim().min(1, "L'antécédent est requis"),
      }),
    },
    onSubmit: async ({ value }) => {
      await updateMutation.mutateAsync(value);
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
              Modifier l'antécédent familial
            </h3>
          </div>

          <div className="flex items-center gap-4">
            <button
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
          className="px-5 pb-0 pt-5"
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            form.handleSubmit();
          }}
        >
          <div className="space-y-4">
            <form.Field name="lien_parente">
              {(field) => (
                <div className="space-y-2">
                  <label className="font-['Plus_Jakarta_Sans'] text-[14px] font-semibold uppercase tracking-[0.3px] text-[#0f3460]">
                    Lien de parenté *
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

            <form.Field name="antecedent">
              {(field) => (
                <div className="space-y-2">
                  <label className="font-['Plus_Jakarta_Sans'] text-[14px] font-semibold uppercase tracking-[0.3px] text-[#0f3460]">
                    Antécédent *
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
                  disabled={
                    updateMutation.isPending ||
                    !currentValues.lien_parente.trim() ||
                    !currentValues.antecedent.trim()
                  }
                  type="submit"
                >
                  {updateMutation.isPending ? "Enregistrement..." : "Enregistrer"}
                </button>
              )}
            </form.Subscribe>
          </div>
        </form>
      </div>
    </div>
  );
}
