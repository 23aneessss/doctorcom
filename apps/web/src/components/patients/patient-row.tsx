import conditionIcon from "@/assets/icons/Icon.svg";
import { Droplet, Eye, Mail, Phone, SquarePen } from "lucide-react";

import type { PatientViewModel, PatientsViewMode } from "./patient-types";
import styles from "./patients-page.module.css";

interface PatientRowProps {
  patient: PatientViewModel;
  viewMode: PatientsViewMode;
  onViewPatient: (patientId: string) => void;
  onEditPatient: (patientId: string) => void;
}

export function PatientRow({ patient, viewMode, onViewPatient, onEditPatient }: PatientRowProps) {
  if (viewMode === "horizontal") {
    const phoneText = patient.phoneText?.trim() || "Non renseigne";
    const emailText = patient.emailText?.trim() || "Non renseigne";
    const conditionsText = patient.conditionsText?.trim() || "Aucune condition";

    return (
      <li className={styles.card}>
        <div className={styles.cardIdentity}>
          <div className={styles.patientCell}>
            <span className={styles.avatar} aria-hidden="true">
              {patient.initials}
            </span>
            <div>
              <p className={styles.patientName}>{patient.fullName}</p>
              <p className={styles.patientMeta}>ID: {patient.matricule}</p>
            </div>
          </div>
        </div>

        <div className={styles.cardBadges}>
          <span className={styles.cardBadge}>{patient.ageText}</span>
          <span className={styles.cardBadge}>{patient.sexeText}</span>
          <span className={styles.cardBadgeBlood}>
            <Droplet size={12} aria-hidden="true" />
            <span>{patient.bloodGroupText}</span>
          </span>
        </div>

        <div className={styles.cardDetails}>
          <p className={styles.cardDetailLine}>
            <Phone size={14} aria-hidden="true" />
            <span>{phoneText}</span>
          </p>
          <p className={styles.cardDetailLine}>
            <Mail size={14} aria-hidden="true" />
            <span>{emailText}</span>
          </p>
          <p className={styles.cardDetailLine}>
            <img src={conditionIcon} alt="" aria-hidden="true" className={styles.cardDetailIcon} />
            <span>{conditionsText}</span>
          </p>
        </div>

        <div className={`${styles.actions} ${styles.cardActions}`}>
          <button type="button" className={styles.actionButton} onClick={() => onViewPatient(patient.id)}>
            <Eye size={16} aria-hidden="true" />
            <span>Voir</span>
          </button>
          <button type="button" className={styles.actionButton} onClick={() => onEditPatient(patient.id)}>
            <SquarePen size={16} aria-hidden="true" />
            <span>Modifier</span>
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className={styles.row}>
      <div className={styles.patientCell}>
        <span className={styles.avatar} aria-hidden="true">
          {patient.initials}
        </span>
        <div>
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

      <p className={styles.mutedText}>{patient.conditionsText}</p>
      <p className={styles.primaryText}>{patient.bloodGroupText}</p>

      <div className={styles.actions}>
        <button type="button" className={styles.actionButton} onClick={() => onViewPatient(patient.id)}>
          <Eye size={16} aria-hidden="true" />
          <span>Voir</span>
        </button>
        <button type="button" className={styles.actionButton} onClick={() => onEditPatient(patient.id)}>
          <SquarePen size={16} aria-hidden="true" />
          <span>Modifier</span>
        </button>
      </div>
    </li>
  );
}
