import { MagnifyingGlass } from "@phosphor-icons/react";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function SearchBar({ value, onChange, placeholder = "Recherche ..." }: SearchBarProps) {
  return (
    <div className="relative w-full min-w-0">
      <MagnifyingGlass
        size={18}
        weight="regular"
        className="absolute left-3 top-1/2 -translate-y-1/2 text-[color-mix(in_srgb,_#0f3460_65%,_white)]"
      />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Recherche agenda"
        className="w-full min-h-[2.55rem] border border-[#c2e0ef] rounded-[0.7rem] bg-white text-[#0f3460] pl-8 pr-3 py-2 text-[0.86rem] outline-none transition-all duration-150 placeholder:text-[color-mix(in_srgb,_#0f3460_65%,_white)] hover:border-[#76bbdd] focus:border-[#76bbdd] focus:shadow-[inset_0_0_0_1px_#76bbdd] focus:bg-[color-mix(in_srgb,_white_94%,_#c2e0ef)]"
        placeholder={placeholder}
      />
    </div>
  );
}
