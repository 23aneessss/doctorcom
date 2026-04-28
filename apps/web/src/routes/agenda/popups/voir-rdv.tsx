import { CalendarDays, Clock, FileText, Pencil, Trash2, UserRound } from "lucide-react";
import { useState } from "react";

import type { AgendaEvent } from "@/components/agenda/types";

import { DialogShell, StatusBadge } from "./rdv-dialog-shared";

interface VoirRdvDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: AgendaEvent | null;
  onEdit: (appointment: AgendaEvent) => void;
  onDelete: (appointment: AgendaEvent) => Promise<boolean>;
  isDeleting?: boolean;
}

function formatDateLabel(dateValue: string) {
  const date = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return dateValue;
  }

  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function VoirRdvDialog({
  open,
  onOpenChange,
  appointment,
  onEdit,
  onDelete,
  isDeleting = false,
}: VoirRdvDialogProps) {
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  if (!appointment) {
    return null;
  }

  const endTime = appointment.endTime ?? "--:--";

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      title="Details rendez-vous"
      subtitle="Consultez rapidement le contexte du creneau"
      icon={<CalendarDays className="size-5" aria-hidden="true" />}
      maxWidth="max-w-[520px]"
      footer={
        <>
          <button
            className="h-[38px] rounded-[12px] border border-[#c2e0ef] px-4 font-['Plus_Jakarta_Sans'] text-[14px] font-medium text-[#0f3460] transition-colors hover:bg-[#f8fafc]"
            onClick={() => onOpenChange(false)}
            type="button"
            disabled={isDeleting}
          >
            Fermer
          </button>
          <button
            className="inline-flex h-[38px] items-center justify-center gap-2 rounded-[12px] border border-[#CA3500]/55 bg-[#fff5f3] px-4 font-['Inter'] text-[13px] font-medium text-[#CA3500] transition-colors hover:bg-[#ffe8e3]"
            onClick={() => setIsConfirmingDelete(true)}
            type="button"
            disabled={isDeleting}
          >
            <Trash2 className="size-4" aria-hidden="true" />
            Supprimer
          </button>
          <button
            className="inline-flex h-[38px] items-center justify-center gap-2 rounded-[12px] bg-[#76bbdd] px-5 font-['Inter'] text-[14px] font-medium text-white shadow-[0px_4px_12px_rgba(118,187,221,0.45)] transition-colors hover:bg-[#63afd4]"
            onClick={() => onEdit(appointment)}
            type="button"
            disabled={isDeleting}
          >
            <Pencil className="size-4" aria-hidden="true" />
            Modifier
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <section className="rounded-[16px] border border-[#c2e0ef] bg-gradient-to-br from-[rgba(194,224,239,0.36)] to-white p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-full border border-[#1447E6] bg-white font-['Inter'] text-[15px] font-bold text-[#1447E6]">
                {appointment.patientInitials}
              </span>
              <div className="min-w-0">
                <p className="m-0 truncate font-['Plus_Jakarta_Sans'] text-[18px] font-bold text-[#0f3460]">
                  {appointment.patientName}
                </p>
                <p className="m-0 mt-1 truncate font-['Inter'] text-[13px] font-medium text-[#64748b]">
                  {appointment.type}
                </p>
              </div>
            </div>
            <StatusBadge status={appointment.status} />
          </div>
        </section>

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <InfoTile
            icon={<CalendarDays className="size-4" aria-hidden="true" />}
            label="Date"
            value={formatDateLabel(appointment.date)}
          />
          <InfoTile
            icon={<Clock className="size-4" aria-hidden="true" />}
            label="Horaire"
            value={`${appointment.startTime} - ${endTime}`}
          />
          <InfoTile
            icon={<UserRound className="size-4" aria-hidden="true" />}
            label="Initiales"
            value={appointment.patientInitials}
          />
          <InfoTile
            icon={<FileText className="size-4" aria-hidden="true" />}
            label="Reference"
            value={`RDV-${appointment.id.slice(0, 8).toUpperCase()}`}
          />
        </section>

        <section className="rounded-[14px] border border-[#e2eef5] bg-[#f8fafc] p-4">
          <p className="m-0 font-['Plus_Jakarta_Sans'] text-[13px] font-semibold uppercase tracking-[0.3px] text-[#0f3460]">
            Notes
          </p>
          <p className="m-0 mt-2 min-h-[44px] font-['Inter'] text-[14px] leading-6 text-[#334155]">
            {appointment.notes?.trim() || "Aucune note ajoutee pour ce rendez-vous."}
          </p>
        </section>
      </div>

      {isConfirmingDelete ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(10,35,65,0.28)] p-4">
          <section className="w-full max-w-[430px] overflow-hidden rounded-[20px] border border-[#ffd5cd] bg-white shadow-[0_24px_70px_rgba(15,52,96,0.22)]">
            <div className="bg-gradient-to-br from-[#fff5f3] to-white px-5 py-5 text-center">
              <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-[#ffe8e3] text-[#CA3500]">
                <Trash2 className="size-7" aria-hidden="true" />
              </span>
              <h4 className="m-0 mt-4 font-['Plus_Jakarta_Sans'] text-[20px] font-bold text-[#0f3460]">
                Supprimer ce rendez-vous ?
              </h4>
              <p className="mx-auto mt-2 max-w-[320px] font-['Inter'] text-[14px] leading-6 text-[#64748b]">
                Cette action retire definitivement le creneau de l'agenda. Vous ne pourrez pas l'annuler.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-[#f1d3cc] px-5 py-4">
              <button
                className="h-[40px] rounded-[12px] border border-[#c2e0ef] px-4 font-['Inter'] text-[14px] font-semibold text-[#0f3460] transition-colors hover:bg-[#f8fafc]"
                type="button"
                onClick={() => setIsConfirmingDelete(false)}
                disabled={isDeleting}
              >
                Annuler
              </button>
              <button
                className="inline-flex h-[40px] items-center justify-center gap-2 rounded-[12px] bg-[#CA3500] px-4 font-['Inter'] text-[14px] font-semibold text-white shadow-[0_8px_18px_rgba(202,53,0,0.24)] transition-colors hover:bg-[#af2f02]"
                type="button"
                onClick={async () => {
                  const deleted = await onDelete(appointment);
                  if (deleted) {
                    setIsConfirmingDelete(false);
                    onOpenChange(false);
                  }
                }}
                disabled={isDeleting}
              >
                <Trash2 className="size-4" aria-hidden="true" />
                {isDeleting ? "Suppression..." : "Supprimer"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </DialogShell>
  );
}

function InfoTile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[14px] border border-[#e2eef5] bg-white p-3 shadow-[0_1px_2px_rgba(15,52,96,0.06)]">
      <div className="flex items-center gap-2 text-[#76bbdd]">
        {icon}
        <p className="m-0 font-['Plus_Jakarta_Sans'] text-[12px] font-semibold uppercase tracking-[0.3px] text-[#64748b]">
          {label}
        </p>
      </div>
      <p className="m-0 mt-2 font-['Inter'] text-[14px] font-semibold text-[#0f3460]">
        {value}
      </p>
    </div>
  );
}
