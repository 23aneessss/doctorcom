// apps/web/src/components/agenda/upcoming-list.tsx
import type { UpcomingItem, AgendaSlotStatus, AgendaTone } from "./types";

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
        initials: "bg-[#D0F1E7] text-[#009689]",
        status: "bg-[#D0F1E7] text-[#009689]",
      };
    case "blue":
      return {
        initials: "bg-[#C2E0EF] text-[#1447E6]",
        status: "bg-[#C2E0EF] text-[#1447E6]",
      };
    case "orange":
      return {
        initials: "bg-[#FFF9F4] text-[#F97316]",
        status: "bg-[#FFF9F4] text-[#F97316]",
      };
    case "red":
      return {
        initials: "bg-[#FF878B] text-[#CA3500]",
        status: "bg-[#FF878B] text-[#CA3500]",
      };
    case "slate":
      return {
        initials: "bg-[#eff3f6] text-[#4B5563]",
        status: "bg-[rgba(75,85,99,0.1)] text-[#4B5563]",
      };
    default:
      return {
        initials: "bg-[#eff3f6] text-[#1447E6]",
        status: "bg-[rgba(20,71,230,0.1)] text-[#1447E6]",
      };
  }
};

interface UpcomingListProps {
  items: UpcomingItem[];
}

export function UpcomingList({ items }: UpcomingListProps) {
  if (!items || items.length === 0) {
    return (
      <div className="mt-4 flex min-h-24 items-center justify-center rounded-[16px] border border-dashed border-[rgba(15,52,96,0.18)] bg-[rgba(194,224,239,0.14)] p-4 text-center font-['Inter',sans-serif] text-sm font-medium leading-5 text-[#395271]">
        Aucun rendez-vous à venir.
      </div>
    );
  }

  return (
    <div className="mt-4 flex flex-col gap-2.5">
      {items.map((item: UpcomingItem) => {
        const status = STATUS_META[item.status];
        const styles = getToneStyles(status.tone);

        return (
          <article
            key={item.id}
            className="rounded-[16px] border border-[rgba(194,224,239,0.65)] bg-[linear-gradient(135deg,_rgba(255,255,255,0.98),_rgba(248,250,252,0.92))] p-3.5 shadow-[0_1px_3px_rgba(15,52,96,0.05)] transition-all duration-150 hover:-translate-y-0.5 hover:border-[#76bbdd] hover:shadow-[0_0.45rem_1rem_rgba(194,224,239,0.36)]"
          >
            <div className="flex items-start gap-3">
              <span
                className={`inline-flex size-10 shrink-0 items-center justify-center rounded-full font-['Inter',sans-serif] text-[0.8125rem] font-bold leading-5 ring-1 ring-white ${styles.initials}`}
              >
                {item.patientInitials}
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="m-0 truncate font-['Inter',sans-serif] text-[0.9rem] font-semibold leading-5 text-[#1f2937]">
                    {item.patientName}
                  </p>
                  <span className="shrink-0 rounded-full bg-[rgba(0,150,137,0.08)] px-2.5 py-1 font-['Inter',sans-serif] text-[0.65rem] font-semibold leading-3 text-[#00786f]">
                    {item.relativeLabel}
                  </span>
                </div>

                <p className="m-0 mt-0.5 truncate font-['Inter',sans-serif] text-[0.72rem] font-medium leading-4 text-[#64748b]">
                  {item.type}
                </p>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between gap-2 border-t border-[rgba(194,224,239,0.5)] pt-2.5">
              <span className="font-['Inter',sans-serif] text-[0.76rem] font-semibold leading-4 text-[#0f3460]">
                {item.time}
              </span>
              <span
                className={`inline-flex min-h-5 items-center justify-center rounded-full px-2.5 py-0.5 font-['Inter',sans-serif] text-[0.625rem] font-semibold leading-[0.875rem] capitalize ${styles.status}`}
              >
                {status.label}
              </span>
            </div>
          </article>
        );
      })}
    </div>
  );
}
