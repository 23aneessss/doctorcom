import type { AppRouter } from "@doctor.com/api/routers/index";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import type { inferRouterOutputs } from "@trpc/server";
import { AlertCircle, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Sidebar } from "@/components/sidebar";
import { PatientHeader } from "@/components/patients/patient-header";
import { PatientList } from "@/components/patients/patient-list";
import { PatientTableHeader } from "@/components/patients/patient-table-header";
import { PatientToolbar } from "@/components/patients/patient-toolbar";
import type {
  PatientViewModel,
  PatientsFilter,
  PatientsViewMode,
} from "@/components/patients/patient-types";
import styles from "@/components/patients/patients-page.module.css";
import {
  NouveauPatientDialog,
  type NouveauPatientFormValues,
} from "@/routes/patients/popups/nouveau-patient";

import { requireSession } from "@/lib/require-session";

export const Route = createFileRoute("/patients/")({
  component: PatientsPage,
  beforeLoad: async () => {
    const session = await requireSession();
    return { session };
  },
});

type RouterOutputs = inferRouterOutputs<AppRouter>;
type SearchPatientsOutput = RouterOutputs["patient"]["searchPatients"];
type PatientRecord = SearchPatientsOutput[number];

function PatientsPage() {
  const navigate = useNavigate();
  const { session } = Route.useRouteContext();
  const { trpc } = Route.useRouteContext();
  const sessionUser = session.data?.user;
  const sidebarUser =
    sessionUser && typeof sessionUser.email === "string"
      ? {
          name: sessionUser.name?.trim() || sessionUser.email,
          email: sessionUser.email,
          avatarUrl: sessionUser.image ?? undefined,
        }
      : undefined;

  const [searchValue, setSearchValue] = useState("");
  const [filterValue, setFilterValue] = useState<PatientsFilter>("all");
  const [viewMode, setViewMode] = useState<PatientsViewMode>("vertical");
  const [isNouveauPatientOpen, setIsNouveauPatientOpen] = useState(false);
  const [nouveauPatientError, setNouveauPatientError] = useState<string | null>(null);

  const patientsQuery = useQuery(trpc.patient.searchPatients.queryOptions({}));
  const createPatientMutation = useMutation(trpc.patient.createPatient.mutationOptions());

  const patients = useMemo<PatientViewModel[]>(() => {
    return (patientsQuery.data ?? []).map((patient) => mapPatientRecord(patient));
  }, [patientsQuery.data]);

  const filteredPatients = useMemo(() => {
    const normalizedSearch = searchValue.trim().toLowerCase();

    return patients.filter((patient) => {
      const matchesSearch =
        normalizedSearch.length === 0 || patient.searchableText.includes(normalizedSearch);

      const matchesFilter =
        filterValue === "all" ||
        (filterValue === "female" && isFemale(patient.sexeText)) ||
        (filterValue === "male" && isMale(patient.sexeText)) ||
        (filterValue === "other" && !isFemale(patient.sexeText) && !isMale(patient.sexeText));

      return matchesSearch && matchesFilter;
    });
  }, [patients, searchValue, filterValue]);

  const hasActiveFilters = searchValue.trim().length > 0 || filterValue !== "all";

  const handleSeePatient = (patientId: string) => {
    void navigate({ to: "/patients/$id", params: { id: patientId } });
  };

  const handleEditPatient = (patientId: string) => {
    void navigate({ to: "/patients/$id", params: { id: patientId } });
  };

  const handleAddPatient = () => {
    setNouveauPatientError(null);
    setIsNouveauPatientOpen(true);
  };

  const handleCloseNouveauPatient = () => {
    if (createPatientMutation.isPending) {
      return;
    }

    setNouveauPatientError(null);
    setIsNouveauPatientOpen(false);
  };

  const handleAddNow = async (values: NouveauPatientFormValues) => {
    setNouveauPatientError(null);

    const dateNaissanceIso = toIsoDate(values.dateNaissance);
    if (!dateNaissanceIso) {
      setNouveauPatientError("Date de naissance invalide. Utilisez le format JJ/MM/AAAA.");
      return;
    }

    try {
      await createPatientMutation.mutateAsync({
        patient: {
          nom: values.nom.trim(),
          prenom: values.prenom.trim(),
          telephone: toOptionalText(values.telephone),
          email: toOptionalText(values.email),
          matricule: buildMatricule(values.nom, values.prenom),
          date_naissance: dateNaissanceIso,
          nss: toOptionalInteger(values.nss),
          lieu_naissance: toOptionalText(values.lieuNaissance),
          sexe: toOptionalText(values.sexe),
          nationalite: toOptionalText(values.nationalite),
          adresse: toOptionalText(values.adresseComplete),
          profession: toOptionalText(values.profession),
          situation_familiale: toOptionalText(values.situationFamiliale),
        },
      });

      toast.success("Patient ajoute avec succes.");
      setIsNouveauPatientOpen(false);
      await patientsQuery.refetch();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Impossible d'ajouter le patient.";
      setNouveauPatientError(message);
    }
  };

  const handleShowAll = () => {
    setSearchValue("");
    setFilterValue("all");
  };

  return (
    <div className={styles.pageShell}>
      <Sidebar currentUser={sidebarUser} />

      <main className={styles.pageMain}>
        <div className={styles.pageContent}>
          <PatientHeader onAddPatient={handleAddPatient} />

          <PatientToolbar
            searchValue={searchValue}
            onSearchChange={setSearchValue}
            filterValue={filterValue}
            onFilterChange={setFilterValue}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            onShowAll={handleShowAll}
          />

          {patientsQuery.isLoading ? (
            <div className={styles.statusBox}>
              <Loader2 size={22} className="animate-spin" aria-hidden="true" />
              <p className={styles.statusTitle}>Chargement des patients...</p>
            </div>
          ) : patientsQuery.isError ? (
            <div className={styles.statusBox}>
              <AlertCircle size={22} aria-hidden="true" />
              <p className={styles.statusTitle}>Impossible de charger la liste des patients</p>
              <p className={styles.statusDescription}>{patientsQuery.error.message}</p>
            </div>
          ) : filteredPatients.length === 0 ? (
            <div className={styles.statusBox}>
              <p className={styles.statusTitle}>
                {hasActiveFilters
                  ? "Aucun resultat pour vos criteres"
                  : "Aucun patient pour le moment"}
              </p>
              <p className={styles.statusDescription}>
                {hasActiveFilters
                  ? "Essayez une autre recherche ou reinitialisez le filtre."
                  : "Ajoutez votre premier patient pour commencer."}
              </p>
            </div>
          ) : viewMode === "vertical" ? (
            <div className={styles.tableViewport}>
              <PatientTableHeader />
              <PatientList
                patients={filteredPatients}
                viewMode={viewMode}
                onViewPatient={handleSeePatient}
                onEditPatient={handleEditPatient}
              />
            </div>
          ) : (
            <PatientList
              patients={filteredPatients}
              viewMode={viewMode}
              onViewPatient={handleSeePatient}
              onEditPatient={handleEditPatient}
            />
          )}
        </div>

        <NouveauPatientDialog
          open={isNouveauPatientOpen}
          onClose={handleCloseNouveauPatient}
          isSubmitting={createPatientMutation.isPending}
          submitError={nouveauPatientError}
          onContinue={() => {
            setIsNouveauPatientOpen(false);
          }}
          onAddNow={handleAddNow}
        />
      </main>
    </div>
  );
}

function toOptionalText(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function toOptionalInteger(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 0) {
    return undefined;
  }

  const parsed = Number(digits);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : undefined;
}

function toIsoDate(value: string) {
  const trimmed = value.trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const slashDateMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(trimmed);
  if (slashDateMatch) {
    const [, day, month, year] = slashDateMatch;
    return `${year}-${month}-${day}`;
  }

  return "";
}

function buildMatricule(nom: string, prenom: string) {
  const cleanBase = `${nom}${prenom}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();

  const prefix = cleanBase.slice(0, 8) || "PAT";
  const suffix = Date.now().toString().slice(-6);
  return `${prefix}-${suffix}`;
}

function mapPatientRecord(patient: PatientRecord): PatientViewModel {
  const fullName = [patient.nom, patient.prenom].filter(Boolean).join(" ").trim();
  const sexeText = formatSexLabel(patient.sexe);
  const ageText = `${computeAge(patient.date_naissance)} ans`;
  const conditionsText = extractConditionsText(patient);
  const bloodGroupText = patient.groupe_sanguin?.trim() || "N/D";
  const phoneText = patient.telephone?.trim() || "Non renseigne";
  const emailText = patient.email?.trim() || "Non renseigne";

  return {
    id: patient.id,
    fullName: fullName || "Patient inconnu",
    matricule: patient.matricule,
    initials: getInitials(patient.nom, patient.prenom),
    ageText,
    sexeText,
    phoneText,
    emailText,
    conditionsText,
    bloodGroupText,
    searchableText: [
      fullName,
      patient.matricule,
      patient.telephone,
      patient.email,
      conditionsText,
      bloodGroupText,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase(),
  };
}

function getInitials(nom: string, prenom: string) {
  const first = nom.trim().slice(0, 1);
  const second = prenom.trim().slice(0, 1);
  return `${first}${second}`.toUpperCase() || "PT";
}

function computeAge(dateNaissance: string) {
  const birthDate = new Date(dateNaissance);
  if (Number.isNaN(birthDate.getTime())) {
    return 0;
  }

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age -= 1;
  }

  return Math.max(age, 0);
}

function formatSexLabel(sexe: string | null) {
  const normalized = (sexe ?? "").trim().toLowerCase();

  if (normalized === "f" || normalized.startsWith("fem")) {
    return "Femme";
  }

  if (normalized === "m" || normalized.startsWith("mas") || normalized.startsWith("hom")) {
    return "Homme";
  }

  return sexe?.trim() || "Non renseigne";
}

function extractConditionsText(patient: PatientRecord) {
  const withConditions = patient as PatientRecord & { conditions?: string[] | null };

  if (Array.isArray(withConditions.conditions) && withConditions.conditions.length > 0) {
    return withConditions.conditions.join(", ");
  }

  return "Non renseigne";
}

function isFemale(sexeText: string) {
  const normalized = sexeText.toLowerCase();
  return normalized === "femme" || normalized.startsWith("f");
}

function isMale(sexeText: string) {
  const normalized = sexeText.toLowerCase();
  return normalized === "homme" || normalized.startsWith("m");
}