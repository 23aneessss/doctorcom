import styles from "./patients-page.module.css";

export function PatientTableHeader() {
  return (
    <div className={styles.tableHeader} role="row">
      <span>Patient</span>
      <span>Age/sexe</span>
      <span>Contacts</span>
      <span>Conditions</span>
      <span>Groupe sanguin</span>
      <span aria-hidden="true" />
    </div>
  );
}
