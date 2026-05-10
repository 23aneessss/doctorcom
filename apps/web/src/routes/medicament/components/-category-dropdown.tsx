import { useEffect, useRef, useState } from "react";

import { ChevronDown } from "lucide-react";

export function CategoryDropdown({
  categories,
  selectedCategory,
  onSelect,
}: {
  categories: string[];
  selectedCategory: string;
  onSelect: (category: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  return (
    <div ref={containerRef} className="relative w-[352px] shrink-0">
      <button
        type="button"
        className="flex h-[50px] w-full items-center justify-between rounded-[12px] border border-[#C2E0EF] bg-white px-[18px] shadow-[0px_2px_6px_rgba(118,187,221,0.08)]"
        onClick={() => setIsOpen((current) => !current)}
      >
        <span className="font-['Inter'] text-[14px] font-medium text-[#0F3460]">
          {selectedCategory}
        </span>
        <ChevronDown
          className={`size-[18px] text-[#0F3460] transition-transform duration-150 ${
            isOpen ? "rotate-180" : "rotate-0"
          }`}
          strokeWidth={2.25}
        />
      </button>

      {isOpen ? (
        <div
          className="absolute right-0 top-[61px] z-10 max-h-[280px] w-[290px] overflow-y-auto overscroll-contain border border-[#9FA4A8] bg-white shadow-[0px_10px_24px_rgba(15,52,96,0.12)]"
          onWheel={(event) => event.stopPropagation()}
        >
          {categories.map((category, index) => {
            const isHighlighted =
              hoveredCategory === category ||
              (selectedCategory === category && category !== categories[0]);

            return (
              <button
                key={category}
                type="button"
                className="flex h-[40px] w-full items-center px-[16px] text-left transition-colors"
                onClick={() => {
                  onSelect(category);
                  setIsOpen(false);
                }}
                onMouseEnter={() => setHoveredCategory(category)}
                onMouseLeave={() => setHoveredCategory(null)}
                style={{
                  backgroundColor: isHighlighted ? "#7D8287" : "#FFFFFF",
                }}
              >
                <span
                  className="font-['Plus_Jakarta_Sans'] text-[16px] leading-none"
                  style={{
                    color: isHighlighted ? "#FFFFFF" : "#0F3460",
                    fontWeight: index === 0 ? 500 : 400,
                  }}
                >
                  {category}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
