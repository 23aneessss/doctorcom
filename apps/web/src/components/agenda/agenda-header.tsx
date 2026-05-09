
import plusIcon from "@/assets/icons/+.svg";
import headerTexture from "@/assets/figma/patients/fc145d0d9403ead31e8bc198dd8335751de59305.svg";
import type { CSSProperties } from "react";
import styles from "../patients/patients-page.module.css";
interface AgendaHeaderProps {
  onAddRdv: () => void;
}

export function AgendaHeader({ onAddRdv }: AgendaHeaderProps) {
  const heroStyle = {
    "--agenda-hero-texture": `url(${headerTexture})`,
  } as CSSProperties;

  return (
    <section
      className="relative h-[clamp(7.15rem,_12.8vh,_8.4rem)] overflow-hidden rounded-[0.9375rem] border border-[color-mix(in_srgb,_#c2e0ef_68%,_white)] bg-gradient-to-r from-[color-mix(in_srgb,_#c2e0ef_87%,_white_13%)] to-white px-[clamp(1rem,_2vw,_1.5rem)] py-[clamp(0.65rem,_1.35vh,_1rem)] shadow-[0_0.25rem_1.25rem_rgba(118,187,221,0.5)]"
      style={heroStyle}
      aria-labelledby="agenda-page-title"
    >
      {/* Texture overlay */}
      <div className="pointer-events-none absolute inset-[-205%_-9%_-70%_-5%] bg-[image:var(--agenda-hero-texture)] bg-cover bg-center bg-no-repeat opacity-20" />

      <div className="relative z-10 flex h-full flex-col items-start justify-center gap-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <h1
            id="agenda-page-title"
            className="m-0 text-[#0f3460] text-[clamp(1.28rem,_2.12vw,_1.78rem)] leading-[1.1] font-bold"
          >
            Agenda
          </h1>
          <p className={styles.heroSubtitle} style={{ marginTop: "0.52rem" }}>
            Consultez votre agenda, planifiez de nouveaux rendez-vous et accédez aux RDV à venir, quel que soit le jour.
          </p>
        </div>

        <button
          type="button"
          className="inline-flex h-[2.625rem] min-w-[13.5rem] shrink-0 cursor-pointer items-center justify-center gap-[0.65rem] whitespace-nowrap rounded-[0.875rem] border-0 bg-[#052ca0] px-6 text-[1rem] font-semibold tracking-[-0.01em] text-white shadow-[0px_4px_12px_rgba(5,44,160,0.38)] transition-[background-color,box-shadow,transform] duration-[180ms] ease-[ease] hover:-translate-y-px hover:bg-[#0a3ac7] hover:shadow-[0px_8px_20px_rgba(5,44,160,0.44)]"
          onClick={onAddRdv}
        >
          <img src={plusIcon} alt="" aria-hidden="true" className="block h-[1.25rem] w-[1.25rem] shrink-0 brightness-0 invert" />
          <span className="block leading-[1.15]">Ajouter un RDV</span>
        </button>
      </div>
    </section>
  );
}
