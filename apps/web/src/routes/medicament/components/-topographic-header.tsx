import type { CSSProperties } from "react";

import plusIcon from "@/assets/icons/+.svg";
import headerTexture from "@/assets/figma/patients/fc145d0d9403ead31e8bc198dd8335751de59305.svg";

import { MEDICATIONS_PAGE_TEXT } from "./-page-data";

export function TopographicHeader({
  subtitle,
  onAdd,
}: {
  subtitle: string;
  onAdd: () => void;
}) {
  const heroTextureStyle = {
    backgroundImage: `url(${headerTexture})`,
  } as CSSProperties;

  return (
    <section
      className="relative min-h-[clamp(7.15rem,12.8vh,8.4rem)] w-full overflow-hidden rounded-[15px] border bg-white px-[clamp(1rem,2.8vw,2.6rem)] py-[clamp(0.75rem,1.35vh,1rem)]"
      style={{
        borderColor: "color-mix(in srgb, #c2e0ef 68%, white)",
        background:
          "linear-gradient(97.5deg, color-mix(in srgb, #c2e0ef 87%, white 13%) 0%, #ffffff 99.9%)",
        boxShadow: "0 0.25rem 1.25rem rgba(118, 187, 221, 0.5)",
      }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-[-70%] left-[-5%] right-[-9%] top-[-205%] opacity-20"
        style={heroTextureStyle}
      />

      <div className="relative z-[1] flex min-h-[inherit] flex-col items-start justify-center gap-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <h1 className="m-0 font-['Inter'] text-[clamp(1.28rem,2.12vw,1.78rem)] font-bold leading-[1.1] text-[#0F3460]">
            {MEDICATIONS_PAGE_TEXT.title}
          </h1>
          <p className="mt-[0.35rem] font-['Inter'] text-[clamp(0.88rem,1.22vw,1.06rem)] font-semibold leading-[1.2] text-[#052CA0]">
            {subtitle}
          </p>
        </div>

        <button
          type="button"
          onClick={onAdd}
          className="inline-flex min-h-[52px] w-full items-center justify-center gap-[13px] rounded-[15px] border-0 bg-[#C2E0EF] px-[23px] py-[12px] text-[#0F3460] transition-[background-color,box-shadow] duration-150 sm:w-auto sm:min-w-[222px] sm:min-h-[60px]"
          style={{
            boxShadow: "none",
          }}
        >
          <img
            src={plusIcon}
            alt=""
            aria-hidden="true"
            className="block h-[24px] w-[24px] shrink-0"
          />
          <span className="block font-['Plus_Jakarta_Sans'] text-[16px] font-bold leading-[1.15]">
            Ajouter un
            <br />
            médicament
          </span>
        </button>
      </div>
    </section>
  );
}
