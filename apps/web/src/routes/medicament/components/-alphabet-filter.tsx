import { MEDICATIONS_ALPHABET_ROWS } from "./-page-data";

export function AlphabetFilter() {
  return (
    <div className="flex w-[1091px] max-w-full flex-col gap-[10px]">
      {MEDICATIONS_ALPHABET_ROWS.map((row, rowIndex) => (
        <div key={rowIndex} className="flex flex-wrap gap-[7px]">
          {row.map((letter) => {
            const isActive = letter === "B";

            return (
              <button
                key={letter}
                type="button"
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
