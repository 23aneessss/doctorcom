import type { AppRouter } from "@doctor.com/api/routers/index";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { TRPCClientError } from "@trpc/client";
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
  type NouveauPatientSubmissionValues,
} from "@/components/patients/popups/nouveau-patient-dialog";
import { PatientCreatedSuccessModal } from "../../components/patients/popups/patient-created-success-modal";

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
  const { trpc, queryClient } = Route.useRouteContext();
  const sessionUser = session?.data?.user;
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
  const [nouveauPatientError, setNouveauPatientError] = useState<string | null>(
    null,
  );
  const [createdPatientName, setCreatedPatientName] = useState<string>("");
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);

  const patientsQuery = useQuery(trpc.patient.searchPatients.queryOptions({}));
  const createPatientMutation = useMutation(
    trpc.patient.createPatient.mutationOptions(),
  );
  const addAntecedentMutation = useMutation(
    trpc.medicalHistory.ajouterAntecedent.mutationOptions(),
  );
  const startTreatmentMutation = useMutation(
    trpc.treatment.startTreatment.mutationOptions(),
  );
  const isSubmittingPatientFlow =
    createPatientMutation.isPending ||
    addAntecedentMutation.isPending ||
    startTreatmentMutation.isPending;

  const patients = useMemo<PatientViewModel[]>(() => {
    return (patientsQuery.data ?? []).map((patient) =>
      mapPatientRecord(patient),
    );
  }, [patientsQuery.data]);

  const filteredPatients = useMemo(() => {
    const normalizedSearch = searchValue.trim().toLowerCase();

    return patients.filter((patient) => {
      const matchesSearch =
        normalizedSearch.length === 0 ||
        patient.searchableText.includes(normalizedSearch);

      const matchesFilter =
        filterValue === "all" ||
        (filterValue === "female" && isFemale(patient.sexeText)) ||
        (filterValue === "male" && isMale(patient.sexeText)) ||
        (filterValue === "other" &&
          !isFemale(patient.sexeText) &&
          !isMale(patient.sexeText));

      return matchesSearch && matchesFilter;
    });
  }, [patients, searchValue, filterValue]);

  const hasActiveFilters =
    searchValue.trim().length > 0 || filterValue !== "all";

  const handleSeePatient = (patientId: string) => {
    void navigate({ to: "/patients/$id/general", params: { id: patientId } });
  };

  const handleEditPatient = (patientId: string) => {
    void navigate({ to: "/patients/$id/general", params: { id: patientId } });
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

  const handleSubmitPatient = async (values: NouveauPatientSubmissionValues) => {
    setNouveauPatientError(null);

    const dateNaissanceIso = toIsoDate(values.dateNaissance);
    if (!dateNaissanceIso) {
      setNouveauPatientError(
        "Date de naissance invalide. Utilisez le format JJ/MM/AAAA.",
      );
      return;
    }

    try {
      const createdPatient = await createPatientMutation.mutateAsync({
        patient: {
          nom: values.nom.trim(),
          prenom: values.prenom.trim(),
          telephone: toOptionalText(values.telephone),
          email: toOptionalText(values.email),
          matricule: buildMatricule(
            values.nom,
            values.prenom,
            (patientsQuery.data?.length ?? 0) + 1,
          ),
          date_naissance: dateNaissanceIso,
          nss: toOptionalInteger(values.nss),
          lieu_naissance: toOptionalText(values.lieuNaissance),
          sexe: toOptionalText(values.sexe),
          nationalite: toOptionalText(values.nationalite),
          groupe_sanguin: toOptionalText(values.groupeSanguin),
          adresse: toOptionalText(values.adresseComplete),
          profession: toOptionalText(values.socialProfession) ?? toOptionalText(values.profession),
          habitudes_saines: toOptionalText(values.habitudesSaines),
          habitudes_toxiques: toOptionalText(values.habitudesToxiques),
          nb_enfants: values.nombreEnfants,
          situation_familiale:
            toOptionalText(values.socialSituationFamiliale) ??
            toOptionalText(values.situationFamiliale),
          age_circoncision: isMale(values.sexe) ? toOptionalInteger(values.ageCirconcision) : undefined,
          environnement_animal: toOptionalText(values.environnementAnimal),
          revenu_mensuel: toOptionalText(values.revenuMensuel),
          taille_menage: values.tailleMenages,
          nb_pieces: values.nombreDePieces,
          relations_environnement: toOptionalText(values.relationsEnvironnementales),
        },
      });

      const partialFailures: string[] = [];

      for (const entry of values.personalAntecedents) {
        if (!entry.type.trim() && !entry.details.trim()) {
          continue;
        }

        try {
          await addAntecedentMutation.mutateAsync({
            patient_id: createdPatient.id,
            type: "personnel",
            description: entry.details.trim() || entry.type.trim(),
            personnel: {
              type: entry.type.trim(),
              details: entry.details.trim() || null,
              est_actif: entry.maladieActive,
            },
          });
        } catch (error) {
          partialFailures.push(
            `Antecedent personnel \"${entry.type.trim() || "sans titre"}\": ${getMutationErrorMessage(error)}`,
          );
        }
      }

      for (const entry of values.familyAntecedents) {
        if (!entry.lienParente.trim() && !entry.pathologie.trim()) {
          continue;
        }

        try {
          await addAntecedentMutation.mutateAsync({
            patient_id: createdPatient.id,
            type: "familial",
            description: entry.pathologie.trim() || "Antecedent familial",
            familial: {
              details: entry.pathologie.trim() || null,
              lien_parente: entry.lienParente.trim() || null,
            },
          });
        } catch (error) {
          partialFailures.push(
            `Antecedent familial \"${entry.lienParente.trim() || "sans lien"}\": ${getMutationErrorMessage(error)}`,
          );
        }
      }

      const treatmentsToCreate = values.traitements.filter((entry) =>
        [entry.medicament, entry.dosage, entry.indication, entry.posologie]
          .some((field) => field.trim().length > 0),
      );

      for (const entry of treatmentsToCreate) {
        if (!entry.medicament.trim() || !entry.posologie.trim()) {
          partialFailures.push(
            `Traitement \"${entry.medicament.trim() || "sans medicament"}\": medicament et posologie sont obligatoires.`,
          );
          continue;
        }

        try {
          const medicationsSearch = await queryClient.fetchQuery(
            trpc.medicaments.rechercherMedicaments.queryOptions({
              query: entry.medicament.trim(),
              page: 1,
              page_size: 1,
            }),
          );

          const matchedMedication = medicationsSearch.items[0];
          if (!matchedMedication) {
            partialFailures.push(
              `Traitement \"${entry.medicament.trim()}\": medicament introuvable dans la base.`,
            );
            continue;
          }

          await startTreatmentMutation.mutateAsync({
            patient_id: createdPatient.id,
            medicament_externe_id: String(matchedMedication.id),
            dosage: toOptionalText(entry.dosage) ?? null,
            posologie: entry.posologie.trim(),
            date_prescription: new Date().toISOString().slice(0, 10),
            est_actif: entry.maladieActive,
          });
        } catch (error) {
          partialFailures.push(
            `Traitement \"${entry.medicament.trim()}\": ${getMutationErrorMessage(error)}`,
          );
        }
      }

      toast.success("Patient ajoute avec succes.");
      if (partialFailures.length > 0) {
        toast.error(
          `Patient cree, mais certaines donnees n'ont pas ete enregistrees:\n- ${partialFailures.join("\n- ")}`,
          { duration: 9000 },
        );
      }

      setCreatedPatientName([values.nom.trim(), values.prenom.trim()].filter(Boolean).join(" "));
      setIsSuccessModalOpen(true);
      setIsNouveauPatientOpen(false);
      await patientsQuery.refetch();
    } catch (error) {
      const message = getMutationErrorMessage(error);
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
              <p className={styles.statusTitle}>
                Impossible de charger la liste des patients
              </p>
              <p className={styles.statusDescription}>
                {patientsQuery.error.message}
              </p>
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
          isSubmitting={isSubmittingPatientFlow}
          submitError={nouveauPatientError}
          onContinue={handleSubmitPatient}
          onAddNow={handleSubmitPatient}
        />

        <PatientCreatedSuccessModal
          open={isSuccessModalOpen}
          patientName={createdPatientName}
          onClose={() => setIsSuccessModalOpen(false)}
        />
      </main>
    </div>
  );
}

function getMutationErrorMessage(error: unknown) {
  if (error instanceof TRPCClientError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Impossible d'ajouter le patient.";
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

function buildMatricule(nom: string, prenom: string, patientNumber: number) {
  const nomInitial = getMatriculeInitial(nom);
  const prenomInitial = getMatriculeInitial(prenom);
  const initials = `${nomInitial}${prenomInitial}` || "PT";
  const year = new Date().getFullYear();
  const sequence = Math.max(1, patientNumber).toString().padStart(3, "0");

  return `${initials}-${year}-${sequence}`;
}

function getMatriculeInitial(value: string) {
  return (
    value
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]/g, "")
      .slice(0, 1)
      .toUpperCase() || ""
  );
}

function mapPatientRecord(patient: PatientRecord): PatientViewModel {
  const fullName = [patient.nom, patient.prenom]
    .filter(Boolean)
    .join(" ")
    .trim();
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

  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < birthDate.getDate())
  ) {
    age -= 1;
  }

  return Math.max(age, 0);
}

function formatSexLabel(sexe: string | null) {
  const normalized = (sexe ?? "").trim().toLowerCase();

  if (normalized === "f" || normalized.startsWith("fem")) {
    return "Femme";
  }

  if (
    normalized === "m" ||
    normalized.startsWith("mas") ||
    normalized.startsWith("hom")
  ) {
    return "Homme";
  }

  return sexe?.trim() || "Non renseigne";
}

function extractConditionsText(patient: PatientRecord) {
  const withConditions = patient as PatientRecord & {
    conditions?: string[] | null;
  };

  if (
    Array.isArray(withConditions.conditions) &&
    withConditions.conditions.length > 0
  ) {
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
