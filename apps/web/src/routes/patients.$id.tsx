import {
  createFileRoute,
  Link,
  Outlet,
  redirect,
  useLocation,
  useNavigate,
  useSearch,
} from "@tanstack/react-router";
import { useForm } from "@tanstack/react-form";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  Briefcase,
  Calendar,
  CalendarClock,
  Droplets,
  History,
  HeartPulse,
  LayoutDashboard,
  FileText,
  Plane,
  Mail,
  MapPin,
  Phone,
  Plus,
  ShieldCheck,
  Syringe,
  User,
  Wallet,
  TrendingUp,
  Package,
  House,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import Sidebar from "@/components/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { requireSession } from "@/lib/require-session";
import { formatSexLabel, isFemaleSex } from "@/lib/patient-sex";
import { NouvelleConsultationDialog } from "@/routes/patients.$id/popups/nouvelle-consultation";
import { NouveauSuiviDialog } from "@/routes/patients.$id/popups/nouveau-suivi";
import { ModifierAntecedentFamilialDialog } from "@/routes/patients.$id/popups/modifier-antecedent-familial";
import { ModifierAntecedentPersonnelDialog } from "@/routes/patients.$id/popups/modifier-antecedent-personnel";
import { NouvelAntecedentFamilialDialog } from "@/routes/patients.$id/popups/nouvel-antecedent-familial";
import { NouvelAntecedentPersonnelDialog } from "@/routes/patients.$id/popups/nouvel-antecedent-personnel";
import { AjouterTraitementDialog } from "@/routes/patients.$id/popups/ajouter-traitement";
import { ModifierTraitementDialog } from "@/routes/patients.$id/popups/modifier-traitement";
import { NouvelleOrdonnanceDialog } from "@/routes/patients.$id/popups/nouvelle-ordonnance";
import { NouvelleVaccinationDialog } from "@/routes/patients.$id/popups/nouvelle-vaccination";
import { NouveauDocumentPatientDialog } from "@/routes/patients.$id/popups/nouveau-document-patient";
import { NouveauVoyageDialog } from "@/routes/patients.$id/popups/nouveau-voyage";
import { cn } from "@/lib/utils";
import { queryClient, trpc, trpcClient } from "@/utils/trpc";

type SuiviDialogValues = {
  motif?: string;
  symptoms?: string[];
  date_ouverture?: string;
  hypothese_diagnostic?: string;
  historique?: string;
};

type ConsultationDialogValues = {
  suivi_id?: string;
  rendez_vous_id?: string;
  date?: string;
  description_consultation?: string;
  conclusion?: string;
  taille?: string;
  poids?: string;
  spo2?: string;
  tension_arterielle?: string;
  frequence_cardiaque?: string;
  temperature?: string;
  aspect_general?: string;
  examen_respiratoire?: string;
  examen_cardiovasculaire?: string;
  examen_cutane_muqueux?: string;
  examen_ganglionnaire?: string;
  examen_endocrinien?: string;
  examen_genital?: string;
  examen_urinaire?: string;
  examen_orl?: string;
  examen_digestif?: string;
};

type AntecedentPersonnelDialogValues = {
  description?: string;
  type?: string;
  details?: string;
  est_actif?: boolean;
};

type AntecedentFamilialDialogValues = {
  description?: string;
  details?: string;
  lien_parente?: string;
};

type TraitementDialogValues = {
  medicament_externe_id?: string;
  nom_medicament?: string;
  indication?: string;
  dosage?: string;
  posologie?: string;
  contre_indications?: string;
  effets_indesirables?: string;
  date_prescription?: string;
  est_actif?: boolean;
};

type OrdonnanceDialogValues = {
  mode?: "manuel" | "pre-remplie";
  suivi_id?: string;
  rendez_vous_id?: string;
  remarques?: string | null;
  medicaments?: Array<{
    medicament_externe_id: string;
    nom_medicament: string;
    dosage?: string;
    posologie: string;
    duree_traitement?: string;
    instructions?: string;
  }>;
};

type VaccinationDialogValues = {
  vaccin?: string;
  date_vaccination?: string;
  notes?: string | null;
};

type VoyageDialogValues = {
  destination?: string;
  date?: string;
  duree_jours?: number | null;
  epidemies_destination?: string | null;
};

type PatientPopupEventDetail = {
  type:
    | "suivi"
    | "consultation"
    | "antecedent-personnel"
    | "antecedent-familial"
    | "traitement"
    | "ordonnance"
    | "document"
    | "vaccination"
    | "voyage";
  mode?: "create" | "edit" | "delete";
  suiviId?: string;
  examenId?: string;
  antecedentId?: string;
  traitementId?: string;
  vaccinationId?: string;
  voyageId?: string;
  initialValues?:
    | SuiviDialogValues
    | ConsultationDialogValues
    | AntecedentPersonnelDialogValues
    | AntecedentFamilialDialogValues
    | TraitementDialogValues
    | OrdonnanceDialogValues
    | VaccinationDialogValues
    | VoyageDialogValues;
};

export const Route = createFileRoute("/patients/$id")({
  component: PatientLayout,
  pendingComponent: PatientLayoutSkeleton,
  pendingMs: 0,
  validateSearch: z.object({ edit: z.boolean().optional() }),
  beforeLoad: async () => {
    const session = await requireSession();
    return { session };
  },
});

const tabs = [
  {
    label: "Vue d'ensemble",
    to: "/patients/$id/general",
    icon: LayoutDashboard,
  },
  { label: "RDV", to: "/patients/$id/rdv", icon: CalendarClock },
  { label: "Suivis", to: "/patients/$id/suivi", icon: TrendingUp },
  { label: "Antécédents", to: "/patients/$id/antecedent", icon: History },
  { label: "Traitements", to: "/patients/$id/traitement", icon: Package },
  { label: "Documents", to: "/patients/$id/document", icon: FileText },
  { label: "Vaccinations", to: "/patients/$id/vaccination", icon: Syringe },
  { label: "Santé féminine", to: "/patients/$id/sante-feminine", icon: User },
  { label: "Infos sociales", to: "/patients/$id/info-sociale", icon: House },
  { label: "Voyages", to: "/patients/$id/voyage", icon: MapPin },
] as const;

function isMobilePlaceholderPatient(matricule: string | null | undefined) {
  return Boolean(matricule?.startsWith("mobile-slot-"));
}

function isAgendaCreatedMatricule(matricule: string | null | undefined) {
  return /^[A-Z0-9]{1,3}-\d{4}-\d{4}$/i.test((matricule ?? "").trim());
}

function isDefaultAgendaBirthDate(dateNaissance: string | null | undefined) {
  return (dateNaissance ?? "").slice(0, 10) === "1970-01-01";
}

function shouldReviewRdvCreatedPatient(patient: {
  matricule?: string | null;
  date_naissance?: string | null;
  telephone?: string | null;
  email?: string | null;
  sexe?: string | null;
  lieu_naissance?: string | null;
  nationalite?: string | null;
  nss?: string | null;
}) {
  const isGeneratedFromRdv =
    isMobilePlaceholderPatient(patient.matricule) ||
    (isAgendaCreatedMatricule(patient.matricule) &&
      isDefaultAgendaBirthDate(patient.date_naissance));

  if (!isGeneratedFromRdv) {
    return false;
  }

  const missingIdentityFields = [
    patient.telephone,
    patient.email,
    patient.sexe,
    patient.lieu_naissance,
    patient.nationalite,
  ].filter((value) => !(value ?? "").trim()).length;

  return missingIdentityFields >= 2 || !patient.nss;
}

function getPatientDisplayName(patient: {
  nom: string;
  prenom: string;
  matricule?: string | null;
}) {
  if (!isMobilePlaceholderPatient(patient.matricule)) {
    return `${patient.prenom} ${patient.nom}`.trim();
  }

  const parts = [patient.prenom, patient.nom]
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => part.toLowerCase() !== "agenda");

  return parts.join(" ").trim() || "Patient a completer";
}

function PatientLayout() {
  const { id } = Route.useParams();
  const { session } = Route.useRouteContext();
  const location = useLocation();
  const navigate = useNavigate();
  const sessionUser = session?.data?.user;
  const sidebarUser =
    sessionUser && typeof sessionUser.email === "string"
      ? {
          name: sessionUser.name?.trim() || sessionUser.email,
          email: sessionUser.email,
          avatarUrl: sessionUser.image ?? undefined,
        }
      : undefined;
  const { edit } = useSearch({ from: "/patients/$id" });
  const [isEditing, setIsEditing] = useState(edit === true);
  const [isNouveauSuiviOpen, setIsNouveauSuiviOpen] = useState(false);
  const [isNouvelleConsultationOpen, setIsNouvelleConsultationOpen] =
    useState(false);
  const [suiviDialogMode, setSuiviDialogMode] = useState<"create" | "edit">(
    "create",
  );
  const [suiviDialogId, setSuiviDialogId] = useState<string | undefined>(
    undefined,
  );
  const [suiviDialogValues, setSuiviDialogValues] = useState<
    SuiviDialogValues | undefined
  >(undefined);
  const [consultationDialogMode, setConsultationDialogMode] = useState<
    "create" | "edit"
  >("create");
  const [consultationDialogId, setConsultationDialogId] = useState<
    string | undefined
  >(undefined);
  const [consultationDialogValues, setConsultationDialogValues] = useState<
    ConsultationDialogValues | undefined
  >(undefined);
  const [isAntecedentPersonnelOpen, setIsAntecedentPersonnelOpen] =
    useState(false);
  const [isAntecedentFamilialOpen, setIsAntecedentFamilialOpen] =
    useState(false);
  const [antecedentPersonnelMode, setAntecedentPersonnelMode] = useState<
    "create" | "edit"
  >("create");
  const [antecedentFamilialMode, setAntecedentFamilialMode] = useState<
    "create" | "edit"
  >("create");
  const [antecedentPersonnelId, setAntecedentPersonnelId] = useState<
    string | undefined
  >(undefined);
  const [antecedentFamilialId, setAntecedentFamilialId] = useState<
    string | undefined
  >(undefined);
  const [antecedentPersonnelValues, setAntecedentPersonnelValues] = useState<
    AntecedentPersonnelDialogValues | undefined
  >(undefined);
  const [antecedentFamilialValues, setAntecedentFamilialValues] = useState<
    AntecedentFamilialDialogValues | undefined
  >(undefined);
  const [isTraitementOpen, setIsTraitementOpen] = useState(false);
  const [isNouvelleOrdonnanceOpen, setIsNouvelleOrdonnanceOpen] =
    useState(false);
  const [isNouveauDocumentOpen, setIsNouveauDocumentOpen] = useState(false);
  const [traitementMode, setTraitementMode] = useState<"create" | "edit">(
    "create",
  );
  const [traitementId, setTraitementId] = useState<string | undefined>(
    undefined,
  );
  const [traitementValues, setTraitementValues] = useState<
    TraitementDialogValues | undefined
  >(undefined);
  const [ordonnanceValues, setOrdonnanceValues] = useState<
    OrdonnanceDialogValues | undefined
  >(undefined);
  const [isVaccinationOpen, setIsVaccinationOpen] = useState(false);
  const [vaccinationMode, setVaccinationMode] = useState<
    "create" | "edit" | "delete"
  >("create");
  const [vaccinationId, setVaccinationId] = useState<string | undefined>(
    undefined,
  );
  const [vaccinationValues, setVaccinationValues] = useState<
    VaccinationDialogValues | undefined
  >(undefined);
  const [isVoyageOpen, setIsVoyageOpen] = useState(false);
  const [voyageMode, setVoyageMode] = useState<"create" | "edit" | "delete">(
    "create",
  );
  const [voyageId, setVoyageId] = useState<string | undefined>(undefined);
  const [voyageValues, setVoyageValues] = useState<
    VoyageDialogValues | undefined
  >(undefined);

  useEffect(() => {
    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<PatientPopupEventDetail>;
      if (customEvent.detail?.type === "suivi") {
        setSuiviDialogMode(
          customEvent.detail.mode === "edit" ? "edit" : "create",
        );
        setSuiviDialogId(customEvent.detail.suiviId);
        setSuiviDialogValues(
          (customEvent.detail.initialValues as SuiviDialogValues | undefined) ??
            undefined,
        );
        setIsNouveauSuiviOpen(true);
      }
      if (customEvent.detail?.type === "consultation") {
        setConsultationDialogMode(
          customEvent.detail.mode === "edit" ? "edit" : "create",
        );
        setConsultationDialogId(customEvent.detail.examenId);
        const initial =
          (customEvent.detail.initialValues as
            | ConsultationDialogValues
            | undefined) ?? {};
        if (
          customEvent.detail.mode !== "edit" &&
          customEvent.detail.suiviId &&
          !initial.suivi_id
        ) {
          initial.suivi_id = customEvent.detail.suiviId;
        }
        setConsultationDialogValues(
          Object.keys(initial).length > 0 ? initial : undefined,
        );
        setIsNouvelleConsultationOpen(true);
      }

      if (customEvent.detail?.type === "antecedent-personnel") {
        setAntecedentPersonnelMode(
          customEvent.detail.mode === "edit" ? "edit" : "create",
        );
        setAntecedentPersonnelId(customEvent.detail.antecedentId);
        setAntecedentPersonnelValues(
          (customEvent.detail.initialValues as
            | AntecedentPersonnelDialogValues
            | undefined) ?? undefined,
        );
        setIsAntecedentPersonnelOpen(true);
      }

      if (customEvent.detail?.type === "antecedent-familial") {
        setAntecedentFamilialMode(
          customEvent.detail.mode === "edit" ? "edit" : "create",
        );
        setAntecedentFamilialId(customEvent.detail.antecedentId);
        setAntecedentFamilialValues(
          (customEvent.detail.initialValues as
            | AntecedentFamilialDialogValues
            | undefined) ?? undefined,
        );
        setIsAntecedentFamilialOpen(true);
      }

      if (customEvent.detail?.type === "traitement") {
        setTraitementMode(
          customEvent.detail.mode === "edit" ? "edit" : "create",
        );
        setTraitementId(customEvent.detail.traitementId);
        setTraitementValues(
          (customEvent.detail.initialValues as
            | TraitementDialogValues
            | undefined) ?? undefined,
        );
        setIsTraitementOpen(true);
      }

      if (customEvent.detail?.type === "ordonnance") {
        setOrdonnanceValues(
          (customEvent.detail.initialValues as
            | OrdonnanceDialogValues
            | undefined) ?? undefined,
        );
        setIsNouvelleOrdonnanceOpen(true);
      }

      if (customEvent.detail?.type === "document") {
        setIsNouveauDocumentOpen(true);
      }

      if (customEvent.detail?.type === "vaccination") {
        setVaccinationMode(customEvent.detail.mode ?? "create");
        setVaccinationId(customEvent.detail.vaccinationId);
        setVaccinationValues(
          (customEvent.detail.initialValues as
            | VaccinationDialogValues
            | undefined) ?? undefined,
        );
        setIsVaccinationOpen(true);
      }

      if (customEvent.detail?.type === "voyage") {
        setVoyageMode(customEvent.detail.mode ?? "create");
        setVoyageId(customEvent.detail.voyageId);
        setVoyageValues(
          (customEvent.detail.initialValues as
            | VoyageDialogValues
            | undefined) ?? undefined,
        );
        setIsVoyageOpen(true);
      }
    };

    window.addEventListener("patient-popup-open", handler as EventListener);
    return () =>
      window.removeEventListener(
        "patient-popup-open",
        handler as EventListener,
      );
  }, []);

  const { data: patient } = useSuspenseQuery(
    trpc.patient.getPatient.queryOptions({ id }),
  );
  const { data: ageData } = useSuspenseQuery(
    trpc.patient.getPatientAge.queryOptions({ id }),
  );

  const updatePatientMutation = useMutation({
    mutationFn: async (data: {
      nom?: string;
      prenom?: string;
      telephone?: string | null;
      email?: string | null;
      adresse?: string | null;
      profession?: string | null;
      nationalite?: string | null;
      situation_familiale?: string | null;
      assure?: boolean;
    }) => {
      return trpcClient.patient.updatePatient.mutate({ id, data });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries(
          trpc.patient.getPatient.queryFilter({ id }),
        ),
        queryClient.invalidateQueries(
          trpc.patient.getPatientAge.queryFilter({ id }),
        ),
      ]);
      setIsEditing(false);
      toast.success("Données du patient mises à jour");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  if (!patient) {
    return <div className="p-6 text-muted-foreground">Patient non trouvé</div>;
  }

  const patientAge = ageData.age;
  const shouldReviewPatient = shouldReviewRdvCreatedPatient(patient);
  const fullName = getPatientDisplayName(patient);
  const isFemalePatient = isFemaleSex(patient.sexe);
  const sexeLabel = formatSexLabel(patient.sexe);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    return d.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const form = useForm({
    defaultValues: {
      nom: patient.nom ?? "",
      prenom: patient.prenom ?? "",
      telephone: patient.telephone ?? "",
      email: patient.email ?? "",
      adresse: patient.adresse ?? "",
      profession: patient.profession ?? "",
      nationalite: patient.nationalite ?? "",
      situation_familiale: patient.situation_familiale ?? "",
      assure: patient.assure ?? false,
    },
    validators: {
      onSubmit: z.object({
        nom: z.string().trim().min(1, "Le nom est requis").max(255),
        prenom: z.string().trim().min(1, "Le prénom est requis").max(255),
        telephone: z.string().max(32),
        email: z.union([z.literal(""), z.string().email()]),
        adresse: z.string().max(255),
        profession: z.string().max(255),
        nationalite: z.string().max(255),
        situation_familiale: z.string().max(255),
        assure: z.boolean(),
        revenu_mensuel: z.union([
          z.literal(""),
          z.string().regex(/^\d+(\.\d+)?$/, "Le revenu doit être numérique"),
        ]).optional(),
      }),
    },
    onSubmit: async ({ value }) => {
      const nextData: {
        nom?: string;
        prenom?: string;
        telephone?: string | null;
        email?: string | null;
        adresse?: string | null;
        profession?: string | null;
        nationalite?: string | null;
        situation_familiale?: string | null;
        assure?: boolean;
      } = {};

      const changedValue = (next: string, current: string | null | undefined) =>
        next.trim() !== (current ?? "").trim();

      const normalizeOptionalField = (
        next: string,
        current: string | null | undefined,
      ) => {
        if (!changedValue(next, current)) return undefined;
        const trimmed = next.trim();
        return trimmed.length > 0 ? trimmed : null;
      };

      if (changedValue(value.nom, patient.nom)) {
        nextData.nom = value.nom.trim();
      }
      if (changedValue(value.prenom, patient.prenom)) {
        nextData.prenom = value.prenom.trim();
      }

      const telephone = normalizeOptionalField(
        value.telephone,
        patient.telephone,
      );
      if (telephone !== undefined) {
        nextData.telephone = telephone;
      }

      const email = normalizeOptionalField(value.email, patient.email);
      if (email !== undefined) {
        nextData.email = email;
      }

      const adresse = normalizeOptionalField(value.adresse, patient.adresse);
      if (adresse !== undefined) {
        nextData.adresse = adresse;
      }

      const profession = normalizeOptionalField(
        value.profession,
        patient.profession,
      );
      if (profession !== undefined) {
        nextData.profession = profession;
      }

      const nationalite = normalizeOptionalField(
        value.nationalite,
        patient.nationalite,
      );
      if (nationalite !== undefined) {
        nextData.nationalite = nationalite;
      }

      const situationFamiliale = normalizeOptionalField(
        value.situation_familiale,
        patient.situation_familiale,
      );
      if (situationFamiliale !== undefined) {
        nextData.situation_familiale = situationFamiliale;
      }

      if (value.assure !== (patient.assure ?? false)) {
        nextData.assure = value.assure;
      }

      if (Object.keys(nextData).length === 0) {
        toast.info("Aucune modification détectée");
        setIsEditing(false);
        return;
      }

      await updatePatientMutation.mutateAsync(nextData);
    },
  });

  useEffect(() => {
    if (!shouldReviewPatient) {
      return;
    }

    toast.warning("Informations patient à vérifier", {
      description:
        "Ce dossier vient d'un rendez-vous créé sans patient existant. Veuillez compléter ou corriger les informations du patient.",
      action: {
        label: "Modifier",
        onClick: () => setIsEditing(true),
      },
      duration: 9000,
    });
  }, [shouldReviewPatient, patient.id]);

  const handleSuiviCreated = async () => {
    await Promise.all([
      queryClient.invalidateQueries(
        trpc.consultation.getPatientSuivis.queryFilter({ patient_id: id }),
      ),
      queryClient.invalidateQueries(
        trpc.patient.getPatientFullRecord.queryFilter({ id }),
      ),
    ]);
  };

  const handleConsultationCreated = async () => {
    await Promise.all([
      queryClient.invalidateQueries(
        trpc.patient.getPatientFullRecord.queryFilter({ id }),
      ),
      queryClient.invalidateQueries(
        trpc.consultation.getPatientSuivis.queryFilter({ patient_id: id }),
      ),
      queryClient.invalidateQueries(
        trpc.consultation.getExamensPatient.queryFilter({ patient_id: id }),
      ),
    ]);
  };

  const handleAntecedentChanged = async () => {
    await Promise.all([
      queryClient.invalidateQueries(
        trpc.medicalHistory.getAntecedentsPatient.queryFilter({
          patient_id: id,
        }),
      ),
      queryClient.invalidateQueries(
        trpc.patient.getPatientFullRecord.queryFilter({ id }),
      ),
    ]);
  };

  const handleTraitementChanged = async () => {
    await Promise.all([
      queryClient.invalidateQueries(
        trpc.treatment.getActivePatientTreatments.queryFilter({
          patient_id: id,
        }),
      ),
      queryClient.invalidateQueries(
        trpc.treatment.getPatientTreatments.queryFilter({ patient_id: id }),
      ),
      queryClient.invalidateQueries(
        trpc.patient.getPatientFullRecord.queryFilter({ id }),
      ),
    ]);
  };

  const handleOrdonnanceChanged = async () => {
    await Promise.all([
      queryClient.invalidateQueries(
        trpc.ordonnance.getOrdonnancesByPatient.queryFilter({ patientId: id }),
      ),
      queryClient.invalidateQueries(
        trpc.patient.getPatientFullRecord.queryFilter({ id }),
      ),
      queryClient.invalidateQueries(
        trpc.treatment.getActivePatientTreatments.queryFilter({
          patient_id: id,
        }),
      ),
      queryClient.invalidateQueries(
        trpc.treatment.getPatientTreatments.queryFilter({ patient_id: id }),
      ),
      queryClient.invalidateQueries(
        trpc.documents.getDocumentsByPatient.queryFilter({ patientId: id }),
      ),
      queryClient.invalidateQueries(
        trpc.documents.getLettresByPatient.queryFilter({ patientId: id }),
      ),
      queryClient.invalidateQueries(
        trpc.documents.getCertificatsByPatient.queryFilter({ patientId: id }),
      ),
    ]);
  };

  const handleDocumentChanged = async () => {
    await Promise.all([
      queryClient.invalidateQueries(
        trpc.documents.getDocumentsByPatient.queryFilter({ patientId: id }),
      ),
      queryClient.invalidateQueries(
        trpc.patient.getPatientFullRecord.queryFilter({ id }),
      ),
    ]);
  };

  const handleVaccinationChanged = async () => {
    await Promise.all([
      queryClient.invalidateQueries(
        trpc.vaccination.getPatientVaccinations.queryFilter({ patient_id: id }),
      ),
      queryClient.invalidateQueries(
        trpc.patient.getPatientFullRecord.queryFilter({ id }),
      ),
    ]);
  };

  const handleVoyageChanged = async () => {
    await Promise.all([
      queryClient.invalidateQueries(
        trpc.travel.getPatientVoyages.queryFilter({ patient_id: id }),
      ),
      queryClient.invalidateQueries(
        trpc.patient.getPatientFullRecord.queryFilter({ id }),
      ),
    ]);
  };

  return (
    <div className="flex h-screen h-svh h-dvh overflow-hidden">
      <Sidebar currentUser={sidebarUser} />

      {/* Main Content */}
      <div className="h-full min-h-0 flex-1 min-w-0 overflow-y-auto overflow-x-hidden bg-[#f8fafc] p-6 max-[58rem]:p-3">
        <div className="max-w-[1112px] mx-auto flex flex-col gap-[33px] max-[58rem]:gap-5">
          {/* Back Link */}
          <Link
            to="/patients"
            className="inline-flex items-center gap-2 text-[#052ca0] font-['Plus_Jakarta_Sans'] font-semibold text-[20px] leading-[21px] hover:opacity-80 transition-opacity"
          >
            <ArrowLeft className="size-5" />
            Retour aux patients
          </Link>

          {shouldReviewPatient ? (
            <section className="flex flex-wrap items-center justify-between gap-3 rounded-[16px] border border-[#fed7aa] bg-[#fff7ed] px-4 py-3 text-[#9a3412] shadow-[0_10px_26px_-24px_rgba(154,52,18,0.45)]">
              <div className="flex min-w-0 items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-[12px] bg-white text-[#f97316]">
                  <AlertCircle className="size-5" />
                </span>
                <div className="min-w-0">
                  <p className="m-0 font-['Plus_Jakarta_Sans'] text-[14px] font-bold leading-5">
                    Informations patient à vérifier
                  </p>
                  <p className="m-0 mt-1 font-['Inter'] text-[13px] font-medium leading-5">
                    Ce dossier a été créé automatiquement depuis un rendez-vous.
                    Complétez l'identité, le contact et les informations
                    administratives avant de poursuivre le suivi.
                  </p>
                </div>
              </div>
              <button
                className="inline-flex h-9 items-center justify-center rounded-[11px] bg-[#f97316] px-4 font-['Plus_Jakarta_Sans'] text-[12px] font-bold text-white shadow-[0_8px_18px_-14px_rgba(154,52,18,0.55)] transition hover:bg-[#ea6a13]"
                onClick={() => setIsEditing(true)}
                type="button"
              >
                Modifier maintenant
              </button>
            </section>
          ) : null}

          {/* Patient Info Card */}
          <div className="bg-white border-[0.8px] border-[#f97316] rounded-[20px] px-12 pt-6 pb-6 shadow-[0px_4px_6px_0px_rgba(201,228,241,0.2),0px_2px_4px_0px_rgba(201,228,241,0.2)] max-[58rem]:px-4">
            <div className="flex justify-between gap-8 max-[72rem]:flex-col">
              {/* Left: Identity */}
              <div className="flex w-[330px] max-w-full flex-col gap-[8px]">
                <h1 className="break-words font-['Plus_Jakarta_Sans'] font-medium text-[clamp(1.55rem,6vw,1.875rem)] leading-[1.2] text-[#0f3460]">
                  {fullName}
                </h1>
                <p className="font-['Plus_Jakarta_Sans'] text-[14px] leading-[20px] text-[rgba(100,116,139,0.9)]">
                  ID: {patient.matricule}
                </p>

                {/* Badges */}
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  {patientAge !== undefined && (
                    <span className="bg-[#c2e0ef] border-[0.8px] border-[#0f3460] rounded-[8px] px-[9px] py-[3px] font-['Poppins'] text-[12px] leading-[16px] text-[#0f3460]">
                      {patientAge} ans
                    </span>
                  )}
                  {sexeLabel && (
                    <span className="bg-[#c2e0ef] border-[0.8px] border-[#0f3460] rounded-[8px] px-[9px] py-[3px] font-['Poppins'] text-[12px] leading-[16px] text-[#0f3460]">
                      {sexeLabel}
                    </span>
                  )}
                  {patient.groupe_sanguin && (
                    <span className="bg-[#fff7ed] border-[0.8px] border-[#f97316] rounded-[8px] px-[9px] py-[3px] font-['Poppins'] text-[12px] leading-[16px] text-[#f97316] flex items-center gap-1">
                      <Droplets className="size-3" />
                      {patient.groupe_sanguin}
                    </span>
                  )}
                </div>

                {/* Contact rows */}
                <div className="mt-1 flex max-w-[320px] max-[40rem]:max-w-full flex-col gap-[8px]">
                  <div className="flex items-center gap-2">
                    <User className="size-4 text-[#265284]" />
                    {isEditing ? (
                      <div className="flex flex-wrap items-start gap-2">
                        <form.Field name="nom">
                          {(field) => (
                            <div>
                              <input
                                className="h-8 w-[132px] max-w-full rounded-md border border-[#c2e0ef] bg-white px-2 font-['Poppins'] text-[14px] leading-[20px] text-[#265284]"
                                value={field.state.value}
                                onBlur={field.handleBlur}
                                onChange={(e) =>
                                  field.handleChange(e.target.value)
                                }
                                aria-label="Nom"
                              />
                              {field.state.meta.errors[0]?.message ? (
                                <p className="text-xs text-red-600">
                                  {field.state.meta.errors[0].message}
                                </p>
                              ) : null}
                            </div>
                          )}
                        </form.Field>
                        <form.Field name="prenom">
                          {(field) => (
                            <div>
                              <input
                                className="h-8 w-[132px] max-w-full rounded-md border border-[#c2e0ef] bg-white px-2 font-['Poppins'] text-[14px] leading-[20px] text-[#265284]"
                                value={field.state.value}
                                onBlur={field.handleBlur}
                                onChange={(e) =>
                                  field.handleChange(e.target.value)
                                }
                                aria-label="Prénom"
                              />
                              {field.state.meta.errors[0]?.message ? (
                                <p className="text-xs text-red-600">
                                  {field.state.meta.errors[0].message}
                                </p>
                              ) : null}
                            </div>
                          )}
                        </form.Field>
                      </div>
                    ) : (
                      <span className="font-['Poppins'] text-[14px] leading-[20px] text-[#265284]">
                        {fullName}
                      </span>
                    )}
                  </div>

                  <form.Field name="telephone">
                    {(field) => (
                      <div className="flex items-center gap-2">
                        <Phone className="size-4 text-[#265284]" />
                        {isEditing ? (
                          <div>
                            <input
                              className="h-8 rounded-md border border-[#c2e0ef] bg-white px-2 font-['Poppins'] text-[14px] leading-[20px] text-[#265284]"
                              value={field.state.value}
                              onBlur={field.handleBlur}
                              onChange={(e) =>
                                field.handleChange(e.target.value)
                              }
                            />
                            {field.state.meta.errors[0]?.message ? (
                              <p className="text-xs text-red-600">
                                {field.state.meta.errors[0].message}
                              </p>
                            ) : null}
                          </div>
                        ) : (
                          <span className="font-['Poppins'] text-[14px] leading-[20px] text-[#265284]">
                            {patient.telephone ?? "—"}
                          </span>
                        )}
                      </div>
                    )}
                  </form.Field>
                  <form.Field name="email">
                    {(field) => (
                      <div className="flex items-center gap-2">
                        <Mail className="size-4 text-[#265284]" />
                        {isEditing ? (
                          <div>
                            <input
                              className="h-8 rounded-md border border-[#c2e0ef] bg-white px-2 font-['Plus_Jakarta_Sans'] text-[14px] leading-[20px] text-[#265284]"
                              value={field.state.value}
                              onBlur={field.handleBlur}
                              onChange={(e) =>
                                field.handleChange(e.target.value)
                              }
                            />
                            {field.state.meta.errors[0]?.message ? (
                              <p className="text-xs text-red-600">
                                {field.state.meta.errors[0].message}
                              </p>
                            ) : null}
                          </div>
                        ) : (
                          <span className="font-['Plus_Jakarta_Sans'] text-[14px] leading-[20px] text-[#265284]">
                            {patient.email ?? "—"}
                          </span>
                        )}
                      </div>
                    )}
                  </form.Field>
                  <form.Field name="adresse">
                    {(field) => (
                      <div className="flex items-center gap-2">
                        <MapPin className="size-4 text-[#265284]" />
                        {isEditing ? (
                          <div>
                            <input
                              className="h-8 w-[260px] max-w-full rounded-md border border-[#c2e0ef] bg-white px-2 font-['Plus_Jakarta_Sans'] text-[14px] leading-[20px] text-[#265284]"
                              value={field.state.value}
                              onBlur={field.handleBlur}
                              onChange={(e) =>
                                field.handleChange(e.target.value)
                              }
                            />
                            {field.state.meta.errors[0]?.message ? (
                              <p className="text-xs text-red-600">
                                {field.state.meta.errors[0].message}
                              </p>
                            ) : null}
                          </div>
                        ) : (
                          <span className="font-['Plus_Jakarta_Sans'] text-[14px] leading-[20px] text-[#265284]">
                            {patient.adresse ?? "—"}
                          </span>
                        )}
                      </div>
                    )}
                  </form.Field>
                </div>

                {/* Profession */}
                <form.Field name="profession">
                  {(field) => (
                    <div className="flex items-center gap-2 mt-1">
                      <Briefcase className="size-4 text-[#265284]" />
                      {isEditing ? (
                        <div>
                          <input
                            className="h-8 rounded-md border border-[#c2e0ef] bg-white px-2 font-['Plus_Jakarta_Sans'] text-[14px] leading-[20px] text-[#265284]"
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(e) => field.handleChange(e.target.value)}
                          />
                          {field.state.meta.errors[0]?.message ? (
                            <p className="text-xs text-red-600">
                              {field.state.meta.errors[0].message}
                            </p>
                          ) : null}
                        </div>
                      ) : (
                        <span className="font-['Plus_Jakarta_Sans'] text-[14px] leading-[20px] text-[#265284]">
                          {patient.profession ?? "—"}
                        </span>
                      )}
                    </div>
                  )}
                </form.Field>
              </div>

              {/* Center: Medical Info */}
              <div className="flex flex-col gap-[8px] justify-center">
                <PatientInfoRow
                  icon={<ShieldCheck className="size-4" />}
                  label="NSS :"
                  value={patient.nss ? String(patient.nss) : "—"}
                />
                <PatientInfoRow
                  icon={<Calendar className="size-4" />}
                  label="Date de naissance :"
                  value={formatDate(patient.date_naissance)}
                />
                <PatientInfoRow
                  icon={<MapPin className="size-4" />}
                  label="Lieu de naissance :"
                  value={patient.lieu_naissance ?? "—"}
                />
                <PatientInfoRow
                  icon={<User className="size-4" />}
                  label="Nationalité :"
                  value={
                    isEditing ? (
                      <form.Field name="nationalite">
                        {(field) => (
                          <div>
                            <input
                              className="h-8 rounded-md border border-[#c2e0ef] bg-white px-2 font-['Poppins'] text-[14px] leading-[20px] text-[#265284]"
                              value={field.state.value}
                              onBlur={field.handleBlur}
                              onChange={(e) =>
                                field.handleChange(e.target.value)
                              }
                            />
                            {field.state.meta.errors[0]?.message ? (
                              <p className="text-xs text-red-600">
                                {field.state.meta.errors[0].message}
                              </p>
                            ) : null}
                          </div>
                        )}
                      </form.Field>
                    ) : (
                      (patient.nationalite ?? "—")
                    )
                  }
                />
                <PatientInfoRow
                  icon={<User className="size-4" />}
                  label="Situation familiale :"
                  value={
                    isEditing ? (
                      <form.Field name="situation_familiale">
                        {(field) => (
                          <div>
                            <input
                              className="h-8 rounded-md border border-[#c2e0ef] bg-white px-2 font-['Poppins'] text-[14px] leading-[20px] text-[#265284]"
                              value={field.state.value}
                              onBlur={field.handleBlur}
                              onChange={(e) =>
                                field.handleChange(e.target.value)
                              }
                            />
                            {field.state.meta.errors[0]?.message ? (
                              <p className="text-xs text-red-600">
                                {field.state.meta.errors[0].message}
                              </p>
                            ) : null}
                          </div>
                        )}
                      </form.Field>
                    ) : (
                      (patient.situation_familiale ?? "—")
                    )
                  }
                />
                <PatientInfoRow
                  icon={<Wallet className="size-4" />}
                  label={"Assur\u00e9 :"}
                  value={
                    isEditing ? (
                      <form.Field name="assure">
                        {(field) => (
                          <label className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-full border border-[#c2e0ef] bg-[#f8fbff] px-2.5 font-['Poppins'] text-[13px] font-medium leading-[20px] text-[#265284]">
                            <input
                              className="peer sr-only"
                              checked={field.state.value}
                              onBlur={field.handleBlur}
                              onChange={(e) =>
                                field.handleChange(e.target.checked)
                              }
                              type="checkbox"
                            />
                            <span className="relative h-4 w-7 rounded-full bg-[#dbeaf3] transition-colors peer-checked:bg-[#76bbdd] after:absolute after:left-0.5 after:top-0.5 after:size-3 after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-checked:after:translate-x-3" />
                            {field.state.value ? "Oui" : "Non"}
                          </label>
                        )}
                      </form.Field>
                    ) : patient.assure ? (
                      "Oui"
                    ) : (
                      "—"
                    )
                  }
                />

                {/* Divider */}
                <div className="border-t-[0.8px] border-[#c2e0ef] pt-[8px]">
                  <PatientInfoRow
                    icon={<Calendar className="size-4" />}
                    label="Date d'admission :"
                    value={formatDate(patient.date_admission)}
                  />
                </div>
              </div>

              {/* Right: Action Buttons */}
              <div className="flex flex-col gap-[8px] justify-center">
                {!isEditing ? (
                  <button
                    className="flex items-center justify-center bg-white border border-[#c2e0ef] rounded-[10px] h-[40px] w-[240px] max-w-full px-[16px] text-center whitespace-nowrap font-['Plus_Jakarta_Sans'] font-semibold text-[14px] leading-[16px] text-[#0f3460] hover:bg-[#f8fafc] transition-colors max-[40rem]:w-full"
                    onClick={() => {
                      form.reset({
                        nom: patient.nom ?? "",
                        prenom: patient.prenom ?? "",
                        telephone: patient.telephone ?? "",
                        email: patient.email ?? "",
                        adresse: patient.adresse ?? "",
                        profession: patient.profession ?? "",
                        nationalite: patient.nationalite ?? "",
                        situation_familiale: patient.situation_familiale ?? "",
                        assure: patient.assure ?? false,
                      });
                      setIsEditing(true);
                    }}
                    type="button"
                  >
                    Modifier
                  </button>
                ) : (
                  <>
                    <button
                      className="flex items-center justify-start bg-white border border-[#c2e0ef] rounded-[10px] h-[40px] w-[240px] max-w-full px-[16px] text-left whitespace-nowrap font-['Plus_Jakarta_Sans'] font-semibold text-[14px] leading-[16px] text-[#0f3460] hover:bg-[#f8fafc] transition-colors max-[40rem]:w-full"
                      onClick={() => setIsEditing(false)}
                      type="button"
                    >
                      Annuler
                    </button>
                    <button
                      className="flex items-center justify-start bg-[#f97316] rounded-[10px] h-[40px] w-[240px] max-w-full px-[16px] text-left whitespace-nowrap font-['Plus_Jakarta_Sans'] font-semibold text-[14px] leading-[16px] text-white hover:bg-[#ea6a13] transition-colors max-[40rem]:w-full"
                      onClick={() => form.handleSubmit()}
                      disabled={updatePatientMutation.isPending}
                      type="button"
                    >
                      {updatePatientMutation.isPending
                        ? "Enregistrement..."
                        : "Enregistrer"}
                    </button>
                  </>
                )}
                <ActionButton
                  label="Ajouter suivi"
                  layout="suivi"
                  specialIcon={<SuiviIcon />}
                  onClick={() => {
                    setSuiviDialogMode("create");
                    setSuiviDialogId(undefined);
                    setSuiviDialogValues(undefined);
                    setIsNouveauSuiviOpen(true);
                  }}
                />
                <ActionButton
                  label="Ajouter consultation"
                  layout="centered"
                  specialIcon={<ConsultationIcon />}
                  onClick={() => {
                    setConsultationDialogMode("create");
                    setConsultationDialogId(undefined);
                    setConsultationDialogValues(undefined);
                    setIsNouvelleConsultationOpen(true);
                  }}
                />
                <ActionButton
                  label="Ajouter documents"
                  layout="centered"
                  specialIcon={<DocumentsIcon />}
                  onClick={() => {
                    setIsNouveauDocumentOpen(true);
                  }}
                />
                <ActionButton
                  label="Ajouter rendez-vous"
                  layout="centered"
                  specialIcon={<RendezVousIcon />}
                  onClick={() => {
                    window.sessionStorage.setItem(
                      `doctor-com-open-patient-rdv-${id}`,
                      "1",
                    );
                    window.dispatchEvent(
                      new CustomEvent("patient-rdv-create-request", {
                        detail: { patientId: id },
                      }),
                    );
                    void navigate({ to: "/patients/$id/rdv", params: { id } });
                  }}
                />
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="overflow-hidden rounded-[14px] border-[0.8px] border-[#c2e0ef] bg-white p-[10px]">
            <div
              className={cn(
                "scrollbar-hide flex w-full max-w-full items-center overflow-x-auto overflow-y-hidden overscroll-x-contain touch-pan-x px-1",
                isFemalePatient
                  ? "justify-start gap-1"
                  : "justify-center gap-3",
              )}
            >
              {tabs
                .filter(
                  (tab) =>
                    tab.to !== "/patients/$id/sante-feminine" ||
                    isFemalePatient,
                )
                .map((tab) => {
                  const tabPath = tab.to.replace("$id", id);
                  const isActive = location.pathname === tabPath;
                  return (
                    <Link
                      key={tab.to}
                      to={tab.to}
                      params={{ id }}
                      className={cn(
                        "inline-flex shrink-0 items-center gap-[6px] rounded-[14px] px-3 py-1.5 font-['Plus_Jakarta_Sans'] font-medium text-[12px] leading-[16px] whitespace-nowrap transition-colors",
                        isActive
                          ? "bg-[#f97316] text-white"
                          : "text-[#0f3460] hover:bg-[#f8fafc]",
                      )}
                    >
                      <tab.icon
                        className="size-4 shrink-0 text-current"
                        strokeWidth={1.75}
                      />
                      <span>{tab.label}</span>
                    </Link>
                  );
                })}
            </div>
          </div>

          {/* Child Route Content */}
          <Outlet />

          <NouveauSuiviDialog
            mode={suiviDialogMode}
            onCreated={handleSuiviCreated}
            onOpenChange={(nextOpen) => {
              setIsNouveauSuiviOpen(nextOpen);
              if (!nextOpen) {
                setSuiviDialogMode("create");
                setSuiviDialogId(undefined);
                setSuiviDialogValues(undefined);
              }
            }}
            open={isNouveauSuiviOpen}
            patientId={id}
            suiviId={suiviDialogId}
            values={suiviDialogValues}
          />

          <NouvelleConsultationDialog
            examenId={consultationDialogId}
            mode={consultationDialogMode}
            onCreated={handleConsultationCreated}
            onOpenChange={(nextOpen) => {
              setIsNouvelleConsultationOpen(nextOpen);
              if (!nextOpen) {
                setConsultationDialogMode("create");
                setConsultationDialogId(undefined);
                setConsultationDialogValues(undefined);
              }
            }}
            open={isNouvelleConsultationOpen}
            patientId={id}
            values={consultationDialogValues}
          />

          {antecedentPersonnelMode === "create" ? (
            <NouvelAntecedentPersonnelDialog
              onCreated={handleAntecedentChanged}
              onOpenChange={(nextOpen) => {
                setIsAntecedentPersonnelOpen(nextOpen);
                if (!nextOpen) {
                  setAntecedentPersonnelMode("create");
                  setAntecedentPersonnelId(undefined);
                  setAntecedentPersonnelValues(undefined);
                }
              }}
              open={isAntecedentPersonnelOpen}
              patientId={id}
              values={antecedentPersonnelValues}
            />
          ) : (
            <ModifierAntecedentPersonnelDialog
              antecedentId={antecedentPersonnelId}
              onCreated={handleAntecedentChanged}
              onOpenChange={(nextOpen) => {
                setIsAntecedentPersonnelOpen(nextOpen);
                if (!nextOpen) {
                  setAntecedentPersonnelMode("create");
                  setAntecedentPersonnelId(undefined);
                  setAntecedentPersonnelValues(undefined);
                }
              }}
              open={isAntecedentPersonnelOpen}
              values={antecedentPersonnelValues}
            />
          )}

          {antecedentFamilialMode === "create" ? (
            <NouvelAntecedentFamilialDialog
              onCreated={handleAntecedentChanged}
              onOpenChange={(nextOpen) => {
                setIsAntecedentFamilialOpen(nextOpen);
                if (!nextOpen) {
                  setAntecedentFamilialMode("create");
                  setAntecedentFamilialId(undefined);
                  setAntecedentFamilialValues(undefined);
                }
              }}
              open={isAntecedentFamilialOpen}
              patientId={id}
              values={antecedentFamilialValues}
            />
          ) : (
            <ModifierAntecedentFamilialDialog
              antecedentId={antecedentFamilialId}
              onCreated={handleAntecedentChanged}
              onOpenChange={(nextOpen) => {
                setIsAntecedentFamilialOpen(nextOpen);
                if (!nextOpen) {
                  setAntecedentFamilialMode("create");
                  setAntecedentFamilialId(undefined);
                  setAntecedentFamilialValues(undefined);
                }
              }}
              open={isAntecedentFamilialOpen}
              values={antecedentFamilialValues}
            />
          )}

          {traitementMode === "create" ? (
            <AjouterTraitementDialog
              onCreated={handleTraitementChanged}
              onOpenChange={(nextOpen) => {
                setIsTraitementOpen(nextOpen);
                if (!nextOpen) {
                  setTraitementMode("create");
                  setTraitementId(undefined);
                  setTraitementValues(undefined);
                }
              }}
              open={isTraitementOpen}
              patientId={id}
              values={traitementValues}
            />
          ) : (
            <ModifierTraitementDialog
              onCreated={handleTraitementChanged}
              onOpenChange={(nextOpen) => {
                setIsTraitementOpen(nextOpen);
                if (!nextOpen) {
                  setTraitementMode("create");
                  setTraitementId(undefined);
                  setTraitementValues(undefined);
                }
              }}
              open={isTraitementOpen}
              traitementId={traitementId}
              values={traitementValues}
            />
          )}

          <NouvelleOrdonnanceDialog
            onCreated={handleOrdonnanceChanged}
            onOpenChange={(nextOpen) => {
              setIsNouvelleOrdonnanceOpen(nextOpen);
              if (!nextOpen) {
                setOrdonnanceValues(undefined);
              }
            }}
            open={isNouvelleOrdonnanceOpen}
            patientId={id}
            values={ordonnanceValues}
          />

          <NouveauDocumentPatientDialog
            onCreated={handleDocumentChanged}
            onOpenChange={setIsNouveauDocumentOpen}
            open={isNouveauDocumentOpen}
            patientId={id}
          />

          <NouvelleVaccinationDialog
            mode={vaccinationMode}
            onCreated={handleVaccinationChanged}
            onOpenChange={(nextOpen) => {
              setIsVaccinationOpen(nextOpen);
              if (!nextOpen) {
                setVaccinationMode("create");
                setVaccinationId(undefined);
                setVaccinationValues(undefined);
              }
            }}
            open={isVaccinationOpen}
            patientId={id}
            vaccinationId={vaccinationId}
            values={vaccinationValues}
          />

          <NouveauVoyageDialog
            mode={voyageMode}
            onCreated={handleVoyageChanged}
            onOpenChange={(nextOpen) => {
              setIsVoyageOpen(nextOpen);
              if (!nextOpen) {
                setVoyageMode("create");
                setVoyageId(undefined);
                setVoyageValues(undefined);
              }
            }}
            open={isVoyageOpen}
            patientId={id}
            voyageId={voyageId}
            values={voyageValues}
          />
        </div>
      </div>
    </div>
  );
}

function PatientLayoutSkeleton() {
  return (
    <div className="flex h-screen h-svh h-dvh overflow-hidden">
      <Sidebar />

      <div className="h-full min-h-0 flex-1 min-w-0 overflow-y-auto overflow-x-hidden bg-[#f8fafc] p-6 max-[58rem]:p-3">
        <div className="max-w-[1112px] mx-auto flex flex-col gap-[33px] max-[58rem]:gap-5">
          <Skeleton className="h-7 w-56 rounded-md" />

          <Skeleton className="h-[360px] rounded-[20px]" />

          <div className="overflow-hidden rounded-[14px] border-[0.8px] border-[#c2e0ef] bg-white p-[10px]">
            <div className="flex w-full items-center gap-2 overflow-hidden px-1">
              {Array.from({ length: 9 }).map((_, index) => (
                <Skeleton
                  key={index}
                  className="h-8 w-28 shrink-0 rounded-[14px]"
                />
              ))}
            </div>
          </div>

          <div className="flex items-start gap-6 max-[72rem]:flex-col">
            <div className="flex flex-1 flex-col gap-6">
              <Skeleton className="h-[298px] rounded-[14px]" />
              <Skeleton className="h-[360px] rounded-[14px]" />
            </div>
            <div className="w-[360px] max-w-full space-y-6">
              <Skeleton className="h-[286px] rounded-[14px]" />
              <Skeleton className="h-[286px] rounded-[14px]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PatientInfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-[8px]">
      <div className="text-[#265284] shrink-0">{icon}</div>
      <span className="font-['Plus_Jakarta_Sans'] text-[14px] leading-[20px] text-[rgba(100,116,139,0.9)]">
        {label}
      </span>
      <span className="min-w-0 break-words font-['Poppins'] text-[14px] leading-[20px] text-[#265284]">
        {value}
      </span>
    </div>
  );
}

function ActionButton({
  label,
  layout,
  specialIcon,
  onClick,
}: {
  label: string;
  layout: "suivi" | "centered";
  specialIcon: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "bg-[#c2e0ef] rounded-[10px] h-[45px] w-[240px] max-w-full px-[16px] text-left whitespace-nowrap font-['Plus_Jakarta_Sans'] font-semibold text-[14px] leading-[16px] text-[#0f3460] hover:bg-[#b0d4e8] transition-colors max-[40rem]:w-full",
        layout === "suivi"
          ? "flex items-center"
          : "flex items-center justify-start",
      )}
      type="button"
    >
      {layout === "suivi" ? (
        <>
          <div className="flex items-center gap-[10px]">
            <Plus className="size-[14px] shrink-0" />
            <span>{label}</span>
          </div>
          <div className="ml-auto size-[14px] shrink-0">{specialIcon}</div>
        </>
      ) : (
        <>
          <div className="flex items-center gap-[10px]">
            <Plus className="size-[14px] shrink-0" />
            <span>{label}</span>
          </div>
          <div className="ml-auto size-[14px] shrink-0">{specialIcon}</div>
        </>
      )}
    </button>
  );
}

function SuiviIcon() {
  return (
    <svg viewBox="0 0 14 14" fill="none" className="size-full text-[#0f3460]">
      <path
        d="M12.8333 4.08333L7.875 9.04167L4.95833 6.125L1.16667 9.91667"
        stroke="currentColor"
        strokeWidth="1.16667"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9.33333 4.08333H12.8333V7.58333"
        stroke="currentColor"
        strokeWidth="1.16667"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ConsultationIcon() {
  return (
    <svg viewBox="0 0 14 14" fill="none" className="size-full text-[#0f3460]">
      <path
        d="M8.75 1.16667H3.5C3.19058 1.16667 2.89383 1.28958 2.67504 1.50838C2.45625 1.72717 2.33333 2.02391 2.33333 2.33333V11.6667C2.33333 11.9761 2.45625 12.2728 2.67504 12.4916C2.89383 12.7104 3.19058 12.8333 3.5 12.8333H10.5C10.8094 12.8333 11.1062 12.7104 11.325 12.4916C11.5437 12.2728 11.6667 11.9761 11.6667 11.6667V4.08333L8.75 1.16667Z"
        stroke="currentColor"
        strokeWidth="1.16667"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8.16667 1.16667V3.5C8.16667 3.80942 8.28958 4.10617 8.50838 4.32496C8.72717 4.54375 9.02391 4.66667 9.33333 4.66667H11.6667"
        stroke="currentColor"
        strokeWidth="1.16667"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5.83333 5.25H4.66667"
        stroke="currentColor"
        strokeWidth="1.16667"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9.33333 7.58333H4.66667"
        stroke="currentColor"
        strokeWidth="1.16667"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9.33333 9.91667H4.66667"
        stroke="currentColor"
        strokeWidth="1.16667"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DocumentsIcon() {
  return (
    <svg viewBox="0 0 14 14" fill="none" className="size-full text-[#0f3460]">
      <path
        d="M3.5 8.16667L4.375 6.475C4.47013 6.28608 4.61482 6.12658 4.79361 6.01355C4.97239 5.90053 5.17854 5.83823 5.39 5.83333H11.6667M11.6667 5.83333C11.8449 5.83302 12.0208 5.87355 12.181 5.9518C12.3411 6.03005 12.4812 6.14395 12.5904 6.28476C12.6997 6.42556 12.7752 6.58953 12.8113 6.76407C12.8473 6.93862 12.8429 7.1191 12.7983 7.29167L11.9 10.7917C11.835 11.0434 11.6878 11.2662 11.4817 11.4248C11.2756 11.5833 11.0225 11.6684 10.7625 11.6667H2.33333C2.02391 11.6667 1.72717 11.5437 1.50838 11.325C1.28958 11.1062 1.16667 10.8094 1.16667 10.5V2.91667C1.16667 2.60725 1.28958 2.3105 1.50838 2.09171C1.72717 1.87292 2.02391 1.75 2.33333 1.75H4.60833C4.80345 1.74809 4.99593 1.79514 5.16816 1.88686C5.34038 1.97858 5.48686 2.11203 5.59417 2.275L6.06667 2.975C6.1729 3.13631 6.31751 3.26872 6.48754 3.36035C6.65757 3.45198 6.84769 3.49997 7.04083 3.5H10.5C10.8094 3.5 11.1062 3.62292 11.325 3.84171C11.5437 4.0605 11.6667 4.35725 11.6667 4.66667V5.83333Z"
        stroke="currentColor"
        strokeWidth="1.16667"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RendezVousIcon() {
  return (
    <svg viewBox="0 0 14 14" fill="none" className="size-full text-[#0f3460]">
      <path
        d="M4.66667 1.16667V3.5"
        stroke="currentColor"
        strokeWidth="1.16667"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9.33333 1.16667V3.5"
        stroke="currentColor"
        strokeWidth="1.16667"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12.25 7.58333V3.5C12.25 3.19058 12.1271 2.89383 11.9083 2.67504C11.6895 2.45625 11.3928 2.33333 11.0833 2.33333H2.91667C2.60725 2.33333 2.3105 2.45625 2.09171 2.67504C1.87292 2.89383 1.75 3.19058 1.75 3.5V11.6667C1.75 11.9761 1.87292 12.2728 2.09171 12.4916C2.3105 12.7104 2.60725 12.8333 2.91667 12.8333H7.58333"
        stroke="currentColor"
        strokeWidth="1.16667"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M1.75 5.83333H12.25"
        stroke="currentColor"
        strokeWidth="1.16667"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9.33333 11.0833H12.8333"
        stroke="currentColor"
        strokeWidth="1.16667"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M11.0833 9.33333V12.8333"
        stroke="currentColor"
        strokeWidth="1.16667"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
