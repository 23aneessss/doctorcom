import { PatientRow } from "./patient-row";
import type { PatientViewModel, PatientsViewMode } from "./patient-types";
import styles from "./patients-page.module.css";

interface PatientListProps {
  patients: PatientViewModel[];
  viewMode: PatientsViewMode;
  onViewPatient: (patientId: string) => void;
  onEditPatient: (patientId: string) => void;
}

export function PatientList({
  patients,
  viewMode,
  onViewPatient,
  onEditPatient,
}: PatientListProps) {
  return (
    <ul className={viewMode === "vertical" ? styles.listVertical : styles.listHorizontal}>
      {patients.map((patient) => (
        <PatientRow
          key={patient.id}
          patient={patient}
          viewMode={viewMode}
          onViewPatient={onViewPatient}
          onEditPatient={onEditPatient}
        />
      ))}
    </ul>
  );
}
