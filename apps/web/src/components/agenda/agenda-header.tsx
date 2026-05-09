import plusIcon from "@/assets/icons/+.svg";
import headerTexture from "@/assets/figma/patients/fc145d0d9403ead31e8bc198dd8335751de59305.svg";
import type { CSSProperties } from "react";
import patientsStyles from "@/components/patients/patients-page.module.css";

interface AgendaHeaderProps {
  onAddRdv: () => void;
}

export function AgendaHeader({ onAddRdv }: AgendaHeaderProps) {
  return (
    <section
      className={patientsStyles.hero}
      style={{ "--patients-hero-texture": `url(${headerTexture})` } as CSSProperties}
      aria-labelledby="agenda-page-title"
    >
      <div className={patientsStyles.heroInner}>
        <div className={patientsStyles.heroText}>
          <h1 id="agenda-page-title" className={patientsStyles.heroTitle}>
            Agenda
          </h1>
          <p className={patientsStyles.heroSubtitle}>
            Planifiez et gérez vos rendez-vous, consultez vos disponibilités en un coup d&apos;œil.
          </p>
        </div>

        <button
          type="button"
          className={patientsStyles.addButton}
          onClick={onAddRdv}
        >
          <img src={plusIcon} alt="" aria-hidden="true" className={patientsStyles.addButtonIcon} />
          <span className={patientsStyles.addButtonLabel}>Ajouter un RDV</span>
        </button>
      </div>
    </section>
  );
}
