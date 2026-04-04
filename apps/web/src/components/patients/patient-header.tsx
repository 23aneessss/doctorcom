import plusIcon from "@/assets/icons/+.svg";
import headerTexture from "@/assets/figma/patients/fc145d0d9403ead31e8bc198dd8335751de59305.svg";
import type { CSSProperties } from "react";

import styles from "./patients-page.module.css";

interface PatientHeaderProps {
  onAddPatient: () => void;
}

export function PatientHeader({ onAddPatient }: PatientHeaderProps) {
  const heroStyle = {
    "--patients-hero-texture": `url(${headerTexture})`,
  } as CSSProperties;

  return (
    <section className={styles.hero} style={heroStyle} aria-labelledby="patients-page-title">
      <div className={styles.heroInner}>
        <div className={styles.heroText}>
          <h1 className={styles.heroTitle} id="patients-page-title">
            Gestion des patients
          </h1>
          <p className={styles.heroSubtitle}>
            Gerez et consultez toutes les informations de vos patients
          </p>
        </div>

        <button type="button" className={styles.addButton} onClick={onAddPatient}>
          <img src={plusIcon} alt="" aria-hidden="true" className={styles.addButtonIcon} />
          <span className={styles.addButtonLabel}>Ajouter un patient</span>
        </button>
      </div>
    </section>
  );
}
