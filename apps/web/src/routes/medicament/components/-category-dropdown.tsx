import { ChevronDown } from "lucide-react";

import { MEDICATIONS_CATEGORIES } from "./-page-data";

export function CategoryDropdown() {
  return (
    <div className="relative w-[352px] shrink-0">
      <button
        type="button"
        className="flex h-[50px] w-full items-center justify-between rounded-[12px] border border-[#C2E0EF] bg-white px-[18px] shadow-[0px_2px_6px_rgba(118,187,221,0.08)]"
      >
        <span className="font-['Inter'] text-[14px] font-medium text-[#0F3460]">
          Toutes les catégories
        </span>
        <ChevronDown className="size-[18px] text-[#0F3460]" strokeWidth={2.25} />
      </button>

      <div className="absolute right-[31px] top-[61px] z-10 w-[290px] overflow-hidden border border-[#BFC5C9] bg-white shadow-[0px_10px_24px_rgba(15,52,96,0.12)]">
        {MEDICATIONS_CATEGORIES.map((category, index) => {
          const isHovered = category === "Antibiotique";
          return (
            <div
              key={category}
              className="flex h-[27px] items-center px-[16px]"
              style={{
                backgroundColor: isHovered ? "#7D8287" : "#FFFFFF",
              }}
            >
              <span
                className="font-['Inter'] text-[14px] leading-none"
                style={{
                  color: isHovered ? "#FFFFFF" : "#4A5565",
                  fontWeight: index === 0 ? 500 : 400,
                }}
              >
                {category}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
