
interface DayMarkerProps {
  day: number;
  weekday: string;
}

export function DayMarker({ day, weekday }: DayMarkerProps) {
  return (
    <div className="pt-2 text-left">
      <p className="m-0 font-['Inter',sans-serif] text-[1.75rem] leading-none font-bold text-[#101828]">
        {day}
      </p>
      <p className="mt-1 font-['Inter',sans-serif] text-[0.75rem] leading-none font-medium text-[#6a7282] uppercase">
        {weekday}
      </p>
    </div>
  );
}