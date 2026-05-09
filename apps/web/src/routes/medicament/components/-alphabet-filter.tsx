import { MEDICATIONS_ALPHABET_ROWS } from "./-page-data";

export function AlphabetFilter({
  selectedLetter,
  onSelect,
}: {
  selectedLetter: string;
  onSelect: (letter: string) => void;
}) {
  return (
    <div className="scrollbar-hide flex w-full max-w-full flex-col gap-[10px] overflow-x-auto overflow-y-hidden overscroll-x-contain pb-1">
      {MEDICATIONS_ALPHABET_ROWS.map((row, rowIndex) => (
        <div
          key={rowIndex}
          className="grid w-max gap-[7px]"
          style={{
            gridTemplateColumns: `repeat(${row.length}, 43px)`,
          }}
        >
          {row.map((letter) => {
            const isActive = letter === selectedLetter;

            return (
              <button
                key={letter}
                type="button"
                onClick={() => onSelect(letter)}
                className="flex h-[37px] w-[43px] items-center justify-center rounded-full border text-center font-['Inter'] text-[15px] font-medium leading-none shadow-[0px_1px_2px_rgba(15,52,96,0.05)]"
                style={{
                  backgroundColor: isActive ? "#0F3460" : "#FFFFFF",
                  borderColor: isActive ? "#0F3460" : "#C2E0EF",
                  color: isActive ? "#FFFFFF" : "#0F3460",
                }}
              >
                {letter}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
