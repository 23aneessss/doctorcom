import styles from "./patients-page.module.css";

export function PatientTableHeader() {
  return (
    <div className={styles.tableHeader} role="row">
      <span>Patient</span>
      <span>Age / Sexe</span>
      <span>Contacts</span>
      <span>Conditions</span>
      <span>Groupe sanguin</span>
      <span className="text-right" aria-hidden="true">Actions</span>
    </div>
  );
}
