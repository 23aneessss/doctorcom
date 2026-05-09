import type { CSSProperties } from "react";
import plusIcon from "@/assets/icons/+.svg";
import headerTexture from "@/assets/figma/patients/fc145d0d9403ead31e8bc198dd8335751de59305.svg";
import patientsStyles from "@/components/patients/patients-page.module.css";
import { MEDICATIONS_PAGE_TEXT } from "./-page-data";

export function TopographicHeader({
  subtitle,
  onAdd,
}: {
  subtitle: string;
  onAdd: () => void;
}) {
  return (
    <section
      className={patientsStyles.hero}
      style={{ "--patients-hero-texture": `url(${headerTexture})` } as CSSProperties}
    >
      <div className={patientsStyles.heroInner}>
        <div className={patientsStyles.heroText}>
          <h1 className={patientsStyles.heroTitle}>
            {MEDICATIONS_PAGE_TEXT.title}
          </h1>
          <p className={patientsStyles.heroSubtitle}>{subtitle}</p>
        </div>

        <button
          type="button"
          onClick={onAdd}
          className={patientsStyles.addButton}
        >
          <img
            src={plusIcon}
            alt=""
            aria-hidden="true"
            className={patientsStyles.addButtonIcon}
          />
          <span className={patientsStyles.addButtonLabel}>
            Ajouter un médicament
          </span>
        </button>
      </div>
    </section>
  );
}
