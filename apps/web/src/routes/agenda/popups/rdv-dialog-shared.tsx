import { CircleHelp, X } from "lucide-react";
import { useEffect, type ReactNode } from "react";

import type { AgendaSlotStatus } from "@/components/agenda/types";

export interface RdvFormValues {
  patientId?: string;
  patientName: string;
  patientInitials: string;
  type: string;
  date: string;
  startTime: string;
  endTime: string;
  status: AgendaSlotStatus;
  notes: string;
}

export const RDV_STATUS_OPTIONS: Array<{ value: AgendaSlotStatus; label: string }> = [
  { value: "booked", label: "Confirme" },
  { value: "pending", label: "En attente" },
  { value: "completed", label: "Termine" },
  { value: "cancelled", label: "Annule" },
  { value: "blocked", label: "Bloque" },
];

export const RDV_TYPE_OPTIONS = [
  "Consultation",
  "Controle de routine",
  "Premiere consultation",
  "Suivi post-traitement",
  "Urgence",
  "Creneau bloque",
] as const;

export interface RdvPatientOption {
  id: string;
  label: string;
  initials: string;
  matricule?: string;
}

export const RDV_TIME_OPTIONS = Array.from({ length: 24 * 4 }, (_, index) => {
  const totalMinutes = index * 15;
  const hours = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
  const minutes = String(totalMinutes % 60).padStart(2, "0");

  return `${hours}:${minutes}`;
});

const STATUS_STYLE_MAP: Record<AgendaSlotStatus, { label: string; className: string }> = {
  booked: {
    label: "Confirme",
    className: "border-[#1447E6] bg-[rgba(194,224,239,0.3)] text-[#1447E6]",
  },
  pending: {
    label: "En attente",
    className: "border-[#F97316] bg-[#FFF9F4] text-[#F97316]",
  },
  completed: {
    label: "Termine",
    className: "border-[#009689] bg-[rgba(208,241,231,0.3)] text-[#009689]",
  },
  cancelled: {
    label: "Annule",
    className: "border-[#CA3500] bg-[rgba(255,135,139,0.1)] text-[#CA3500]",
  },
  blocked: {
    label: "Bloque",
    className: "border-[#4B5563] bg-[#EEF2F7] text-[#4B5563]",
  },
};

export const fieldControlClassName =
  "h-[40px] w-full rounded-[12px] border-[0.8px] border-[#c2e0ef] bg-white px-3 font-['Inter'] text-[14px] font-normal leading-5 text-[#0f3460] shadow-[0_1px_2px_rgba(15,52,96,0.08)] outline-none transition-[border-color,box-shadow,background-color] duration-150 placeholder:text-[rgba(10,10,10,0.45)] hover:border-[#9ecae0] focus:border-[#76bbdd] focus:ring-4 focus:ring-[#76bbdd]/20";

export function getStatusLabel(status: AgendaSlotStatus) {
  return STATUS_STYLE_MAP[status].label;
}

export function getInitialsFromName(name: string) {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) {
    return "RD";
  }

  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export function StatusBadge({ status }: { status: AgendaSlotStatus }) {
  const style = STATUS_STYLE_MAP[status];

  return (
    <span
      className={`inline-flex min-h-7 items-center justify-center rounded-full border px-3 font-['Inter'] text-[12px] font-semibold ${style.className}`}
    >
      {style.label}
    </span>
  );
}

export function DialogShell({
  open,
  onOpenChange,
  title,
  subtitle,
  icon,
  children,
  footer,
  maxWidth = "max-w-[560px]",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle?: string;
  icon: ReactNode;
  children: ReactNode;
  footer: ReactNode;
  maxWidth?: string;
}) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onOpenChange(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onOpenChange]);

  if (!open) {
    return null;
  }

  return (
    <>
      <style>
        {`
          @keyframes agendaRdvOverlayIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }

          @keyframes agendaRdvDialogIn {
            from {
              opacity: 0;
              transform: translateY(18px) scale(0.985);
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
        style={{ animation: "agendaRdvOverlayIn 180ms ease-out" }}
        onMouseDown={(event) => {
          if (event.currentTarget === event.target) {
            onOpenChange(false);
          }
        }}
      >
      <section
        className={`flex max-h-[calc(100dvh-4rem)] w-full ${maxWidth} flex-col overflow-hidden rounded-[18px] border border-[#c2e0ef] bg-white shadow-[0px_30px_60px_-16px_rgba(15,52,96,0.28)]`}
        style={{ animation: "agendaRdvDialogIn 220ms cubic-bezier(0.22, 1, 0.36, 1)" }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="agenda-rdv-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex min-h-[75px] items-center justify-between border-b-[0.8px] border-[#c2e0ef] bg-[#f8fafc] px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[#0f3460]">
              {icon}
              <h3
                id="agenda-rdv-dialog-title"
                className="m-0 font-['Plus_Jakarta_Sans'] text-[18px] font-semibold leading-[27px] text-[#0f3460]"
              >
                {title}
              </h3>
            </div>
            {subtitle ? (
              <p className="mt-1 font-['Plus_Jakarta_Sans'] text-[12px] font-medium leading-4 text-[#052ca0]">
                {subtitle}
              </p>
            ) : null}
          </div>

          <div className="flex items-center gap-4 text-[#0f3460]">
            <button
              aria-label="Aide"
              className="flex size-5 items-center justify-center"
              type="button"
            >
              <CircleHelp className="size-5" />
            </button>
            <button
              aria-label="Fermer"
              className="flex size-5 cursor-pointer items-center justify-center"
              onClick={() => onOpenChange(false)}
              type="button"
            >
              <X className="size-5" />
            </button>
          </div>
        </header>

        <div className="consultation-modal-scrollbar min-h-0 flex-1 overflow-y-auto px-5 py-5">
          {children}
        </div>

        <footer className="flex items-center justify-end gap-3 border-t-[0.8px] border-[rgba(194,224,239,0.55)] bg-white px-5 py-3">
          {footer}
        </footer>
      </section>
      </div>
    </>
  );
}

export function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="font-['Plus_Jakarta_Sans'] text-[13px] font-semibold uppercase tracking-[0.3px] text-[#0f3460]">
        {label}
        {required ? <span className="text-[#f97316]"> *</span> : null}
      </span>
      {children}
    </label>
  );
}

export function TimeField({
  value,
  onChange,
  ariaLabel,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <>
      <input
        aria-label={ariaLabel}
        className={`${fieldControlClassName} ${className}`}
        type="time"
        step={300}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    </>
  );
}
