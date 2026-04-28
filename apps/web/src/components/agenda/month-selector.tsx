const MONTHS = ["Jan", "Fev", "Mar", "Avr", "Mai", "Juin", "Juill", "Aout", "Sep", "Oct", "Nov", "Dec"];

interface MonthSelectorProps {
  selectedMonth: number;
  onSelectMonth: (month: number) => void;
}

export function MonthSelector({ selectedMonth, onSelectMonth }: MonthSelectorProps) {
  return (
    <div className="grid w-full grid-cols-6 items-center gap-2 overflow-visible xl:grid-cols-12">
      {MONTHS.map((monthLabel, index) => (
        <button
          key={monthLabel}
          type="button"
          onClick={() => onSelectMonth(index)}
          aria-pressed={selectedMonth === index}
          className={`min-h-[2.25rem] min-w-0 rounded-full border px-2.5 text-center font-['Poppins','Inter',sans-serif] text-[0.875rem] font-semibold transition-all duration-150 active:scale-[0.98] ${
            selectedMonth === index
              ? "border-[#052CA0] bg-[#052CA0] text-white hover:bg-[#0b3bc2]"
              : "border-[#c2e0ef] bg-white text-[#052CA0] hover:-translate-y-0.5 hover:border-[#76bbdd] hover:bg-[rgba(194,224,239,0.32)] hover:shadow-[0_0.35rem_0.85rem_rgba(194,224,239,0.5)]"
          }`}
        >
          {monthLabel}
        </button>
      ))}
    </div>
  );
}
