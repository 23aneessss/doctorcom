
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
          className="inline-flex min-h-[3.75rem] min-w-[13.9rem] shrink-0 items-center justify-center gap-3 self-center rounded-[0.9375rem] border-0 bg-[#c2e0ef] px-5 py-[0.72rem] text-[1.02rem] font-bold tracking-[-0.01em] text-[#0f3460] whitespace-nowrap transition-all duration-150 hover:bg-[color-mix(in_srgb,_#c2e0ef_88%,_white_12%)] hover:shadow-[0_0.35rem_0.8rem_rgba(15,52,96,0.14)] md:self-center cursor-pointer"
          onClick={onAddRdv}
        >
          <img src={plusIcon} alt="" aria-hidden="true" className="w-[1.55rem] h-[1.55rem] block flex-shrink-0" />
          <span className="block leading-[1.15]">Ajouter un RDV</span>
        </button>
      </div>
    </section>
  );
}
