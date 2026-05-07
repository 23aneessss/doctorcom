import { useEffect } from "react";
import type { ReactNode } from "react";

import { CircleHelp, X } from "lucide-react";
import { z } from "zod";

import type { MedicationFormValues } from "../components/-medication-helpers";

export const medicationFormSchema = z.object({
  nom_medicament: z.string().trim().min(1, "Le nom du médicament est requis"),
  nom_generique: z.string(),
  classe_therapeutique: z.string(),
  famille_pharmacologique: z.string(),
  posologie_adulte: z.string(),
  posologie_enfant: z.string(),
  dose_maximale: z.string(),
  frequence_administration: z.string(),
  grossesse: z.string(),
  allaitement: z.string(),
  substances_actives: z.string(),
  indications: z.string(),
  contre_indications: z.string(),
  precautions: z.string(),
  interactions: z.string(),
  effets_indesirables: z.string(),
  presentations: z.string(),
});

export function MedicationDialogShell({
  open,
  title,
  onOpenChange,
  children,
  footer,
  width = "w-[720px]",
}: {
  open: boolean;
  title: string;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
}) {
  useEffect(() => {
    if (!open) {
      return;
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onOpenChange(false);
      }
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [open, onOpenChange]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(10,35,65,0.2)] px-4"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) {
          onOpenChange(false);
        }
      }}
    >
      <div className={`${width} overflow-hidden rounded-[14px] bg-white shadow-[0px_25px_50px_-12px_rgba(15,52,96,0.2)]`}>
        <div className="flex h-[75px] items-center justify-between border-b-[0.8px] border-[#c2e0ef] bg-[#f8fafc] px-5">
          <h3 className="font-['Plus_Jakarta_Sans'] text-[18px] font-semibold text-[#0f3460]">
            {title}
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
        {children}
        {footer}
      </div>
    </div>
  );
}

export function MedicationFieldInput({
  form,
  name,
  label,
  placeholder,
  required,
  readOnly,
}: {
  form: any;
  name: keyof MedicationFormValues;
  label: string;
  placeholder?: string;
  required?: boolean;
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
            onChange={(event) => field.handleChange(event.target.value)}
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

export function MedicationFieldTextarea({
  form,
  name,
  label,
  placeholder,
}: {
  form: any;
  name: keyof MedicationFormValues;
  label: string;
  placeholder?: string;
}) {
  return (
    <form.Field name={name}>
      {(field: any) => (
        <div className="space-y-[6px]">
          <label className="font-['Inter'] text-[14px] font-medium text-[#0f3460]">{label}</label>
          <textarea
            className="h-[78px] w-full resize-none rounded-[10px] border-[0.8px] border-[#c2e0ef] px-3 py-2 font-['Inter'] text-[14px] text-[#0f3460] placeholder:text-[rgba(100,116,139,0.9)]"
            onBlur={field.handleBlur}
            onChange={(event) => field.handleChange(event.target.value)}
            placeholder={placeholder}
            value={field.state.value}
          />
        </div>
      )}
    </form.Field>
  );
}

export function MedicationDialogFooter({
  onCancel,
  submitLabel,
  pendingLabel,
  isPending,
  isSubmitBlocked = false,
}: {
  onCancel: () => void;
  submitLabel: string;
  pendingLabel: string;
  isPending: boolean;
  isSubmitBlocked?: boolean;
}) {
  return (
    <div className="flex items-center justify-end gap-3 border-t-[0.67px] border-[rgba(194,224,239,0.4)] px-5 py-[8px]">
      <button
        className="h-[37.6px] rounded-[12px] border border-[#f77a21] px-4 font-['Plus_Jakarta_Sans'] text-[14px] font-medium text-[#f77a21]"
        onClick={onCancel}
        type="button"
      >
        Annuler
      </button>
      <button
        className="h-[37.6px] rounded-[12px] bg-[#76bbdd] px-4 font-['Plus_Jakarta_Sans'] text-[14px] font-medium text-white shadow-[0px_4px_12px_0px_rgba(118,187,221,0.5)] disabled:cursor-not-allowed disabled:bg-[#c2e0ef] disabled:text-[#6b819d] disabled:shadow-none"
        disabled={isPending || isSubmitBlocked}
        type="submit"
      >
        {isPending ? pendingLabel : submitLabel}
      </button>
    </div>
  );
}
