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
      className="relative h-[clamp(7.15rem,12.8vh,8.4rem)] w-full overflow-hidden rounded-[15px] border bg-white px-[clamp(1.35rem,2.8vw,2.6rem)] py-[clamp(0.75rem,1.35vh,1rem)]"
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

      <div className="relative z-[1] flex h-full items-center justify-between gap-4">
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
          className="inline-flex h-[2.625rem] min-w-[13.5rem] shrink-0 cursor-pointer items-center justify-center gap-[0.65rem] whitespace-nowrap rounded-[0.875rem] border-0 bg-[#052ca0] px-6 text-[1rem] font-semibold tracking-[-0.01em] text-white shadow-[0px_4px_12px_rgba(5,44,160,0.38)] transition-[background-color,box-shadow,transform] duration-[180ms] ease-[ease] hover:-translate-y-px hover:bg-[#0a3ac7] hover:shadow-[0px_8px_20px_rgba(5,44,160,0.44)]"
        >
          <img
            src={plusIcon}
            alt=""
            aria-hidden="true"
            className="block h-[1.25rem] w-[1.25rem] shrink-0 brightness-0 invert"
          />
          <span className="block font-['Plus_Jakarta_Sans'] text-[1rem] font-semibold leading-[1.15]">
            Ajouter un médicament
          </span>
        </button>
      </div>
    </section>
  );
}
