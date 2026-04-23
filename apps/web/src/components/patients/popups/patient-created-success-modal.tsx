import { Check } from "lucide-react";

import styles from "./patient-created-success-modal.module.css";

interface PatientCreatedSuccessModalProps {
  open: boolean;
  patientName?: string;
  onClose: () => void;
}

export function PatientCreatedSuccessModal({
  open,
  patientName,
  onClose,
}: PatientCreatedSuccessModalProps) {
  if (!open) {
    return null;
  }

  const displayName = patientName?.trim() || "ce patient";

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
          Patient cree avec succes!
        </h2>

        <p className={styles.description}>
          Le dossier patient de {displayName} a ete cree et enregistre dans le systeme.
        </p>

        <button type="button" className={styles.finishButton} onClick={onClose}>
          Terminer
        </button>
      </section>
    </div>
  );
}
