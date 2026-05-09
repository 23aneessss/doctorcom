// apps/web/src/components/agenda/timeline-section.tsx
import type { GroupedEvent, AgendaEvent } from "./types";
import { DayMarker } from "./day-marker";
import { AppointmentCard } from "./appointment-card";
import { AgendaTimelineSkeleton } from "@/components/page-skeletons";
import { useEffect } from "react";

interface TimelineSectionProps {
  groupedEvents: GroupedEvent[];
  isLoading: boolean;
  selectedDate?: string;
  onAppointmentClick: (appointment: AgendaEvent) => void;
}

export function TimelineSection({
  groupedEvents,
  isLoading,
  selectedDate,
  onAppointmentClick,
}: TimelineSectionProps) {
  useEffect(() => {
    if (isLoading || !selectedDate) {
      return;
    }

    document
      .getElementById(`agenda-day-${selectedDate}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [isLoading, selectedDate]);

  if (isLoading) {
    return <AgendaTimelineSkeleton />;
  }

  if (!groupedEvents || groupedEvents.length === 0) {
    return (
      <div className="min-h-24 border border-dashed border-[rgba(15,52,96,0.2)] rounded-xl bg-white/60 text-[#395271] font-['Inter',sans-serif] text-sm leading-5 font-medium flex items-center justify-center text-center p-3">
        Aucun rendez-vous pour cette période.
      </div>
    );
  }

  return (
    <section className="flex min-w-0 flex-col gap-7">
      {groupedEvents.map((group) => (
        <article
          key={group.date}
          id={`agenda-day-${group.date}`}
          className={`scroll-mt-5 grid grid-cols-[3.2rem_minmax(0,1fr)] items-start gap-2.5 rounded-[16px] transition-colors duration-200 ${
            group.date === selectedDate ? "bg-white/55 p-2 -m-2" : ""
          }`}
        >
          <DayMarker day={group.day} weekday={group.weekday} />
          <div className="grid grid-cols-1 items-stretch gap-y-4 lg:grid-cols-2 lg:gap-x-4 2xl:grid-cols-3">
            {group.events.length > 0 ? (
              group.events.map((event: AgendaEvent) => (
                <AppointmentCard key={event.id} appointment={event} onClick={onAppointmentClick} />
              ))
            ) : (
              <div className="flex min-h-[4rem] items-center rounded-[14px] border border-dashed border-[rgba(15,52,96,0.18)] bg-white/55 px-4 font-['Inter',sans-serif] text-[0.86rem] font-medium text-[#6b819d] lg:col-span-2 2xl:col-span-3">
                Aucun rendez-vous ce jour.
              </div>
            )}
          </div>
        </article>
      ))}
    </section>
  );
}
