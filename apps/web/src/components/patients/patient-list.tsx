import { PatientRow } from "./patient-row";
import type { PatientViewModel } from "./patient-types";
import styles from "./patients-page.module.css";

interface PatientListProps {
  patients: PatientViewModel[];
  onViewPatient: (patientId: string) => void;
  onEditPatient: (patientId: string) => void;
}

export function PatientList({ patients, onViewPatient, onEditPatient }: PatientListProps) {
  return (
    <ul className={styles.listVertical}>
      {patients.map((patient) => (
        <PatientRow
          key={patient.id}
          patient={patient}
          onViewPatient={onViewPatient}
          onEditPatient={onEditPatient}
        />
      ))}
    </ul>
  );
}
