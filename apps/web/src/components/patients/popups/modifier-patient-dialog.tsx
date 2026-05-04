import { Check, ChevronDown, ChevronLeft, ChevronRight, Info, Loader2, Plus, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import styles from "@/routes/patients/popups/nouveau-patient.module.css";

interface ModifierPatientDialogProps {
  open: boolean;
  onClose: () => void;
  isSubmitting?: boolean;
  submitError?: string | null;
  onContinue?: (values: ModifierPatientSubmissionValues) => void | Promise<void>;
  onSave?: (values: ModifierPatientSubmissionValues) => void | Promise<void>;
  initialData?: Partial<ModifierPatientSubmissionValues>;
  dialogTitle?: string;
}

export interface ModifierPatientFormValues {
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
  pathology: string; // Match the prop if needed, but original used pathologie
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

export interface ModifierPatientSubmissionValues extends ModifierPatientFormValues {
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
  personalAntecedents: Array<PersonalAntecedentValues>;
  familyAntecedents: Array<FamilyAntecedentValues>;
  traitements: Array<TreatmentValues>;
  menarche?: number;
  regulariteCycles?: string;
  contraception?: string;
  nbGrossesses?: number;
  nbCesariennes?: number;
  menopause?: boolean;
  ageMenopause?: number;
  symptomesMenopause?: string;
}

const ALLOW_STEP_PREVIEW_NAVIGATION = false;

const requiredFields: Array<keyof ModifierPatientFormValues> = [
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

const maleStepLabels = [
  "Informations essentielles",
  "Antecedents",
  "Traitements",
  "Informations sociales",
] as const;

const femaleStepLabels = [
  "Informations essentielles",
  "Antecedents",
  "Traitements",
  "Sante feminine",
  "Informations sociales",
] as const;

const createId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const initialPersonalAntecedent = (): PersonalAntecedentValues => ({
  id: createId(),
  type: "",
  details: "",
  maladieActive: false,
});

const initialFamilyAntecedent = (): FamilyAntecedentValues => ({
  id: createId(),
  lienParente: "",
  pathologie: "",
  pathology: "",
});

const initialTreatment = (): TreatmentValues => ({
  id: createId(),
  medicament: "",
  dosage: "",
  indication: "",
  posologie: "",
  maladieActive: true,
});

export function ModifierPatientDialog({
  open,
  onClose,
  isSubmitting = false,
  submitError = null,
  onContinue,
  onSave,
  initialData,
  dialogTitle = "Modifier le patient",
}: ModifierPatientDialogProps) {
  const modalRef = useRef<HTMLElement | null>(null);
  const progressTrackRef = useRef<HTMLDivElement | null>(null);
  const stepDotRefs = useRef<Array<HTMLDivElement | null>>([]);

  const [values, setValues] = useState<ModifierPatientFormValues>({
    nom: initialData?.nom ?? "",
    prenom: initialData?.prenom ?? "",
    profession: initialData?.profession ?? "",
    sexe: initialData?.sexe ?? "",
    lieuNaissance: initialData?.lieuNaissance ?? "",
    dateNaissance: initialData?.dateNaissance ?? "",
    nss: initialData?.nss ?? "",
    nationalite: initialData?.nationalite ?? "",
    telephone: initialData?.telephone ?? "",
    email: initialData?.email ?? "",
    situationFamiliale: initialData?.situationFamiliale ?? "",
    adresseComplete: initialData?.adresseComplete ?? "",
  });

  const [showValidation, setShowValidation] = useState(false);
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [progressFillPx, setProgressFillPx] = useState(0);
  
  const [groupeSanguin, setGroupeSanguin] = useState(initialData?.groupeSanguin ?? "O+");
  const [ageCirconcision, setAgeCirconcision] = useState(initialData?.ageCirconcision ?? "13 ans");
  const [revenuMensuel, setRevenuMensuel] = useState(initialData?.revenuMensuel ?? "");
  const [assure, setAssure] = useState(initialData?.assure ?? false);
  const [tailleMenages, setTailleMenages] = useState(initialData?.tailleMenages ?? 0);
  const [nombreDePieces, setNombreDePieces] = useState(initialData?.nombreDePieces ?? 0);
  const [socialProfession, setSocialProfession] = useState(initialData?.socialProfession ?? "");
  const [socialSituationFamiliale, setSocialSituationFamiliale] = useState(initialData?.socialSituationFamiliale ?? "");
  const [nombreEnfants, setNombreEnfants] = useState(initialData?.nombreEnfants ?? 0);
  const [habitudesSaines, setHabitudesSaines] = useState(initialData?.habitudesSaines ?? "");
  const [habitudesToxiques, setHabitudesToxiques] = useState(initialData?.habitudesToxiques ?? "");
  const [environnementAnimal, setEnvironnementAnimal] = useState(initialData?.environnementAnimal ?? "");
  const [relationsEnvironnementales, setRelationsEnvironnementales] = useState(initialData?.relationsEnvironnementales ?? "");
  
  const [personalAntecedents, setPersonalAntecedents] = useState<PersonalAntecedentValues[]>(
    initialData?.personalAntecedents ?? []
  );
  const [familyAntecedents, setFamilyAntecedents] = useState<FamilyAntecedentValues[]>(
    initialData?.familyAntecedents ?? []
  );
  const [treatments, setTreatments] = useState<TreatmentValues[]>(
    initialData?.traitements ?? []
  );

  const [menarche, setMenarche] = useState<string>(String(initialData?.menarche ?? ""));
  const [regulariteCycles, setRegulariteCycles] = useState(initialData?.regulariteCycles ?? "Reguliers");
  const [contraception, setContraception] = useState(initialData?.contraception ?? "Aucune");
  const [nbGrossesses, setNbGrossesses] = useState(initialData?.nbGrossesses ?? 0);
  const [nbCesariennes, setNbCesariennes] = useState(initialData?.nbCesariennes ?? 0);
  const [menopause, setMenopause] = useState(initialData?.menopause ?? false);
  const [ageMenopause, setAgeMenopause] = useState(String(initialData?.ageMenopause ?? ""));
  const [symptomesMenopause, setSymptomesMenopause] = useState(initialData?.symptomesMenopause ?? "");

  useEffect(() => {
    if (open && initialData) {
      setValues({
        nom: initialData.nom ?? "",
        prenom: initialData.prenom ?? "",
        profession: initialData.profession ?? "",
        sexe: initialData.sexe ?? "",
        lieuNaissance: initialData.lieuNaissance ?? "",
        dateNaissance: initialData.dateNaissance ?? "",
        nss: initialData.nss ?? "",
        nationalite: initialData.nationalite ?? "",
        telephone: initialData.telephone ?? "",
        email: initialData.email ?? "",
        situationFamiliale: initialData.situationFamiliale ?? "",
        adresseComplete: initialData.adresseComplete ?? "",
      });
      setGroupeSanguin(initialData.groupeSanguin ?? "O+");
      setAgeCirconcision(initialData.ageCirconcision ?? "13 ans");
      setRevenuMensuel(initialData.revenuMensuel ?? "");
      setAssure(initialData.assure ?? false);
      setTailleMenages(initialData.tailleMenages ?? 0);
      setNombreDePieces(initialData.nombreDePieces ?? 0);
      setSocialProfession(initialData.socialProfession ?? "");
      setSocialSituationFamiliale(initialData.socialSituationFamiliale ?? "");
      setNombreEnfants(initialData.nombreEnfants ?? 0);
      setHabitudesSaines(initialData.habitudesSaines ?? "");
      setHabitudesToxiques(initialData.habitudesToxiques ?? "");
      setEnvironnementAnimal(initialData.environnementAnimal ?? "");
      setRelationsEnvironnementales(initialData.relationsEnvironnementales ?? "");
      setPersonalAntecedents(initialData.personalAntecedents ?? []);
      setFamilyAntecedents(initialData.familyAntecedents ?? []);
      setTreatments(initialData.traitements ?? []);
      setMenarche(String(initialData.menarche ?? ""));
      setRegulariteCycles(initialData.regulariteCycles ?? "Reguliers");
      setContraception(initialData.contraception ?? "Aucune");
      setNbGrossesses(initialData.nbGrossesses ?? 0);
      setNbCesariennes(initialData.nbCesariennes ?? 0);
      setMenopause(initialData.menopause ?? false);
      setAgeMenopause(String(initialData.ageMenopause ?? ""));
      setSymptomesMenopause(initialData.symptomesMenopause ?? "");
    }
  }, [open, initialData]);

  const isMalePatient = useMemo(() => {
    const normalized = (values.sexe ?? "").trim().toLowerCase();
    return normalized === "homme" || normalized === "male" || normalized === "m";
  }, [values.sexe]);

  const isFemalePatient = useMemo(() => {
    const normalized = (values.sexe ?? "").trim().toLowerCase();
    return normalized === "femme" || normalized === "female" || normalized === "f";
  }, [values.sexe]);

  const stepLabels = isFemalePatient ? femaleStepLabels : maleStepLabels;
  const maxStep = isFemalePatient ? 5 : 4;

  const isFormValid = useMemo(() => {
    return requiredFields.every((field) => (values[field] ?? "").trim().length > 0);
  }, [values]);

  const isStepTwoValid = useMemo(() => {
    const hasValidPersonalAntecedents = personalAntecedents.every(
      (entry) => (entry.type ?? "").trim().length > 0 && (entry.details ?? "").trim().length > 0,
    );

    const hasValidFamilyAntecedents = familyAntecedents.every(
      (entry) => (entry.lienParente ?? "").trim().length > 0 && (entry.pathologie ?? "").trim().length > 0,
    );

    return hasValidPersonalAntecedents && hasValidFamilyAntecedents;
  }, [personalAntecedents, familyAntecedents]);

  useEffect(() => {
    if (!open) {
      setCurrentStep(1);
      setShowValidation(false);
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    const updateProgressFill = () => {
      const progressTrackElement = progressTrackRef.current;
      const activeStepDot = stepDotRefs.current[currentStep - 1];

      if (!progressTrackElement || !activeStepDot) {
        return;
      }

      const progressTrackRect = progressTrackElement.getBoundingClientRect();
      const activeDotRect = activeStepDot.getBoundingClientRect();
      const nextWidth = activeDotRect.left + activeDotRect.width / 2 - progressTrackRect.left;

      setProgressFillPx(Math.max(0, nextWidth));
    };

    updateProgressFill();
    window.addEventListener("resize", updateProgressFill);

    return () => {
      window.removeEventListener("resize", updateProgressFill);
    };
  }, [currentStep, stepLabels.length]);

  if (!open) {
    return null;
  }

  const buildSubmissionValues = (): ModifierPatientSubmissionValues => ({
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
    personalAntecedents,
    familyAntecedents,
    traitements: treatments,
    menarche: menarche ? parseInt(menarche) : undefined,
    regulariteCycles,
    contraception,
    nbGrossesses,
    nbCesariennes,
    menopause,
    ageMenopause: ageMenopause ? parseInt(ageMenopause) : undefined,
    symptomesMenopause,
  });

  const handleContinue = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!ALLOW_STEP_PREVIEW_NAVIGATION) {
      if (currentStep === 1 && !isFormValid) {
        setShowValidation(true);
        return;
      }

      if (currentStep === 2 && !isStepTwoValid) {
        setShowValidation(true);
        return;
      }
    }

    setShowValidation(false);

    if (currentStep < maxStep) {
      setCurrentStep((prev) => Math.min(maxStep, prev + 1) as 1 | 2 | 3 | 4 | 5);
      return;
    }

    await onContinue?.(buildSubmissionValues());
  };

  const handleSave = async () => {
    if (!ALLOW_STEP_PREVIEW_NAVIGATION) {
      if (!isFormValid || (currentStep >= 2 && !isStepTwoValid)) {
        setShowValidation(true);
        return;
      }
    }

    await onSave?.(buildSubmissionValues());
  };

  const updateField = (field: keyof ModifierPatientFormValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
  };

  const adjustCounter = (setter: React.Dispatch<React.SetStateAction<number>>, delta: number) => {
    setter((current) => Math.max(0, current + delta));
  };

  const updatePersonalAntecedent = (id: string, patch: Partial<PersonalAntecedentValues>) => {
    setPersonalAntecedents((current) =>
      current.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)),
    );
  };

  const updateFamilyAntecedent = (id: string, patch: Partial<FamilyAntecedentValues>) => {
    setFamilyAntecedents((current) =>
      current.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)),
    );
  };

  const removePersonalAntecedent = (id: string) => {
    setPersonalAntecedents((current) => {
      if (current.length === 1) {
        return [{ ...current[0], type: "", details: "", maladieActive: false }];
      }
      return current.filter((entry) => entry.id !== id);
    });
  };

  const removeFamilyAntecedent = (id: string) => {
    setFamilyAntecedents((current) => {
      if (current.length === 1) {
        return [{ ...current[0], lienParente: "", pathologie: "", pathology: "" }];
      }
      return current.filter((entry) => entry.id !== id);
    });
  };

  const updateTreatment = (id: string, patch: Partial<TreatmentValues>) => {
    setTreatments((current) => current.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)));
  };

  const removeTreatment = (id: string) => {
    setTreatments((current) => {
      if (current.length === 1) {
        return [{ ...current[0], medicament: "", dosage: "", indication: "", posologie: "", maladieActive: true }];
      }
      return current.filter((entry) => entry.id !== id);
    });
  };

  return (
    <div className={styles.backdrop} onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section ref={modalRef} className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="modifier-patient-title">
        <header className={styles.header}>
          <div className={styles.headerTextBlock}>
            <h2 className={styles.title} id="modifier-patient-title">{dialogTitle}</h2>
            <p className={styles.subtitle}>{`Etape ${currentStep} sur ${stepLabels.length}`}</p>
          </div>
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Fermer">
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div ref={progressTrackRef} className={styles.progressBarTrack}><span className={styles.progressBarFill} style={{ width: `${progressFillPx}px` }} /></div>

        {!initialData && open ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem', gap: '1rem', color: '#64748b' }}>
            <Loader2 className="animate-spin" size={32} />
            <p>Chargement des données du patient...</p>
          </div>
        ) : (
          <>
            <div className={styles.stepRail}>
          {stepLabels.map((label, index) => {
            const isDone = index < currentStep - 1;
            const isActive = index === currentStep - 1;
            return (
              <div
                className={`${styles.stepItem} ${index === stepLabels.length - 1 ? styles.stepItemLast : ""}`}
                key={label}
              >
                <div className={styles.stepContent}>
                  <div
                    ref={(element) => {
                      stepDotRefs.current[index] = element;
                    }}
                    className={`${styles.stepDot} ${isDone ? styles.stepDotDone : ""} ${isActive ? styles.stepDotActive : ""}`}
                  >
                    {isDone ? <Check size={14} aria-hidden="true" /> : index + 1}
                  </div>

                  <p className={`${styles.stepLabel} ${isActive ? styles.stepLabelActive : ""}`}>{label}</p>
                </div>

                {index < stepLabels.length - 1 ? <span className={`${styles.stepConnector} ${isDone ? styles.stepConnectorActive : ""}`} /> : null}
              </div>
            );
          })}
        </div>

        <form className={styles.form} onSubmit={handleContinue}>
          {submitError ? <p className={styles.submitError} style={{ margin: "0 0 1rem 0", color: "#ef4444", fontWeight: 500, background: "#fef2f2", padding: "0.75rem", borderRadius: "0.5rem" }}>{submitError}</p> : null}
          {currentStep === 1 ? (
            <>
              <div className={styles.noticeBox}><Info size={16} aria-hidden="true" /><p><strong>Informations essentielles</strong> - Ces champs sont obligatoires pour modifier le dossier patient.</p></div>
              {showValidation && !isFormValid ? <p className={styles.validationHint}>Veuillez renseigner les champs obligatoires.</p> : null}
              <div className={styles.formGrid}>
                <Field label="Nom" required error={showValidation && !values.nom.trim() ? "Le nom est obligatoire" : undefined}><input className={styles.input} style={showValidation && !values.nom.trim() ? { borderColor: '#ef4444' } : {}} value={values.nom} onChange={(e) => updateField("nom", e.currentTarget.value)} /></Field>
                <Field label="Prenom" required error={showValidation && !values.prenom.trim() ? "Le prenom est obligatoire" : undefined}><input className={styles.input} style={showValidation && !values.prenom.trim() ? { borderColor: '#ef4444' } : {}} value={values.prenom} onChange={(e) => updateField("prenom", e.currentTarget.value)} /></Field>
                <Field label="Profession"><input className={styles.input} value={values.profession} onChange={(e) => updateField("profession", e.currentTarget.value)} /></Field>
                <Field label="Sexe" required error={showValidation && !values.sexe.trim() ? "Le sexe est obligatoire" : undefined}>
                  <select className={styles.input} style={showValidation && !values.sexe.trim() ? { borderColor: '#ef4444' } : {}} value={values.sexe} onChange={(e) => updateField("sexe", e.currentTarget.value)}>
                    <option value="">Selectionner</option>
                    <option value="Homme">Homme</option>
                    <option value="Femme">Femme</option>
                    <option value="Autre">Autre</option>
                  </select>
                </Field>
                <Field label="Lieu de naissance" required error={showValidation && !values.lieuNaissance.trim() ? "Le lieu de naissance est obligatoire" : undefined}><input className={styles.input} style={showValidation && !values.lieuNaissance.trim() ? { borderColor: '#ef4444' } : {}} value={values.lieuNaissance} onChange={(e) => updateField("lieuNaissance", e.currentTarget.value)} /></Field>
                <Field label="Date de naissance" required error={showValidation && !values.dateNaissance.trim() ? "La date de naissance est obligatoire" : undefined}><input className={styles.input} style={showValidation && !values.dateNaissance.trim() ? { borderColor: '#ef4444' } : {}} value={values.dateNaissance} onChange={(e) => updateField("dateNaissance", e.currentTarget.value)} placeholder="JJ/MM/AAAA" /></Field>
                <Field label="NSS" required error={showValidation && !values.nss.trim() ? "Le NSS est obligatoire" : undefined}><input className={styles.input} style={showValidation && !values.nss.trim() ? { borderColor: '#ef4444' } : {}} value={values.nss} onChange={(e) => updateField("nss", e.currentTarget.value)} /></Field>
                <Field label="Nationalite"><input className={styles.input} value={values.nationalite} onChange={(e) => updateField("nationalite", e.currentTarget.value)} /></Field>
                <Field label="Telephone" required error={showValidation && !values.telephone.trim() ? "Le telephone est obligatoire" : undefined}><input className={styles.input} style={showValidation && !values.telephone.trim() ? { borderColor: '#ef4444' } : {}} value={values.telephone} onChange={(e) => updateField("telephone", e.currentTarget.value)} /></Field>
                <Field label="Email" required error={showValidation && !values.email.trim() ? "L'email est obligatoire" : undefined}><input className={styles.input} style={showValidation && !values.email.trim() ? { borderColor: '#ef4444' } : {}} value={values.email} onChange={(e) => updateField("email", e.currentTarget.value)} /></Field>
                <Field label="Situation familiale" required error={showValidation && !values.situationFamiliale.trim() ? "La situation familiale est obligatoire" : undefined}><input className={styles.input} style={showValidation && !values.situationFamiliale.trim() ? { borderColor: '#ef4444' } : {}} value={values.situationFamiliale} onChange={(e) => updateField("situationFamiliale", e.currentTarget.value)} /></Field>
                <Field label="Adresse complete"><input className={styles.input} value={values.adresseComplete} onChange={(e) => updateField("adresseComplete", e.currentTarget.value)} /></Field>
              </div>
            </>
          ) : null}

          {currentStep === 2 ? (
            <div className={styles.stepTwoContent}>
              <div className={styles.noticeBox}><Info size={16} aria-hidden="true" /><p><strong>Informations medicales</strong> - Ces informations aideront au suivi medical du patient.</p></div>
              {showValidation && !isStepTwoValid ? <p className={styles.validationHint}>Veuillez renseigner les champs obligatoires de cette etape avant de continuer.</p> : null}
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
                <h3 className={styles.sectionTitle}>ANTECEDENTS PERSONNELS</h3>
                {personalAntecedents.map((antecedent) => (
                  <div className={styles.antecedentCard} key={antecedent.id}>
                    <div className={styles.personalTypeRow}>
                      <Field label="Type" required error={showValidation && !antecedent.type.trim() ? "Le type est obligatoire" : undefined}>
                        <div className={styles.inputWithAction}>
                          <input
                            className={`${styles.input} ${styles.inputWithInlineAction}`}
                            style={showValidation && !antecedent.type.trim() ? { borderColor: '#ef4444' } : {}}
                            type="text"
                            value={antecedent.type}
                            onChange={(event) =>
                              updatePersonalAntecedent(antecedent.id, { type: event.currentTarget.value })
                            }
                            placeholder="Ex: Diabete type 2, Hypertension..."
                          />
                          <button
                            type="button"
                            className={`${styles.removeIconButton} ${styles.inlineRemoveIconButton}`}
                            onClick={() => removePersonalAntecedent(antecedent.id)}
                            aria-label="Supprimer l'antecedent personnel"
                          >
                            <Trash2 size={16} aria-hidden="true" />
                          </button>
                        </div>
                      </Field>
                      <label className={styles.checkboxPill}>
                        <input
                          type="checkbox"
                          checked={antecedent.maladieActive}
                          onChange={(event) =>
                            updatePersonalAntecedent(antecedent.id, { maladieActive: event.currentTarget.checked })
                          }
                        />
                        <span>maladie active</span>
                      </label>
                    </div>
                    <Field label="Details" required error={showValidation && !antecedent.details.trim() ? "Les details sont obligatoires" : undefined}>
                      <textarea
                        className={`${styles.input} ${styles.textareaInput}`}
                        style={showValidation && !antecedent.details.trim() ? { borderColor: '#ef4444' } : {}}
                        value={antecedent.details}
                        onChange={(event) =>
                          updatePersonalAntecedent(antecedent.id, { details: event.currentTarget.value })
                        }
                        placeholder="Ex: Diagnostique en 2020, sous traitement..."
                      />
                    </Field>
                  </div>
                ))}
                <button
                  type="button"
                  className={styles.addAntecedentButton}
                  onClick={() => setPersonalAntecedents((current) => [...current, initialPersonalAntecedent()])}
                >
                  <Plus size={14} aria-hidden="true" />
                  Ajouter un antecedent
                </button>
              </section>

              <section className={styles.sectionBlock}>
                <h3 className={styles.sectionTitle}>ANTECEDENTS FAMILIAUX</h3>
                {familyAntecedents.map((antecedent) => (
                  <div className={styles.antecedentCard} key={antecedent.id}>
                    <Field label="Lien de parente" required error={showValidation && !antecedent.lienParente.trim() ? "Le lien de parente est obligatoire" : undefined}>
                      <input
                        className={styles.input}
                        style={showValidation && !antecedent.lienParente.trim() ? { borderColor: '#ef4444' } : {}}
                        type="text"
                        value={antecedent.lienParente}
                        onChange={(event) =>
                          updateFamilyAntecedent(antecedent.id, { lienParente: event.currentTarget.value })
                        }
                        placeholder="Ex: Pere, Mere, Grand-pere..."
                      />
                    </Field>
                    <div className={styles.familyPathologieRow}>
                      <Field label="Pathologie" required error={showValidation && !antecedent.pathologie.trim() ? "La pathologie est obligatoire" : undefined}>
                        <input
                          className={styles.input}
                          style={showValidation && !antecedent.pathologie.trim() ? { borderColor: '#ef4444' } : {}}
                          type="text"
                          value={antecedent.pathologie}
                          onChange={(event) =>
                            updateFamilyAntecedent(antecedent.id, { pathologie: event.currentTarget.value })
                          }
                          placeholder="Ex: Cardiopathie, Cancer du sein..."
                        />
                      </Field>
                      <button
                        type="button"
                        className={styles.removeIconButton}
                        onClick={() => removeFamilyAntecedent(antecedent.id)}
                        aria-label="Supprimer l'antecedent familial"
                      >
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  className={styles.addAntecedentButton}
                  onClick={() => setFamilyAntecedents((current) => [...current, initialFamilyAntecedent()])}
                >
                  <Plus size={14} aria-hidden="true" />
                  Ajouter un antecedent
                </button>
              </section>
            </div>
          ) : null}

          {currentStep === 3 ? (
            <div className={styles.stepThreeContent}>
              <div className={styles.noticeBox}><Info size={16} aria-hidden="true" /><p><strong>Informations medicales</strong> - Les traitements saisis seront enregistres lors de la modification.</p></div>
              <section className={styles.treatmentSection}>
                <h3 className={styles.sectionTitle}>MEDICAMENTS</h3>
                {treatments.map((treatment) => (
                  <div className={styles.treatmentCard} key={treatment.id}>
                    <div className={styles.medicationTopRow}>
                      <input
                        className={styles.input}
                        value={treatment.medicament}
                        onChange={(event) => updateTreatment(treatment.id, { medicament: event.currentTarget.value })}
                        placeholder="Ex: Paracetamol 500mg"
                      />
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
                <button type="button" className={styles.addAntecedentButton} onClick={() => setTreatments((current) => [...current, initialTreatment()])}><Plus size={14} aria-hidden="true" />Ajouter un medicament</button>
              </section>
            </div>
          ) : null}

          {currentStep === 4 && isFemalePatient ? (
            <div className={styles.stepFourContent}>
              <div className={styles.noticeBox}><Info size={16} aria-hidden="true" /><p><strong>Sante feminine</strong> - Informations specifiques a la patiente.</p></div>
              <div className={styles.formGrid}>
                <Field label="Age des premieres regles">
                  <input className={styles.input} type="number" value={menarche} onChange={(e) => setMenarche(e.currentTarget.value)} placeholder="Ex: 12" />
                </Field>
                <Field label="Regularite des cycles">
                  <select className={styles.input} value={regulariteCycles} onChange={(e) => setRegulariteCycles(e.currentTarget.value)}>
                    <option value="Reguliers">Reguliers</option>
                    <option value="Irreguliers">Irreguliers</option>
                    <option value="Absents">Absents (Amenorrhee)</option>
                  </select>
                </Field>
                <Field label="Contraception">
                  <input className={styles.input} value={contraception} onChange={(e) => setContraception(e.currentTarget.value)} placeholder="Ex: Pilule, DIU, Aucun..." />
                </Field>
                <Field label="Nombre de grossesses">
                  <div className={styles.counterInputWrap}>
                    <input className={`${styles.input} ${styles.counterInputField}`} value={String(nbGrossesses)} readOnly />
                    <div className={styles.counterInputActions}>
                      <button type="button" className={styles.counterActionButton} onClick={() => adjustCounter(setNbGrossesses, -1)}>-</button>
                      <button type="button" className={styles.counterActionButton} onClick={() => adjustCounter(setNbGrossesses, 1)}>+</button>
                    </div>
                  </div>
                </Field>
                <Field label="Nombre de cesariennes">
                  <div className={styles.counterInputWrap}>
                    <input className={`${styles.input} ${styles.counterInputField}`} value={String(nbCesariennes)} readOnly />
                    <div className={styles.counterInputActions}>
                      <button type="button" className={styles.counterActionButton} onClick={() => adjustCounter(setNbCesariennes, -1)}>-</button>
                      <button type="button" className={styles.counterActionButton} onClick={() => adjustCounter(setNbCesariennes, 1)}>+</button>
                    </div>
                  </div>
                </Field>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <label className={styles.checkboxPill}>
                    <input type="checkbox" checked={menopause} onChange={(e) => setMenopause(e.currentTarget.checked)} />
                    <span>Menopausee</span>
                  </label>
                </div>
                {menopause && (
                  <Field label="Age de la menopause">
                    <input className={styles.input} type="number" value={ageMenopause} onChange={(e) => setAgeMenopause(e.currentTarget.value)} placeholder="Ex: 50" />
                  </Field>
                )}
                <Field label="Symptomes menopause">
                  <textarea className={`${styles.input} ${styles.textareaInput}`} value={symptomesMenopause} onChange={(e) => setSymptomesMenopause(e.currentTarget.value)} placeholder="Ex: Bouffees de chaleur..." />
                </Field>
              </div>
            </div>
          ) : null}

          {(currentStep === 4 && isMalePatient) || (currentStep === 5 && isFemalePatient) ? (
            <div className={styles.stepFourContent}>
              <div className={styles.noticeBox}><Info size={16} aria-hidden="true" /><p><strong>Informations sociales</strong> - Ces informations aideront au suivi medical du patient.</p></div>
              <div className={styles.socialTopGrid}>
                  <Field label={"Assur\u00e9"}>
                    <label className={styles.checkboxPill}>
                      <input checked={assure} onChange={(event) => setAssure(event.currentTarget.checked)} type="checkbox" />
                      <span>{assure ? "Oui" : "Non"}</span>
                    </label>
                  </Field>
                <Field label="Taille menages">
                  <div className={styles.counterInputWrap}>
                    <input className={`${styles.input} ${styles.counterInputField}`} value={String(tailleMenages)} readOnly />
                    <div className={styles.counterInputActions}>
                      <button type="button" className={styles.counterActionButton} onClick={() => adjustCounter(setTailleMenages, -1)} aria-label="Diminuer la taille menages">-</button>
                      <button type="button" className={styles.counterActionButton} onClick={() => adjustCounter(setTailleMenages, 1)} aria-label="Augmenter la taille menages">+</button>
                    </div>
                  </div>
                </Field>
                <Field label="Nombre de pieces">
                  <div className={styles.counterInputWrap}>
                    <input className={`${styles.input} ${styles.counterInputField}`} value={String(nombreDePieces)} readOnly />
                    <div className={styles.counterInputActions}>
                      <button type="button" className={styles.counterActionButton} onClick={() => adjustCounter(setNombreDePieces, -1)} aria-label="Diminuer le nombre de pieces">-</button>
                      <button type="button" className={styles.counterActionButton} onClick={() => adjustCounter(setNombreDePieces, 1)} aria-label="Augmenter le nombre de pieces">+</button>
                    </div>
                  </div>
                </Field>
              </div>

              <div className={styles.socialBottomGrid}>
                <Field label="Profession"><input className={styles.input} value={socialProfession} onChange={(event) => setSocialProfession(event.currentTarget.value)} placeholder="Ex: Ingenieur, Etudiant, Retraite..." /></Field>
                <Field label="Situation familiale">
                  <div className={styles.selectWrap}>
                    <select className={styles.input} value={socialSituationFamiliale} onChange={(event) => setSocialSituationFamiliale(event.currentTarget.value)}>
                      <option value="">Selectionner</option>
                      <option value="Celibataire">Celibataire</option>
                      <option value="Marie(e)">Marie(e)</option>
                      <option value="Divorce(e)">Divorce(e)</option>
                      <option value="Veuf(ve)">Veuf(ve)</option>
                    </select>
                    <ChevronDown size={16} className={styles.selectIcon} aria-hidden="true" />
                  </div>
                </Field>
                <Field label="Nombre d'enfants">
                  <div className={styles.counterInputWrap}>
                    <input className={`${styles.input} ${styles.counterInputField}`} value={String(nombreEnfants)} readOnly />
                    <div className={styles.counterInputActions}>
                      <button type="button" className={styles.counterActionButton} onClick={() => adjustCounter(setNombreEnfants, -1)} aria-label="Diminuer le nombre d'enfants">-</button>
                      <button type="button" className={styles.counterActionButton} onClick={() => adjustCounter(setNombreEnfants, 1)} aria-label="Augmenter le nombre d'enfants">+</button>
                    </div>
                  </div>
                </Field>
              </div>

              <section className={styles.sectionBlock}>
                <h3 className={styles.sectionTitle}>MODE DE VIE & HABITUDES</h3>
                <Field label="Habitudes saines">
                  <div className={styles.inputWithAction}>
                    <textarea
                      className={`${styles.input} ${styles.socialTextarea} ${styles.inputWithInlineAction}`}
                      value={habitudesSaines}
                      onChange={(event) => setHabitudesSaines(event.currentTarget.value)}
                      placeholder="Activite physique reguliere, alimentation equilibree"
                    />
                    <button type="button" className={`${styles.removeIconButton} ${styles.inlineRemoveIconButton} ${styles.inlineTextareaRemoveButton}`} onClick={() => setHabitudesSaines("")} aria-label="Effacer habitudes saines"><Trash2 size={16} aria-hidden="true" /></button>
                  </div>
                </Field>
                <Field label="Habitudes toxiques">
                  <div className={styles.inputWithAction}>
                    <textarea
                      className={`${styles.input} ${styles.socialTextarea} ${styles.inputWithInlineAction}`}
                      value={habitudesToxiques}
                      onChange={(event) => setHabitudesToxiques(event.currentTarget.value)}
                      placeholder="Ex: tabac, alcool..."
                    />
                    <button type="button" className={`${styles.removeIconButton} ${styles.inlineRemoveIconButton} ${styles.inlineTextareaRemoveButton}`} onClick={() => setHabitudesToxiques("")} aria-label="Effacer habitudes toxiques"><Trash2 size={16} aria-hidden="true" /></button>
                  </div>
                </Field>
                <Field label="Environnement animal">
                  <div className={styles.inputWithAction}>
                    <textarea
                      className={`${styles.input} ${styles.socialTextarea} ${styles.inputWithInlineAction}`}
                      value={environnementAnimal}
                      onChange={(event) => setEnvironnementAnimal(event.currentTarget.value)}
                      placeholder="Ex: animaux domestiques..."
                    />
                    <button type="button" className={`${styles.removeIconButton} ${styles.inlineRemoveIconButton} ${styles.inlineTextareaRemoveButton}`} onClick={() => setEnvironnementAnimal("")} aria-label="Effacer environnement animal"><Trash2 size={16} aria-hidden="true" /></button>
                  </div>
                </Field>
                <Field label="Relations environnementales">
                  <div className={styles.inputWithAction}>
                    <textarea
                      className={`${styles.input} ${styles.socialTextarea} ${styles.inputWithInlineAction}`}
                      value={relationsEnvironnementales}
                      onChange={(event) => setRelationsEnvironnementales(event.currentTarget.value)}
                      placeholder="Ex: environnement social du patient"
                    />
                    <button type="button" className={`${styles.removeIconButton} ${styles.inlineRemoveIconButton} ${styles.inlineTextareaRemoveButton}`} onClick={() => setRelationsEnvironnementales("")} aria-label="Effacer relations environnementales"><Trash2 size={16} aria-hidden="true" /></button>
                  </div>
                </Field>
              </section>
            </div>
          ) : null}

          <footer className={styles.footer}>
            {currentStep === 1 ? (
              <button type="button" className={styles.cancelButton} onClick={onClose}><X size={16} aria-hidden="true" />Annuler</button>
            ) : (
              <button type="button" className={styles.cancelButton} onClick={() => setCurrentStep((prev) => (Math.max(1, prev - 1) as 1 | 2 | 3 | 4 | 5))}><ChevronLeft size={16} aria-hidden="true" />Precedent</button>
            )}

            <div className={styles.footerActionsRight}>
              <button type="button" className={styles.addNowButton} onClick={handleSave} disabled={isSubmitting}><Check size={16} aria-hidden="true" />{isSubmitting ? "Modification en cours..." : "Modifier maintenant"}</button>
              <button type="submit" className={styles.continueButton} disabled={isSubmitting}><span>Continuer</span><ChevronRight size={16} aria-hidden="true" /></button>
            </div>
          </footer>
        </form>
          </>
        )}
      </section>
    </div>
  );
}

interface FieldProps {
  label: string;
  required?: boolean;
  error?: string | boolean;
  children: React.ReactNode;
}

function Field({ label, required, error, children }: FieldProps) {
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>
        {label}
        {required ? <span className={styles.requiredMark}> *</span> : null}
      </span>
      {children}
      {typeof error === "string" && error ? (
        <span style={{ color: "#ef4444", fontSize: "0.75rem", marginTop: "0.25rem", display: "block" }}>{error}</span>
      ) : null}
    </label>
  );
}
