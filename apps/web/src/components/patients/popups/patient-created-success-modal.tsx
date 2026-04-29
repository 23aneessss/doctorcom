import { Check } from "lucide-react";

import styles from "./patient-created-success-modal.module.css";

interface PatientCreatedSuccessModalProps {
  open: boolean;
  patientName?: string;
  onClose: () => void;
  title?: string;
  description?: string;
}

export function PatientCreatedSuccessModal({
  open,
  patientName,
  onClose,
  title = "Patient cree avec succes!",
  description,
}: PatientCreatedSuccessModalProps) {
  if (!open) {
    return null;
  }

  const displayName = patientName?.trim() || "ce patient";
  const defaultDescription = `Le dossier patient de ${displayName} a ete cree et enregistre dans le systeme.`;
  const finalDescription = description || defaultDescription;

  return (
    <div
      className={styles.backdrop}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="patient-created-title"
      >
        <div className={styles.iconWrap} aria-hidden="true">
          <span className={styles.iconInner}>
            <Check size={28} strokeWidth={3} />
          </span>
        </div>

        <h2 id="patient-created-title" className={styles.title}>
          {title}
        </h2>

        <p className={styles.description}>
          {finalDescription}
        </p>

        <button type="button" className={styles.finishButton} onClick={onClose}>
          Terminer
        </button>
      </section>
    </div>
  );
}
