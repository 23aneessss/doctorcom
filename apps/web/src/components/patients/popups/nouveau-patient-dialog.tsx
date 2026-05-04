import { Check, ChevronDown, ChevronLeft, ChevronRight, Info, Plus, Trash2, UserPlus, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { z } from "zod";

import styles from "@/routes/patients/popups/nouveau-patient.module.css";

interface NouveauPatientDialogProps {
  open: boolean;
  onClose: () => void;
  isSubmitting?: boolean;
  submitError?: string | null;
  onContinue?: (values: NouveauPatientSubmissionValues) => void | Promise<void>;
  onAddNow?: (values: NouveauPatientSubmissionValues) => void | Promise<void>;
  initialValues?: Partial<NouveauPatientFormValues>;
  dialogTitle?: string;
  mode?: "create" | "edit";
  initialData?: unknown;
  isLoading?: boolean;
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

interface PersonalAntecedentValues {
  id: string;
  type: string;
  details: string;
  maladieActive: boolean;
}

interface FamilyAntecedentValues {
  id: string;
  lienParente: string;
  pathologie: string;
}

interface TreatmentValues {
  id: string;
  medicament: string;
  dosage: string;
  indication: string;
  posologie: string;
  maladieActive: boolean;
}

export interface NouveauPatientSubmissionValues extends NouveauPatientFormValues {
  groupeSanguin: string;
  ageCirconcision: string;
  revenuMensuel: string;
  assure: boolean;
  tailleMenages: number;
  nombreDePieces: number;
  socialProfession: string;
  socialSituationFamiliale: string;
  nombreEnfants: number;
  habitudesSaines: string;
  habitudesToxiques: string;
  environnementAnimal: string;
  relationsEnvironnementales: string;
  personalAntecedents: Array<Omit<PersonalAntecedentValues, "id">>;
  familyAntecedents: Array<Omit<FamilyAntecedentValues, "id">>;
  traitements: Array<Omit<TreatmentValues, "id">>;
  menarche?: number;
  regulariteCycles?: string;
  contraception?: string;
  nbGrossesses?: number;
  nbCesariennes?: number;
  menopause?: boolean;
  ageMenopause?: number;
  symptomes_menopause?: string;
  symptomesMenopause?: string;
}

const ALLOW_STEP_PREVIEW_NAVIGATION = false;

const SAMPLE_FORM_VALUES: NouveauPatientFormValues = {
  nom: "Benali",
  prenom: "Ahmed",
  profession: "Ingenieur en Informatique",
  sexe: "Homme",
  lieuNaissance: "Alger",
  dateNaissance: "15/04/1985",
  nss: "123456789012",
  nationalite: "Algerienne",
  telephone: "0555123456",
  email: "ahmed.benali@example.com",
  situationFamiliale: "Marie(e)",
  adresseComplete: "Cite 1000 logts, Batiment A, Alger",
};

const EMPTY_FORM_VALUES: NouveauPatientFormValues = {
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

const normalizeFormValues = (values?: Partial<NouveauPatientFormValues>): NouveauPatientFormValues => ({
  ...EMPTY_FORM_VALUES,
  ...values,
});

const requiredFields: Array<keyof NouveauPatientFormValues> = ["nom", "prenom", "sexe", "lieuNaissance", "dateNaissance", "telephone"];

const step1Fields = [
  "nom",
  "prenom",
  "profession",
  "sexe",
  "lieuNaissance",
  "dateNaissance",
  "nss",
  "nationalite",
  "telephone",
  "email",
  "situationFamiliale",
  "adresseComplete",
] as const;

const nameRegex = /^[a-zA-ZÀ-ÿ\s\-]+$/;
const phoneRegex = /^\d{10}$/;
const nssRegex = /^\d{15}$/;
const dateRegex = /^\d{2}\/\d{2}\/\d{4}$/;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const step1Schema = z.object({
  nom: z.string().trim().min(2, "Le nom doit contenir au moins 2 caractères").regex(nameRegex, "Le nom ne doit contenir que des lettres"),
  prenom: z.string().trim().min(2, "Le prénom doit contenir au moins 2 caractères").regex(nameRegex, "Le prénom ne doit contenir que des lettres"),
  profession: z.string().trim().optional().or(z.literal("")).refine((value) => !value || nameRegex.test(value), { message: "La profession ne doit contenir que des lettres" }),
  sexe: z.enum(["Masculin", "Féminin"]),
  lieuNaissance: z.string().trim().min(2, "Le lieu de naissance doit contenir au moins 2 caractères").regex(/^[a-zA-ZÀ-ÿ\s\-]+$/, "Le lieu de naissance ne doit contenir que des lettres, des espaces et des tirets"),
  dateNaissance: z.string().trim().refine((value) => {
    if (!dateRegex.test(value)) return false;
    const [day, month, year] = value.split("/").map(Number);
    const parsed = new Date(year, month - 1, day);
    if (Number.isNaN(parsed.getTime())) return false;
    if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) return false;
    const today = new Date();
    let age = today.getFullYear() - parsed.getFullYear();
    const monthDiff = today.getMonth() - parsed.getMonth();
    const dayDiff = today.getDate() - parsed.getDate();
    if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) age -= 1;
    return age >= 0 && age <= 120;
  }, "La date de naissance n'est pas valide"),
  nss: z.string().trim().regex(nssRegex, { message: "Le NSS doit contenir exactement 15 chiffres" }),
  nationalite: z.string().trim().optional().or(z.literal("")).refine((value) => !value || /^[a-zA-ZÀ-ÿ\s]+$/.test(value), { message: "La nationalité ne doit contenir que des lettres et des espaces" }),
  telephone: z.string().trim().regex(phoneRegex, "Le numéro de téléphone doit contenir exactement 10 chiffres"),
  email: z.string().trim().optional().or(z.literal("")).refine((value) => !value || emailRegex.test(value), { message: "L'email n'est pas valide" }),
  situationFamiliale: z.string().trim(),
  adresseComplete: z.string().trim().max(255, "L'adresse ne doit pas dépasser 255 caractères").optional().or(z.literal("")),
});

const createId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const initialPersonalAntecedent = (): PersonalAntecedentValues => ({ id: createId(), type: "", details: "", maladieActive: false });
const initialFamilyAntecedent = (): FamilyAntecedentValues => ({ id: createId(), lienParente: "", pathologie: "" });
const initialTreatment = (): TreatmentValues => ({ id: createId(), medicament: "", dosage: "", indication: "", posologie: "", maladieActive: true });

export function NouveauPatientDialog({
  open,
  onClose,
  isSubmitting = false,
  submitError = null,
  onContinue,
  onAddNow,
  initialValues,
  dialogTitle,
  mode = "create",
}: NouveauPatientDialogProps) {
  const initialFormFromProps = initialValues ?? undefined;
  const [values, setValues] = useState<NouveauPatientFormValues>(
    normalizeFormValues(initialFormFromProps ?? (mode === "edit" ? SAMPLE_FORM_VALUES : EMPTY_FORM_VALUES)),
  );
  const [showValidation, setShowValidation] = useState(false);
  const [touchedFields, setTouchedFields] = useState<Set<keyof NouveauPatientFormValues>>(new Set());
  const [step1Errors, setStep1Errors] = useState<Partial<Record<keyof NouveauPatientFormValues, string>>>({});
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [groupeSanguin, setGroupeSanguin] = useState("O+");
  const [ageCirconcision, setAgeCirconcision] = useState("13 ans");
  const [revenuMensuel, setRevenuMensuel] = useState("150000 DA");
  const [assure, setAssure] = useState(true);
  const [tailleMenages, setTailleMenages] = useState(4);
  const [nombreDePieces, setNombreDePieces] = useState(4);
  const [socialProfession, setSocialProfession] = useState("Ingenieur en Informatique");
  const [socialSituationFamiliale, setSocialSituationFamiliale] = useState("Marie(e)");
  const [nombreEnfants, setNombreEnfants] = useState(2);
  const [habitudesSaines, setHabitudesSaines] = useState("Course a pied 3x/semaine, alimentation equilibree");
  const [habitudesToxiques, setHabitudesToxiques] = useState("Cafe (3 tasses/jour)");
  const [environnementAnimal, setEnvironnementAnimal] = useState("Un chat domestique");
  const [relationsEnvironnementales, setRelationsEnvironnementales] = useState("Relations stables, bon support familial");
  const [personalAntecedents, setPersonalAntecedents] = useState<PersonalAntecedentValues[]>([
    { id: createId(), type: "Diabete de Type 2", details: "Diagnostique en 2020, sous controle", maladieActive: true },
  ]);
  const [familyAntecedents, setFamilyAntecedents] = useState<FamilyAntecedentValues[]>([
    { id: createId(), lienParente: "Pere", pathologie: "Hypertension Arterielle" },
  ]);
  const [treatments, setTreatments] = useState<TreatmentValues[]>([
    { id: createId(), medicament: "Glucophage 500mg", dosage: "500mg", indication: "Diabete", posologie: "1 comprime au diner", maladieActive: true },
  ]);
  const [menarche, setMenarche] = useState<string>("12");
  const [regulariteCycles, setRegulariteCycles] = useState("Reguliers");
  const [contraception, setContraception] = useState("Aucune");
  const [nbGrossesses, setNbGrossesses] = useState(0);
  const [nbCesariennes, setNbCesariennes] = useState(0);
  const [menopause, setMenopause] = useState(false);
  const [ageMenopause, setAgeMenopause] = useState("");
  const [symptomesMenopause, setSymptomesMenopause] = useState("");

  const isMalePatient = useMemo(() => {
    const normalized = (values.sexe ?? "").trim().toLowerCase();
    return normalized === "homme" || normalized === "male" || normalized === "m" || normalized === "masculin";
  }, [values.sexe]);

  const isFemalePatient = useMemo(() => {
    const normalized = (values.sexe ?? "").trim().toLowerCase();
    return normalized === "femme" || normalized === "female" || normalized === "f" || normalized === "féminin";
  }, [values.sexe]);

  const stepLabels = isFemalePatient
    ? (["Informations essentielles", "Antécédents", "Traitements", "Santé féminine", "Informations sociales"] as const)
    : (["Informations essentielles", "Antécédents", "Traitements", "Informations sociales"] as const);
  const maxStep = isFemalePatient ? 5 : 4;

  const isFormValid = useMemo(() => requiredFields.every((field) => (values[field] ?? "").trim().length > 0), [values]);
  const isStepTwoValid = useMemo(() => {
    const hasValidPersonalAntecedents = personalAntecedents.every((entry) => (entry.type ?? "").trim().length > 0 && (entry.details ?? "").trim().length > 0);
    const hasValidFamilyAntecedents = familyAntecedents.every((entry) => (entry.lienParente ?? "").trim().length > 0 && (entry.pathologie ?? "").trim().length > 0);
    return hasValidPersonalAntecedents && hasValidFamilyAntecedents;
  }, [personalAntecedents, familyAntecedents]);

  useEffect(() => {
    if (!open) {
      if (mode === "edit") {
        setValues(normalizeFormValues(initialFormFromProps ?? SAMPLE_FORM_VALUES));
        setGroupeSanguin("O+");
        setAgeCirconcision("13 ans");
        setRevenuMensuel("150000 DA");
        setAssure(true);
        setTailleMenages(4);
        setNombreDePieces(4);
        setSocialProfession("Ingenieur en Informatique");
        setSocialSituationFamiliale("Marie(e)");
        setNombreEnfants(2);
        setHabitudesSaines("Course a pied 3x/semaine, alimentation equilibree");
        setHabitudesToxiques("Cafe (3 tasses/jour)");
        setEnvironnementAnimal("Un chat domestique");
        setRelationsEnvironnementales("Relations stables, bon support familial");
        setPersonalAntecedents([{ id: createId(), type: "Diabete de Type 2", details: "Diagnostique en 2020, sous controle", maladieActive: true }]);
        setFamilyAntecedents([{ id: createId(), lienParente: "Pere", pathologie: "Hypertension Arterielle" }]);
        setTreatments([{ id: createId(), medicament: "Glucophage 500mg", dosage: "500mg", indication: "Diabete", posologie: "1 comprime au diner", maladieActive: true }]);
        setMenarche("12");
        setRegulariteCycles("Reguliers");
        setContraception("Aucune");
        setNbGrossesses(0);
        setNbCesariennes(0);
        setMenopause(false);
        setAgeMenopause("");
        setSymptomesMenopause("");
      } else {
        setValues(normalizeFormValues(initialFormFromProps ?? EMPTY_FORM_VALUES));
        setGroupeSanguin("");
        setAgeCirconcision("");
        setRevenuMensuel("");
        setAssure(false);
        setTailleMenages(0);
        setNombreDePieces(0);
        setSocialProfession("");
        setSocialSituationFamiliale("");
        setNombreEnfants(0);
        setHabitudesSaines("");
        setHabitudesToxiques("");
        setEnvironnementAnimal("");
        setRelationsEnvironnementales("");
        setPersonalAntecedents([initialPersonalAntecedent()]);
        setFamilyAntecedents([initialFamilyAntecedent()]);
        setTreatments([initialTreatment()]);
        setMenarche("");
        setRegulariteCycles("");
        setContraception("");
        setNbGrossesses(0);
        setNbCesariennes(0);
        setMenopause(false);
        setAgeMenopause("");
        setSymptomesMenopause("");
      }

      setShowValidation(false);
      setTouchedFields(new Set());
      setStep1Errors({});
      setCurrentStep(1);
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open, mode, initialFormFromProps]);

  const progressPercent = ((currentStep - 1) / Math.max(1, maxStep - 1)) * 100;

  if (!open) {
    return null;
  }

  const buildSubmissionValues = (): NouveauPatientSubmissionValues => ({
    ...values,
    groupeSanguin,
    ageCirconcision,
    revenuMensuel,
    assure,
    tailleMenages,
    nombreDePieces,
    socialProfession,
    socialSituationFamiliale,
    nombreEnfants,
    habitudesSaines,
    habitudesToxiques,
    environnementAnimal,
    relationsEnvironnementales,
    personalAntecedents: personalAntecedents.map(({ id, ...entry }) => entry),
    familyAntecedents: familyAntecedents.map(({ id, ...entry }) => entry),
    traitements: treatments.map(({ id, ...entry }) => entry),
    menarche: menarche ? parseInt(menarche) : undefined,
    regulariteCycles,
    contraception,
    nbGrossesses,
    nbCesariennes,
    menopause,
    ageMenopause: ageMenopause ? parseInt(ageMenopause) : undefined,
    symptomesMenopause,
  });

  const validateStep1 = () => {
    const parsed = step1Schema.safeParse({
      nom: values.nom,
      prenom: values.prenom,
      profession: values.profession,
      sexe: values.sexe === "Homme" ? "Masculin" : values.sexe === "Femme" ? "Féminin" : values.sexe,
      lieuNaissance: values.lieuNaissance,
      dateNaissance: values.dateNaissance,
      nss: values.nss,
      nationalite: values.nationalite,
      telephone: values.telephone,
      email: values.email,
      situationFamiliale: values.situationFamiliale,
      adresseComplete: values.adresseComplete,
    });

    if (parsed.success) {
      setStep1Errors({});
      return true;
    }

    const nextErrors: Partial<Record<keyof NouveauPatientFormValues, string>> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (key === "nom" || key === "prenom" || key === "profession" || key === "sexe" || key === "lieuNaissance" || key === "dateNaissance" || key === "nss" || key === "nationalite" || key === "telephone" || key === "email" || key === "situationFamiliale") {
        nextErrors[key] = issue.message;
      }
      if (key === "adresseComplete") {
        nextErrors.adresseComplete = issue.message;
      }
    }
    setStep1Errors(nextErrors);
    return false;
  };

  const handleContinue = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (currentStep === 1) {
      setTouchedFields(new Set(step1Fields));
      if (!validateStep1()) {
        return;
      }
    }

    if (!ALLOW_STEP_PREVIEW_NAVIGATION && currentStep === 2 && !isStepTwoValid) {
      setShowValidation(true);
      return;
    }

    setShowValidation(false);

    if (currentStep < maxStep) {
      setCurrentStep((prev) => Math.min(maxStep, prev + 1) as 1 | 2 | 3 | 4 | 5);
      return;
    }

    await onContinue?.(buildSubmissionValues());
  };

  const handleAddNow = async () => {
    if (currentStep === 1 && !validateStep1()) {
      setTouchedFields(new Set(step1Fields));
      return;
    }

    if (!ALLOW_STEP_PREVIEW_NAVIGATION && (!isFormValid || (currentStep >= 2 && !isStepTwoValid))) {
      setShowValidation(true);
      return;
    }

    await onAddNow?.(buildSubmissionValues());
  };

  const updateField = (field: keyof NouveauPatientFormValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setTouchedFields((current) => new Set(current).add(field));
  };

  const markFieldTouched = (field: keyof NouveauPatientFormValues) => {
    setTouchedFields((current) => new Set(current).add(field));
  };

  const adjustCounter = (setter: React.Dispatch<React.SetStateAction<number>>, delta: number) => {
    setter((current) => Math.max(0, current + delta));
  };

  const updatePersonalAntecedent = (id: string, patch: Partial<PersonalAntecedentValues>) => {
    setPersonalAntecedents((current) => current.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)));
  };

  const updateFamilyAntecedent = (id: string, patch: Partial<FamilyAntecedentValues>) => {
    setFamilyAntecedents((current) => current.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)));
  };

  const removePersonalAntecedent = (id: string) => {
    setPersonalAntecedents((current) => (current.length === 1 ? [{ ...current[0], type: "", details: "", maladieActive: false }] : current.filter((entry) => entry.id !== id)));
  };

  const removeFamilyAntecedent = (id: string) => {
    setFamilyAntecedents((current) => (current.length === 1 ? [{ ...current[0], lienParente: "", pathologie: "" }] : current.filter((entry) => entry.id !== id)));
  };

  const updateTreatment = (id: string, patch: Partial<TreatmentValues>) => {
    setTreatments((current) => current.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)));
  };

  const removeTreatment = (id: string) => {
    setTreatments((current) => (current.length === 1 ? [{ ...current[0], medicament: "", dosage: "", indication: "", posologie: "", maladieActive: true }] : current.filter((entry) => entry.id !== id)));
  };

  const getError = (field: keyof NouveauPatientFormValues, fallback: string) => step1Errors[field] ?? (touchedFields.has(field) && !values[field].trim() ? fallback : undefined);

  return (
    <div className={styles.backdrop} onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="nouveau-patient-title">
        <header className={styles.header}>
          <div className={styles.headerIdentity}>
            <span className={styles.headerIcon} aria-hidden="true">
              <UserPlus size={20} strokeWidth={2} />
            </span>
            <div className={styles.headerTextBlock}>
              <h2 className={styles.title} id="nouveau-patient-title">{dialogTitle ?? "Nouveau patient"}</h2>
              <p className={styles.subtitle}>{`Étape ${currentStep} sur ${stepLabels.length} · ${stepLabels[currentStep - 1]}`}</p>
            </div>
          </div>
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Fermer">
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div className={styles.progressBarTrack}>
          <span className={styles.progressBarFill} style={{ width: `${progressPercent}%` }} />
        </div>

        <div className={styles.stepRail}>
          {stepLabels.map((label, index) => {
            const isDone = index < currentStep - 1;
            const isActive = index === currentStep - 1;
            return (
              <div className={`${styles.stepItem} ${index === stepLabels.length - 1 ? styles.stepItemLast : ""}`} key={label}>
                <div className={styles.stepContent}>
                  <div className={`${styles.stepDot} ${isDone ? styles.stepDotDone : ""} ${isActive ? styles.stepDotActive : ""}`}>
                    {isDone ? <Check size={13} aria-hidden="true" /> : index + 1}
                  </div>
                  <p className={`${styles.stepLabel} ${isActive ? styles.stepLabelActive : ""}`}>{label}</p>
                </div>
                {index < stepLabels.length - 1 ? <span className={`${styles.stepConnector} ${isDone ? styles.stepConnectorActive : ""}`} /> : null}
              </div>
            );
          })}
        </div>

        <form className={styles.form} onSubmit={handleContinue}>
          {submitError ? <p className={styles.submitError}>{submitError}</p> : null}

          {currentStep === 1 ? (
            <>
              <div className={styles.noticeBox}><Info size={15} aria-hidden="true" /><p><strong>Informations essentielles</strong> — Ces champs sont obligatoires pour créer le dossier patient.</p></div>
              {showValidation && !isFormValid ? <p className={styles.validationHint}>Veuillez renseigner tous les champs obligatoires.</p> : null}
              <div className={styles.formGrid}>
                <Field label="Nom" required error={getError("nom", "Le nom est obligatoire")}>
                  <input className={styles.input} style={getError("nom", "Le nom est obligatoire") ? { borderColor: "#ef4444" } : {}} value={values.nom} onChange={(e) => updateField("nom", e.currentTarget.value)} onBlur={() => markFieldTouched("nom")} placeholder="Nom de famille" />
                </Field>
                <Field label="Prénom" required error={getError("prenom", "Le prénom est obligatoire")}>
                  <input className={styles.input} style={getError("prenom", "Le prénom est obligatoire") ? { borderColor: "#ef4444" } : {}} value={values.prenom} onChange={(e) => updateField("prenom", e.currentTarget.value)} onBlur={() => markFieldTouched("prenom")} placeholder="Prénom" />
                </Field>
                <Field label="Profession" error={step1Errors.profession}>
                  <input className={styles.input} style={step1Errors.profession ? { borderColor: "#ef4444" } : {}} value={values.profession} onChange={(e) => updateField("profession", e.currentTarget.value)} onBlur={() => markFieldTouched("profession")} placeholder="Ex : Ingénieur, Médecin…" />
                </Field>
                <Field label="Sexe" required error={getError("sexe", "Le sexe est obligatoire")}>
                  <select className={styles.input} style={getError("sexe", "Le sexe est obligatoire") ? { borderColor: "#ef4444" } : {}} value={values.sexe} onChange={(e) => updateField("sexe", e.currentTarget.value)} onBlur={() => markFieldTouched("sexe")}>
                    <option value="">Sélectionner</option>
                    <option value="Masculin">Masculin</option>
                    <option value="Féminin">Féminin</option>
                  </select>
                </Field>
                <Field label="Lieu de naissance" required error={getError("lieuNaissance", "Le lieu de naissance est obligatoire")}>
                  <input className={styles.input} style={getError("lieuNaissance", "Le lieu de naissance est obligatoire") ? { borderColor: "#ef4444" } : {}} value={values.lieuNaissance} onChange={(e) => updateField("lieuNaissance", e.currentTarget.value)} onBlur={() => markFieldTouched("lieuNaissance")} placeholder="Ex : Alger, Oran…" />
                </Field>
                <Field label="Date de naissance" required error={getError("dateNaissance", "La date de naissance est obligatoire")}>
                  <input className={styles.input} style={getError("dateNaissance", "La date de naissance est obligatoire") ? { borderColor: "#ef4444" } : {}} value={values.dateNaissance} onChange={(e) => updateField("dateNaissance", e.currentTarget.value)} onBlur={() => markFieldTouched("dateNaissance")} placeholder="JJ/MM/AAAA" />
                </Field>
                <Field label="NSS" required error={step1Errors.nss}><input className={styles.input} style={step1Errors.nss ? { borderColor: "#ef4444" } : {}} value={values.nss} onChange={(e) => updateField("nss", e.currentTarget.value)} onBlur={() => markFieldTouched("nss")} placeholder="15 chiffres" /></Field>
                <Field label="Nationalité" error={step1Errors.nationalite}><input className={styles.input} style={step1Errors.nationalite ? { borderColor: "#ef4444" } : {}} value={values.nationalite} onChange={(e) => updateField("nationalite", e.currentTarget.value)} onBlur={() => markFieldTouched("nationalite")} placeholder="Ex : Algérienne" /></Field>
                <Field label="Téléphone" required error={getError("telephone", "Le téléphone est obligatoire")}>
                  <input className={styles.input} style={getError("telephone", "Le téléphone est obligatoire") ? { borderColor: "#ef4444" } : {}} value={values.telephone} onChange={(e) => updateField("telephone", e.currentTarget.value)} onBlur={() => markFieldTouched("telephone")} placeholder="0X XX XX XX XX" />
                </Field>
                <Field label="Email" error={step1Errors.email}><input className={styles.input} style={step1Errors.email ? { borderColor: "#ef4444" } : {}} value={values.email} onChange={(e) => updateField("email", e.currentTarget.value)} onBlur={() => markFieldTouched("email")} placeholder="exemple@email.com" /></Field>
                <Field label="Situation familiale" error={step1Errors.situationFamiliale}>
                  <select className={styles.input} style={step1Errors.situationFamiliale ? { borderColor: "#ef4444" } : {}} value={values.situationFamiliale} onChange={(e) => updateField("situationFamiliale", e.currentTarget.value)} onBlur={() => markFieldTouched("situationFamiliale")}>
                    <option value="">Sélectionner</option>
                    <option value="Célibataire">Célibataire</option>
                    <option value="Marié(e)">Marié(e)</option>
                    <option value="Divorcé(e)">Divorcé(e)</option>
                    <option value="Veuf(ve)">Veuf(ve)</option>
                  </select>
                </Field>
                <Field label="Adresse complète" error={step1Errors.adresseComplete}><input className={styles.input} style={step1Errors.adresseComplete ? { borderColor: "#ef4444" } : {}} value={values.adresseComplete} onChange={(e) => updateField("adresseComplete", e.currentTarget.value)} onBlur={() => markFieldTouched("adresseComplete")} placeholder="Rue, cité, wilaya…" /></Field>
              </div>
            </>
          ) : null}

          {currentStep === 2 ? (
            <div className={styles.stepTwoContent}>
              <div className={styles.noticeBox}><Info size={16} aria-hidden="true" /><p><strong>Informations médicales</strong> — Ces informations aideront au suivi médical du patient.</p></div>
              {showValidation && !isStepTwoValid ? <p className={styles.validationHint}>Veuillez renseigner les champs obligatoires de cette étape avant de continuer.</p> : null}
              <div className={`${styles.stepTwoMedicalGrid} ${isFemalePatient ? styles.stepTwoMedicalGridSingle : ""}`}>
                <Field label="Groupe sanguin"><input className={styles.input} value={groupeSanguin} onChange={(e) => setGroupeSanguin(e.currentTarget.value)} placeholder="Ex: A+, O-, B+..." /></Field>
                <Field label="Age de circoncision">
                  <div className={styles.selectWrap}>
                    <select className={styles.input} value={ageCirconcision} onChange={(e) => setAgeCirconcision(e.currentTarget.value)}>
                      <option value="13 ans">13 ans</option>
                      <option value="14 ans">14 ans</option>
                      <option value="15 ans">15 ans</option>
                    </select>
                    <ChevronDown size={16} className={styles.selectIcon} aria-hidden="true" />
                  </div>
                </Field>
              </div>

              <section className={styles.sectionBlock}>
                <h3 className={styles.sectionTitle}>ANTÉCÉDENTS PERSONNELS</h3>
                {personalAntecedents.map((antecedent) => (
                  <div className={styles.antecedentCard} key={antecedent.id}>
                    <div className={styles.personalTypeRow}>
                      <Field label="Type" required error={showValidation && !antecedent.type.trim() ? "Le type est obligatoire" : undefined}>
                        <div className={styles.inputWithAction}>
                          <input className={`${styles.input} ${styles.inputWithInlineAction}`} style={showValidation && !antecedent.type.trim() ? { borderColor: "#ef4444" } : {}} type="text" value={antecedent.type} onChange={(event) => updatePersonalAntecedent(antecedent.id, { type: event.currentTarget.value })} placeholder="Ex: Diabete type 2, Hypertension..." />
                          <button type="button" className={`${styles.removeIconButton} ${styles.inlineRemoveIconButton}`} onClick={() => removePersonalAntecedent(antecedent.id)} aria-label="Supprimer l'antecedent personnel"><Trash2 size={16} aria-hidden="true" /></button>
                        </div>
                      </Field>
                      <label className={styles.checkboxPill}>
                        <input type="checkbox" checked={antecedent.maladieActive} onChange={(event) => updatePersonalAntecedent(antecedent.id, { maladieActive: event.currentTarget.checked })} />
                        <span>maladie active</span>
                      </label>
                    </div>
                    <Field label="Details" required error={showValidation && !antecedent.details.trim() ? "Les details sont obligatoires" : undefined}>
                      <textarea className={`${styles.input} ${styles.textareaInput}`} style={showValidation && !antecedent.details.trim() ? { borderColor: "#ef4444" } : {}} value={antecedent.details} onChange={(event) => updatePersonalAntecedent(antecedent.id, { details: event.currentTarget.value })} placeholder="Ex: Diagnostique en 2020, sous traitement..." />
                    </Field>
                  </div>
                ))}
                <button type="button" className={styles.addAntecedentButton} onClick={() => setPersonalAntecedents((current) => [...current, initialPersonalAntecedent()])}><Plus size={14} aria-hidden="true" />Ajouter un antécédent</button>
              </section>

              <section className={styles.sectionBlock}>
                <h3 className={styles.sectionTitle}>ANTÉCÉDENTS FAMILIAUX</h3>
                {familyAntecedents.map((antecedent) => (
                  <div className={styles.antecedentCard} key={antecedent.id}>
                    <Field label="Lien de parente" required error={showValidation && !antecedent.lienParente.trim() ? "Le lien de parente est obligatoire" : undefined}>
                      <input className={styles.input} style={showValidation && !antecedent.lienParente.trim() ? { borderColor: "#ef4444" } : {}} type="text" value={antecedent.lienParente} onChange={(event) => updateFamilyAntecedent(antecedent.id, { lienParente: event.currentTarget.value })} placeholder="Ex: Pere, Mere, Grand-pere..." />
                    </Field>
                    <div className={styles.familyPathologieRow}>
                      <Field label="Pathologie" required error={showValidation && !antecedent.pathologie.trim() ? "La pathologie est obligatoire" : undefined}>
                        <input className={styles.input} style={showValidation && !antecedent.pathologie.trim() ? { borderColor: "#ef4444" } : {}} type="text" value={antecedent.pathologie} onChange={(event) => updateFamilyAntecedent(antecedent.id, { pathologie: event.currentTarget.value })} placeholder="Ex: Cardiopathie, Cancer du sein..." />
                      </Field>
                      <button type="button" className={styles.removeIconButton} onClick={() => removeFamilyAntecedent(antecedent.id)} aria-label="Supprimer l'antecedent familial"><Trash2 size={16} aria-hidden="true" /></button>
                    </div>
                  </div>
                ))}
                <button type="button" className={styles.addAntecedentButton} onClick={() => setFamilyAntecedents((current) => [...current, initialFamilyAntecedent()])}><Plus size={14} aria-hidden="true" />Ajouter un antécédent</button>
              </section>
            </div>
          ) : null}

          {currentStep === 3 ? (
            <div className={styles.stepThreeContent}>
              <div className={styles.noticeBox}><Info size={16} aria-hidden="true" /><p><strong>Traitements en cours</strong> — Les médicaments saisis seront enregistrés à la création du dossier.</p></div>
              <section className={styles.treatmentSection}>
                <h3 className={styles.sectionTitle}>MEDICAMENTS</h3>
                {treatments.map((treatment) => (
                  <div className={styles.treatmentCard} key={treatment.id}>
                    <div className={styles.medicationTopRow}>
                      <input className={styles.input} value={treatment.medicament} onChange={(event) => updateTreatment(treatment.id, { medicament: event.currentTarget.value })} placeholder="Ex: Paracetamol 500mg" />
                      <button type="button" className={styles.removeIconButton} onClick={() => removeTreatment(treatment.id)}><Trash2 size={16} aria-hidden="true" /></button>
                      <label className={styles.checkboxPill}><input type="checkbox" checked={treatment.maladieActive} onChange={(event) => updateTreatment(treatment.id, { maladieActive: event.currentTarget.checked })} /><span>Maladie active</span></label>
                    </div>
                    <div className={styles.treatmentTripleGrid}>
                      <input className={styles.input} value={treatment.dosage} onChange={(event) => updateTreatment(treatment.id, { dosage: event.currentTarget.value })} placeholder="Dosage" />
                      <input className={styles.input} value={treatment.indication} onChange={(event) => updateTreatment(treatment.id, { indication: event.currentTarget.value })} placeholder="Indication" />
                      <input className={styles.input} value={treatment.posologie} onChange={(event) => updateTreatment(treatment.id, { posologie: event.currentTarget.value })} placeholder="Posologie" />
                    </div>
                  </div>
                ))}
                <button type="button" className={styles.addAntecedentButton} onClick={() => setTreatments((current) => [...current, initialTreatment()])}><Plus size={14} aria-hidden="true" />Ajouter un médicament</button>
              </section>
            </div>
          ) : null}

          {currentStep === 4 && isFemalePatient ? (
            <div className={styles.stepFourContent}>
              <div className={styles.noticeBox}><Info size={16} aria-hidden="true" /><p><strong>Santé féminine</strong> — Informations spécifiques à la patiente.</p></div>
              <div className={styles.formGrid}>
                <Field label="Âge des premières règles"><input className={styles.input} type="number" value={menarche} onChange={(e) => setMenarche(e.currentTarget.value)} placeholder="Ex : 12" /></Field>
                <Field label="Régularité des cycles"><select className={styles.input} value={regulariteCycles} onChange={(e) => setRegulariteCycles(e.currentTarget.value)}><option value="Réguliers">Réguliers</option><option value="Irréguliers">Irréguliers</option><option value="Absents">Absents (Aménorrhée)</option></select></Field>
                <Field label="Contraception"><input className={styles.input} value={contraception} onChange={(e) => setContraception(e.currentTarget.value)} placeholder="Ex : Pilule, DIU, Aucune…" /></Field>
                <Field label="Nombre de grossesses"><div className={styles.counterInputWrap}><input className={`${styles.input} ${styles.counterInputField}`} value={String(nbGrossesses)} readOnly /><div className={styles.counterInputActions}><button type="button" className={styles.counterActionButton} onClick={() => adjustCounter(setNbGrossesses, -1)}>-</button><button type="button" className={styles.counterActionButton} onClick={() => adjustCounter(setNbGrossesses, 1)}>+</button></div></div></Field>
                <Field label="Nombre de césariennes"><div className={styles.counterInputWrap}><input className={`${styles.input} ${styles.counterInputField}`} value={String(nbCesariennes)} readOnly /><div className={styles.counterInputActions}><button type="button" className={styles.counterActionButton} onClick={() => adjustCounter(setNbCesariennes, -1)}>-</button><button type="button" className={styles.counterActionButton} onClick={() => adjustCounter(setNbCesariennes, 1)}>+</button></div></div></Field>
                <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}><label className={styles.checkboxPill}><input type="checkbox" checked={menopause} onChange={(e) => setMenopause(e.currentTarget.checked)} /><span>Ménopausée</span></label></div>
                {menopause ? <Field label="Âge de la ménopause"><input className={styles.input} type="number" value={ageMenopause} onChange={(e) => setAgeMenopause(e.currentTarget.value)} placeholder="Ex : 50" /></Field> : null}
                <Field label="Symptômes ménopause"><textarea className={`${styles.input} ${styles.textareaInput}`} value={symptomesMenopause} onChange={(e) => setSymptomesMenopause(e.currentTarget.value)} placeholder="Ex : Bouffées de chaleur…" /></Field>
              </div>
            </div>
          ) : null}

          {(currentStep === 4 && isMalePatient) || (currentStep === 5 && isFemalePatient) ? (
            <div className={styles.stepFourContent}>
              <div className={styles.noticeBox}><Info size={16} aria-hidden="true" /><p><strong>Informations sociales</strong> — Ces informations aideront au suivi médical du patient.</p></div>
              <div className={styles.socialTopGrid}>
                  <Field label="Assuré">
                    <label className={styles.checkboxPill}>
                      <input checked={assure} onChange={(event) => setAssure(event.currentTarget.checked)} type="checkbox" />
                      <span>{assure ? "Oui" : "Non"}</span>
                    </label>
                  </Field>
                <Field label="Taille du ménage"><div className={styles.counterInputWrap}><input className={`${styles.input} ${styles.counterInputField}`} value={String(tailleMenages)} readOnly /><div className={styles.counterInputActions}><button type="button" className={styles.counterActionButton} onClick={() => adjustCounter(setTailleMenages, -1)} aria-label="Diminuer la taille du ménage">-</button><button type="button" className={styles.counterActionButton} onClick={() => adjustCounter(setTailleMenages, 1)} aria-label="Augmenter la taille du ménage">+</button></div></div></Field>
                <Field label="Nombre de pièces"><div className={styles.counterInputWrap}><input className={`${styles.input} ${styles.counterInputField}`} value={String(nombreDePieces)} readOnly /><div className={styles.counterInputActions}><button type="button" className={styles.counterActionButton} onClick={() => adjustCounter(setNombreDePieces, -1)} aria-label="Diminuer le nombre de pièces">-</button><button type="button" className={styles.counterActionButton} onClick={() => adjustCounter(setNombreDePieces, 1)} aria-label="Augmenter le nombre de pièces">+</button></div></div></Field>
              </div>
              <div className={styles.socialBottomGrid}>
                <Field label="Profession"><input className={styles.input} value={socialProfession} onChange={(event) => setSocialProfession(event.currentTarget.value)} placeholder="Ex : Ingénieur, Étudiant, Retraité…" /></Field>
                <Field label="Situation familiale"><div className={styles.selectWrap}><select className={styles.input} value={socialSituationFamiliale} onChange={(event) => setSocialSituationFamiliale(event.currentTarget.value)}><option value="">Sélectionner</option><option value="Célibataire">Célibataire</option><option value="Marié(e)">Marié(e)</option><option value="Divorcé(e)">Divorcé(e)</option><option value="Veuf(ve)">Veuf(ve)</option></select><ChevronDown size={16} className={styles.selectIcon} aria-hidden="true" /></div></Field>
                <Field label="Nombre d'enfants"><div className={styles.counterInputWrap}><input className={`${styles.input} ${styles.counterInputField}`} value={String(nombreEnfants)} readOnly /><div className={styles.counterInputActions}><button type="button" className={styles.counterActionButton} onClick={() => adjustCounter(setNombreEnfants, -1)} aria-label="Diminuer le nombre d'enfants">-</button><button type="button" className={styles.counterActionButton} onClick={() => adjustCounter(setNombreEnfants, 1)} aria-label="Augmenter le nombre d'enfants">+</button></div></div></Field>
              </div>
              <section className={styles.sectionBlock}>
                <h3 className={styles.sectionTitle}>MODE DE VIE & HABITUDES</h3>
                <Field label="Habitudes saines"><div className={styles.inputWithAction}><textarea className={`${styles.input} ${styles.socialTextarea} ${styles.inputWithInlineAction}`} value={habitudesSaines} onChange={(event) => setHabitudesSaines(event.currentTarget.value)} placeholder="Activité physique régulière, alimentation équilibrée…" /><button type="button" className={`${styles.removeIconButton} ${styles.inlineRemoveIconButton} ${styles.inlineTextareaRemoveButton}`} onClick={() => setHabitudesSaines("")} aria-label="Effacer habitudes saines"><Trash2 size={16} aria-hidden="true" /></button></div></Field>
                <Field label="Habitudes toxiques"><div className={styles.inputWithAction}><textarea className={`${styles.input} ${styles.socialTextarea} ${styles.inputWithInlineAction}`} value={habitudesToxiques} onChange={(event) => setHabitudesToxiques(event.currentTarget.value)} placeholder="Ex: tabac, alcool..." /><button type="button" className={`${styles.removeIconButton} ${styles.inlineRemoveIconButton} ${styles.inlineTextareaRemoveButton}`} onClick={() => setHabitudesToxiques("")} aria-label="Effacer habitudes toxiques"><Trash2 size={16} aria-hidden="true" /></button></div></Field>
                <Field label="Environnement animal"><div className={styles.inputWithAction}><textarea className={`${styles.input} ${styles.socialTextarea} ${styles.inputWithInlineAction}`} value={environnementAnimal} onChange={(event) => setEnvironnementAnimal(event.currentTarget.value)} placeholder="Ex: animaux domestiques..." /><button type="button" className={`${styles.removeIconButton} ${styles.inlineRemoveIconButton} ${styles.inlineTextareaRemoveButton}`} onClick={() => setEnvironnementAnimal("")} aria-label="Effacer environnement animal"><Trash2 size={16} aria-hidden="true" /></button></div></Field>
                <Field label="Relations environnementales"><div className={styles.inputWithAction}><textarea className={`${styles.input} ${styles.socialTextarea} ${styles.inputWithInlineAction}`} value={relationsEnvironnementales} onChange={(event) => setRelationsEnvironnementales(event.currentTarget.value)} placeholder="Ex: environnement social du patient" /><button type="button" className={`${styles.removeIconButton} ${styles.inlineRemoveIconButton} ${styles.inlineTextareaRemoveButton}`} onClick={() => setRelationsEnvironnementales("")} aria-label="Effacer relations environnementales"><Trash2 size={16} aria-hidden="true" /></button></div></Field>
              </section>
            </div>
          ) : null}

          <footer className={styles.footer}>
            {currentStep === 1 ? <button type="button" className={styles.cancelButton} onClick={onClose}><X size={16} aria-hidden="true" />Annuler</button> : <button type="button" className={styles.cancelButton} onClick={() => setCurrentStep((prev) => Math.max(1, prev - 1) as 1 | 2 | 3 | 4 | 5)}><ChevronLeft size={16} aria-hidden="true" />Précédent</button>}
            <div className={styles.footerActionsRight}>
              <button type="button" className={styles.addNowButton} onClick={handleAddNow} disabled={isSubmitting}><Check size={16} aria-hidden="true" />{isSubmitting ? "Ajout en cours..." : "Ajouter maintenant"}</button>
              <button type="submit" className={styles.continueButton} disabled={isSubmitting}><span>{currentStep < maxStep ? "Continuer" : "Terminer"}</span><ChevronRight size={16} aria-hidden="true" /></button>
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
  error?: string | boolean;
  children: ReactNode;
}

function Field({ label, required, error, children }: FieldProps) {
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>
        {label}
        {required ? <span className={styles.requiredMark}> *</span> : null}
      </span>
      {children}
      {typeof error === "string" && error ? <span style={{ color: "#ef4444", fontSize: "0.75rem", marginTop: "0.25rem", display: "block" }}>{error}</span> : null}
    </label>
  );
}
