import { Plus } from "lucide-react";

import {
  MEDICATIONS_PAGE_COLORS,
  MEDICATIONS_PAGE_TEXT,
} from "./-page-data";

const headerPattern = encodeURIComponent(`
<svg width="1178" height="120" viewBox="0 0 1178 120" fill="none" xmlns="http://www.w3.org/2000/svg">
  <g opacity="0.45" stroke="#9FC9DE" stroke-width="1.2">
    <path d="M-40 58C49 15 121 23 194 49C267 75 344 94 427 67C514 39 586 11 663 29C740 47 807 94 901 80C995 66 1094 18 1221 39"/>
    <path d="M-50 70C28 32 104 35 179 59C254 83 336 101 423 79C510 56 586 24 663 42C740 60 810 101 902 90C994 79 1088 33 1220 54"/>
    <path d="M-42 82C31 47 102 48 176 69C250 90 334 108 421 90C508 72 587 43 664 58C741 73 814 108 904 100C994 92 1085 49 1218 68"/>
    <path d="M-31 96C39 64 106 61 177 80C248 98 333 115 422 103C511 91 593 62 671 72C749 82 819 111 905 108C991 105 1083 68 1210 83"/>
    <path d="M-10 109C48 82 111 78 180 93C249 108 332 122 422 116C512 109 597 84 677 89C757 94 826 116 907 116C988 116 1078 89 1197 98"/>
    <path d="M-20 36C41 8 101 11 165 30C229 49 308 65 391 48C474 31 549 4 623 14C697 24 764 66 856 60C948 54 1042 15 1168 31"/>
    <path d="M-3 21C58 -3 116 0 177 16C238 32 311 48 390 34C469 20 543 -1 615 5C687 11 755 49 848 46C941 43 1035 6 1158 18"/>
    <path d="M95 -15C144 16 148 45 130 73C112 101 116 126 170 150"/>
    <path d="M145 -21C195 15 199 49 178 78C157 107 163 132 215 157"/>
    <path d="M100 11C156 40 165 66 147 92C129 118 137 145 190 168"/>
    <path d="M102 39C159 61 171 87 153 112C135 137 145 161 197 183"/>
    <path d="M870 -18C929 11 944 43 925 72C906 101 916 132 970 156"/>
    <path d="M917 -26C977 5 989 38 972 67C955 96 965 128 1018 152"/>
    <path d="M868 15C928 40 944 71 928 99C912 127 922 156 975 178"/>
    <path d="M914 11C974 39 988 73 972 101C956 129 965 158 1017 182"/>
  </g>
</svg>
`);

export function TopographicHeader() {
  return (
    <section
      className="relative h-[120px] w-[1091px] max-w-full overflow-hidden rounded-[18px] border border-[#D2EAF6] bg-white shadow-[0px_6px_22px_rgba(118,187,221,0.28)]"
      style={{
        backgroundColor: "#F6FBFE",
      }}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          backgroundImage: `url("data:image/svg+xml,${headerPattern}")`,
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          backgroundSize: "cover",
          opacity: 0.9,
        }}
      />

      <div className="relative flex h-full items-center justify-between px-[25px] py-[25px]">
        <div className="flex flex-col gap-[2px]">
          <h1 className="font-['Inter'] text-[28px] font-semibold leading-[1.05] text-[#0F3460]">
            {MEDICATIONS_PAGE_TEXT.title}
          </h1>
          <p className="font-['Inter'] text-[16px] font-medium leading-[1.2] text-[#0F3460]">
            {MEDICATIONS_PAGE_TEXT.subtitle}
          </p>
        </div>

        <button
          type="button"
          className="flex h-[69px] w-[292px] items-center justify-center gap-[18px] rounded-[14px] border border-[#C7E0EE] bg-[#C7E0EE] px-[22px] text-left shadow-[0px_4px_12px_rgba(15,52,96,0.08)]"
        >
          <Plus
            className="size-[24px] shrink-0"
            color={MEDICATIONS_PAGE_COLORS.darkBlue}
            strokeWidth={3.2}
          />
          <span className="font-['Plus_Jakarta_Sans'] text-[20px] font-semibold leading-[1.05] text-[#0F3460]">
            Ajouter un
            <br />
            médicament
          </span>
        </button>
      </div>
    </section>
  );
}
