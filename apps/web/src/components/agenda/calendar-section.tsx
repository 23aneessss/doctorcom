import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import { useMemo } from "react";

const WEEKDAYS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

interface CalendarSectionProps {
  selectedMonth: number;
  selectedYear: number;
  onSelectMonth: (month: number) => void;
  onSelectYear: (year: number) => void;
  onSelectDate: (day: number) => void;
  selectedDay: number;
}

export function CalendarSection({
  selectedMonth,
  selectedYear,
  onSelectMonth,
  onSelectYear,
  onSelectDate,
  selectedDay,
}: CalendarSectionProps) {

  const calendarTitle = useMemo(() => {
    const label = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(
        new Date(selectedYear, selectedMonth, 1)
      );
    return label.charAt(0).toUpperCase() + label.slice(1);
  }, [selectedMonth, selectedYear]);

  const calendarCells = useMemo(() => {
    const firstWeekDay = new Date(selectedYear, selectedMonth, 1).getDay();
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const cells: Array<number | null> = [];
    for (let i = 0; i < firstWeekDay; i++) cells.push(null);
    for (let day = 1; day <= daysInMonth; day++) cells.push(day);
    return cells;
  }, [selectedMonth, selectedYear]);

  return (
    <section className="rounded-xl border border-[rgba(194,224,239,0.5)] bg-white p-[0.8125rem_0.9rem_0.75rem] shadow-[0px_4px_24px_rgba(194,224,239,0.5)]">
      <div className="grid grid-cols-[1.726rem_1fr_1.726rem] gap-2 items-center">
        <button
          type="button"
          className="w-[1.726rem] h-[1.726rem] border-0 rounded-[0.625rem] bg-black/10 text-[#0a0a0a] inline-flex items-center justify-center cursor-pointer transition-all hover:bg-black/20"
          onClick={() => {
            if (selectedMonth === 0) {
              onSelectMonth(11);
              onSelectYear(selectedYear - 1);
            } else {
              onSelectMonth(selectedMonth - 1);
            }
          }}
        >
          <CaretLeft size={15} weight="bold" />
        </button>
        <p className="m-0 text-center font-['Inter',sans-serif] text-[0.875rem] leading-[1.2] font-semibold text-[#101828] capitalize">
          {calendarTitle}
        </p>
        <button
          type="button"
          className="w-[1.726rem] h-[1.726rem] border-0 rounded-[0.625rem] bg-black/10 text-[#0a0a0a] inline-flex items-center justify-center cursor-pointer transition-all hover:bg-black/20"
          onClick={() => {
            if (selectedMonth === 11) {
              onSelectMonth(0);
              onSelectYear(selectedYear + 1);
            } else {
              onSelectMonth(selectedMonth + 1);
            }
          }}
        >
          <CaretRight size={15} weight="bold" />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-x-2">
        {WEEKDAYS.map((weekday) => (
          <span key={weekday} className="font-['Inter',sans-serif] text-[0.6875rem] leading-4 font-medium text-[#6a7282] text-center">
            {weekday}
          </span>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-7 gap-x-2 gap-y-1.5">
        {calendarCells.map((cellDay, index) => {
          if (cellDay === null) {
            return <span key={`empty-${index}`} className="h-[1.72rem] w-full" />;
          }
          const isSelected = cellDay === selectedDay;
          return (
            <button
              key={cellDay}
              type="button"
              onClick={() => onSelectDate(cellDay)}
              className={`h-[1.72rem] w-full rounded-[0.625rem] border-0 font-['Inter',sans-serif] text-[0.875rem] font-semibold leading-5 cursor-pointer transition-all duration-150 ${
                isSelected
                  ? "bg-[#052ca0] text-white"
                  : "bg-[rgba(194,224,239,0.4)] text-[#0a0a0a] hover:bg-[rgba(5,44,160,0.2)] hover:scale-105"
              }`}
            >
              {cellDay}
            </button>
          );
        })}
      </div>
    </section>
  );
}
