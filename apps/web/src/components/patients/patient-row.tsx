import { Droplet, Eye, SquarePen } from "lucide-react";

import type { PatientViewModel } from "./patient-types";
import styles from "./patients-page.module.css";

interface PatientRowProps {
  patient: PatientViewModel;
  onViewPatient: (patientId: string) => void;
  onEditPatient: (patientId: string) => void;
}

export function PatientRow({ patient, onViewPatient, onEditPatient }: PatientRowProps) {
  return (
    <li className={styles.row}>
      <div className={styles.patientCell}>
        <span className={styles.avatar} aria-hidden="true">
          {patient.initials}
        </span>
        <div className={styles.patientCellText}>
          <p className={styles.patientName}>{patient.fullName}</p>
          <p className={styles.patientMeta}>#{patient.matricule}</p>
        </div>
      </div>

      <div>
        <p className={styles.primaryText}>{patient.ageText}</p>
        <p className={styles.secondaryText}>{patient.sexeText}</p>
      </div>

      <div>
        <p className={styles.primaryText}>{patient.phoneText}</p>
        <p className={styles.secondaryText}>{patient.emailText}</p>
      </div>

      <p className={styles.conditionsText}>{patient.conditionsText}</p>

      <div className={styles.bloodGroupBadge}>
        <Droplet size={11} className={styles.bloodDroplet} aria-hidden="true" />
        <span>{patient.bloodGroupText}</span>
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          aria-label="Voir le patient"
          className={styles.rowActionButton}
          onClick={() => onViewPatient(patient.id)}
        >
          <Eye size={13} strokeWidth={2} aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Modifier le patient"
          className={styles.rowActionButton}
          onClick={() => onEditPatient(patient.id)}
        >
          <SquarePen size={13} strokeWidth={2} aria-hidden="true" />
        </button>
      </div>
    </li>
  );
}
