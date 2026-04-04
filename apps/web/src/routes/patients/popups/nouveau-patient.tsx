import { Check, ChevronRight, Info, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import styles from "./nouveau-patient.module.css";

interface NouveauPatientDialogProps {
  open: boolean;
  onClose: () => void;
  isSubmitting?: boolean;
  submitError?: string | null;
  onContinue?: (values: NouveauPatientFormValues) => void;
  onAddNow?: (values: NouveauPatientFormValues) => void | Promise<void>;
}

export interface NouveauPatientFormValues {
  nom: string;
  prenom: string;
  profession: string;
  sexe: string;
  lieuNaissance: string;
  dateNaissance: string;
  nss: string;
  nationalite: string;
  telephone: string;
  email: string;
  situationFamiliale: string;
  adresseComplete: string;
}

const initialValues: NouveauPatientFormValues = {
  nom: "",
  prenom: "",
  profession: "",
  sexe: "",
  lieuNaissance: "",
  dateNaissance: "",
  nss: "",
  nationalite: "",
  telephone: "",
  email: "",
  situationFamiliale: "",
  adresseComplete: "",
};

const requiredFields: Array<keyof NouveauPatientFormValues> = [
  "nom",
  "prenom",
  "sexe",
  "lieuNaissance",
  "dateNaissance",
  "nss",
  "telephone",
  "email",
  "situationFamiliale",
];

const stepLabels = [
  "Informations essentielles",
  "Antecedents",
  "Traitements",
  "Informations sociales",
] as const;

export function NouveauPatientDialog({
  open,
  onClose,
  isSubmitting = false,
  submitError = null,
  onContinue,
  onAddNow,
}: NouveauPatientDialogProps) {
  const [values, setValues] = useState<NouveauPatientFormValues>(initialValues);
  const [showValidation, setShowValidation] = useState(false);

  const isFormValid = useMemo(() => {
    return requiredFields.every((field) => values[field].trim().length > 0);
  }, [values]);

  useEffect(() => {
    if (!open) {
      setValues(initialValues);
      setShowValidation(false);
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  const updateField = (field: keyof NouveauPatientFormValues, value: string) => {
    setValues((currentValues) => ({
      ...currentValues,
      [field]: value,
    }));
  };

  const handleContinue = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!isFormValid) {
      setShowValidation(true);
      return;
    }

    onContinue?.(values);
  };

  const handleAddNow = async () => {
    if (!isFormValid) {
      setShowValidation(true);
      return;
    }

    await onAddNow?.(values);
  };

  return (
    <div className={styles.backdrop} onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="nouveau-patient-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className={styles.header}>
          <div className={styles.headerTextBlock}>
            <h2 className={styles.title} id="nouveau-patient-title">
              Nouveau patient
            </h2>
            <p className={styles.subtitle}>Etape 1 sur 4</p>
          </div>

          <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Fermer">
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div className={styles.stepRail}>
          {stepLabels.map((label, index) => (
            <div className={styles.stepItem} key={label}>
              <div className={`${styles.stepDot} ${index === 0 ? styles.stepDotActive : ""}`}>{index + 1}</div>
              <p className={`${styles.stepLabel} ${index === 0 ? styles.stepLabelActive : ""}`}>{label}</p>
              {index < stepLabels.length - 1 ? <span className={styles.stepConnector} aria-hidden="true" /> : null}
            </div>
          ))}
        </div>

        <form className={styles.form} onSubmit={handleContinue}>
          <div className={styles.noticeBox}>
            <Info size={16} aria-hidden="true" />
            <p>
              <strong>Informations essentielles</strong> - Ces champs sont obligatoires pour creer le dossier patient.
            </p>
          </div>

          {showValidation && !isFormValid ? (
            <p className={styles.validationHint}>
              Veuillez renseigner tous les champs obligatoires avant de continuer.
            </p>
          ) : null}

          {submitError ? <p className={styles.submitError}>{submitError}</p> : null}

          <div className={styles.formGrid}>
            <Field label="Nom" required>
              <input
                className={styles.input}
                type="text"
                value={values.nom}
                onChange={(event) => updateField("nom", event.currentTarget.value)}
                placeholder="Ex: Amara"
              />
            </Field>

            <Field label="Prenom" required>
              <input
                className={styles.input}
                type="text"
                value={values.prenom}
                onChange={(event) => updateField("prenom", event.currentTarget.value)}
                placeholder="Walid"
              />
            </Field>

            <Field label="Profession">
              <input
                className={styles.input}
                type="text"
                value={values.profession}
                onChange={(event) => updateField("profession", event.currentTarget.value)}
                placeholder="Ex: Ingenieur, Etudiant, Retraite..."
              />
            </Field>

            <Field label="Sexe" required>
              <select
                className={styles.input}
                value={values.sexe}
                onChange={(event) => updateField("sexe", event.currentTarget.value)}
              >
                <option value="">Selectionner</option>
                <option value="Homme">Homme</option>
                <option value="Femme">Femme</option>
                <option value="Autre">Autre</option>
              </select>
            </Field>

            <Field label="Lieu de naissance" required>
              <input
                className={styles.input}
                type="text"
                value={values.lieuNaissance}
                onChange={(event) => updateField("lieuNaissance", event.currentTarget.value)}
                placeholder="Ex: Alger, Oran, Constantine..."
              />
            </Field>

            <Field label="Date de naissance" required>
              <input
                className={styles.input}
                type="text"
                value={values.dateNaissance}
                onChange={(event) => updateField("dateNaissance", event.currentTarget.value)}
                placeholder="JJ/MM/AAAA"
              />
            </Field>

            <Field label="NSS (Numero securite sociale)" required>
              <input
                className={styles.input}
                type="text"
                value={values.nss}
                onChange={(event) => updateField("nss", event.currentTarget.value)}
                placeholder="Ex: 198505231234"
              />
            </Field>

            <Field label="Nationalite">
              <input
                className={styles.input}
                type="text"
                value={values.nationalite}
                onChange={(event) => updateField("nationalite", event.currentTarget.value)}
                placeholder="Algerienne"
              />
            </Field>

            <Field label="Telephone" required>
              <input
                className={styles.input}
                type="tel"
                value={values.telephone}
                onChange={(event) => updateField("telephone", event.currentTarget.value)}
                placeholder="Ex: (213) 555-1234"
              />
            </Field>

            <Field label="Email" required>
              <input
                className={styles.input}
                type="email"
                value={values.email}
                onChange={(event) => updateField("email", event.currentTarget.value)}
                placeholder="Ex: Walid.Amara@email.com"
              />
            </Field>

            <Field label="Situation familiale" required>
              <input
                className={styles.input}
                type="text"
                value={values.situationFamiliale}
                onChange={(event) => updateField("situationFamiliale", event.currentTarget.value)}
                placeholder="Ex: Marie(e), Celibataire, Divorce(e)..."
              />
            </Field>

            <Field label="Adresse complete">
              <input
                className={styles.input}
                type="text"
                value={values.adresseComplete}
                onChange={(event) => updateField("adresseComplete", event.currentTarget.value)}
                placeholder="Ex: 123 Rue de la Republique, Alger 16000"
              />
            </Field>
          </div>

          <footer className={styles.footer}>
            <button type="button" className={styles.cancelButton} onClick={onClose}>
              <X size={16} aria-hidden="true" />
              Annuler
            </button>

            <div className={styles.footerActionsRight}>
              <button
                type="button"
                className={styles.addNowButton}
                onClick={handleAddNow}
                disabled={!isFormValid || isSubmitting}
              >
                <Check size={16} aria-hidden="true" />
                {isSubmitting ? "Ajout en cours..." : "Ajouter maintenant"}
              </button>

              <button type="submit" className={styles.continueButton} disabled={isSubmitting || !isFormValid}>
                Continuer
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            </div>
          </footer>
        </form>
      </section>
    </div>
  );
}

interface FieldProps {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}

function Field({ label, required, children }: FieldProps) {
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>
        {label}
        {required ? <span className={styles.requiredMark}> *</span> : null}
      </span>
      {children}
    </label>
  );
}