// apps/web/src/components/agenda/appointment-card.tsx
import type { AgendaEvent, AgendaSlotStatus, AgendaTone } from "./types";

const STATUS_META: Record<AgendaSlotStatus, { label: string; tone: AgendaTone }> = {
  booked: { label: "Confirmé", tone: "blue" },
  pending: { label: "En attente", tone: "orange" },
  completed: { label: "Terminé", tone: "green" },
  cancelled: { label: "Annulé", tone: "red" },
  blocked: { label: "Bloqué", tone: "slate" },
};

const getToneStyles = (tone: AgendaTone) => {
  switch (tone) {
    case "green":
      return {
        card: "border-[#009689] bg-[rgba(208,241,231,0.3)] rounded-[14px]",
        initials: "border-[#009689] text-[#009689]",
        text: "text-[#009689]",
        pill: "bg-white/70 text-[#009689] border-[#009689]",
      };
    case "blue":
      return {
        card: "border-[#1447E6] bg-[rgba(194,224,239,0.3)] rounded-[14px]",
        initials: "border-[#1447E6] text-[#1447E6]",
        text: "text-[#1447E6]",
        pill: "bg-white/70 text-[#1447E6] border-[#1447E6]",
      };
    case "orange":
      return {
        card: "border-[#F97316] bg-[#FFF9F4] rounded-[14px]",
        initials: "border-[#F97316] text-[#F97316]",
        text: "text-[#F97316]",
        pill: "bg-white/70 text-[#F97316] border-[#F97316]",
      };
    case "red":
      return {
        card: "border-[#CA3500] bg-[rgba(255,135,139,0.1)] rounded-[14px]",
        initials: "border-[#CA3500] text-[#CA3500]",
        text: "text-[#CA3500]",
        pill: "bg-white/70 text-[#CA3500] border-[#CA3500]",
      };
    case "slate":
      return {
        card: "border-[#4B5563] bg-[#EEF2F7] rounded-[14px]",
        initials: "border-[#4B5563] text-[#4B5563]",
        text: "text-[#4B5563]",
        pill: "bg-white/70 text-[#4B5563] border-[#4B5563]",
      };
    default:
      return {
        card: "border-[#1447E6] bg-[rgba(194,224,239,0.3)] rounded-[14px]",
        initials: "border-[#1447E6] text-[#1447E6]",
        text: "text-[#1447E6]",
        pill: "bg-white/70 text-[#1447E6] border-[#1447E6]",
      };
  }
};

function toMeridiemTime(timeValue: string) {
  const [hourText = "0", minuteText = "00"] = timeValue.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (isNaN(hour) || isNaN(minute)) return "00:00 AM";
  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = ((hour + 11) % 12) + 1;
  return `${String(hour12).padStart(2, "0")}:${String(minute).padStart(2, "0")} ${period}`;
}

interface AppointmentCardProps {
  appointment: AgendaEvent;
  onClick: (appointment: AgendaEvent) => void;
}

export function AppointmentCard({ appointment, onClick }: AppointmentCardProps) {
  const status = STATUS_META[appointment.status];
  const styles = getToneStyles(status.tone);

  return (
    <div
      onClick={() => onClick(appointment)}
      className={`flex h-full min-h-[4rem] w-full cursor-pointer items-center gap-3 border border-solid p-3.5 transition-all duration-200 hover:shadow-[0_0.45rem_0.9rem_rgba(194,224,239,0.42)] ${styles.card}`}
    >
      <div
        className={`inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-solid bg-white font-['Inter',sans-serif] text-[0.8rem] leading-none font-bold ${styles.initials}`}
      >
        {appointment.patientInitials}
      </div>

      <div className="flex-1 min-w-0">
        <p className={`m-0 truncate font-['Inter',sans-serif] text-[0.93rem] leading-tight font-semibold ${styles.text}`}>
          {appointment.patientName}
        </p>
        <p className="mt-0.5 truncate font-['Inter',sans-serif] text-[0.7rem] leading-tight font-medium text-[#536172]">
          {appointment.type}
        </p>
      </div>

      <div className="text-right flex-shrink-0">
        <p className={`m-0 font-['Inter',sans-serif] text-[0.78rem] leading-tight font-semibold ${styles.text}`}>
          {toMeridiemTime(appointment.startTime)}
        </p>
        <span
          className={`mt-1 inline-flex items-center justify-center rounded-full border px-2 py-0.5 font-['Inter',sans-serif] text-[0.62rem] leading-none font-semibold capitalize ${styles.pill}`}
        >
          {status.label}
        </span>
      </div>
    </div>
  );
}
