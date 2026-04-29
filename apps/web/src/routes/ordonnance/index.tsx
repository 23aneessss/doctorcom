import type { AppRouter } from "@doctor.com/api/routers/index";
import { useQueries, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import type { inferRouterOutputs } from "@trpc/server";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  CircleHelp,
  Eye,
  FilePlus2,
  FileStack,
  FileText,
  Files,
  Loader2,
  Pencil,
  Plus,
  Printer,
  Search,
  Sparkles,
  SquarePen,
  X,
} from "lucide-react";
import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import headerTexture from "@/assets/figma/patients/fc145d0d9403ead31e8bc198dd8335751de59305.svg";
import Sidebar from "@/components/sidebar";
import { requireSession } from "@/lib/require-session";
import { openBase64Pdf } from "@/lib/pdf-client";
import { ModifierOrdonnanceDialog } from "@/routes/ordonnance/popups/modifier-ordonnance";
import { NouveauOrdonnanceDialog } from "@/routes/ordonnance/popups/nouveau-ordonnance";
import { trpcClient } from "@/utils/trpc";

export const Route = createFileRoute("/ordonnance/")({
  component: RouteComponent,
  beforeLoad: async () => {
    const session = await requireSession();
    return { session };
  },
});

type RouterOutputs = inferRouterOutputs<AppRouter>;
type PatientSearchRow = RouterOutputs["patient"]["searchPatients"][number];
type OrdonnanceRow =
  RouterOutputs["ordonnance"]["getOrdonnancesByPatient"][number];
type CategoryRow = RouterOutputs["ordonnance"]["getToutesCategories"][number];
type PreRempliDetail = RouterOutputs["ordonnance"]["getPreRempliById"];

type RecentOrdonnanceItem = {
  id: string;
  patientId: string;
  rendezVousId: string;
  patientName: string;
  patientMatricule: string;
  date: string;
  remarques: string | null;
  type: "ia" | "preRemplie" | "manuel";
  medicaments: OrdonnanceRow["medicaments"];
};

type PreRempliCardItem = {
  id: string;
  nom: string;
  description: string | null;
  specialite: string | null;
  categorieId: string;
  categorieNom: string;
  medicationCount: number;
  searchableText: string;
};

type RendezVousLite = {
  id: string;
  suivi_id: string | null;
  date: string;
  heure: string;
  statut: string;
};

type SuiviLite = {
  id: string;
  motif: string;
  date_ouverture: string;
};

type SearchMedicamentOption = {
  id: number | string;
  nom_medicament: string;
  nom_generique: string | null;
  posologie_adulte: string | null;
  posologie_enfant: string | null;
  dose_maximale: string | null;
  frequence_administration: string | null;
};

type EditableOrdonnanceMedicamentRow = {
  localId: string;
  ordonnanceMedicamentId?: string;
  medicament_externe_id: string;
  nom_medicament: string;
  dosage: string;
  posologie: string;
  duree_traitement: string;
  instructions: string;
};

const RECENT_ORDONNANCES_PAGE_SIZE = 3;
const ALL_CATEGORIES_VALUE = "__all_categories__";
const ALL_SPECIALITES_VALUE = "__all_specialites__";
const EMPTY_UUID = "00000000-0000-0000-0000-000000000000";

function createEmptyEditMedicationRow(): EditableOrdonnanceMedicamentRow {
  return {
    localId: crypto.randomUUID(),
    medicament_externe_id: "",
    nom_medicament: "",
    dosage: "",
    posologie: "",
    duree_traitement: "",
    instructions: "",
  };
}

function RouteComponent() {
  const { session, trpc } = Route.useRouteContext();
  const sessionUser = session?.data?.user;
  const sidebarUser =
    sessionUser && typeof sessionUser.email === "string"
      ? {
          name: sessionUser.name?.trim() || sessionUser.email,
          email: sessionUser.email,
          avatarUrl: sessionUser.image ?? undefined,
        }
      : undefined;

  const [templateSearchValue, setTemplateSearchValue] = useState("");
  const [selectedCategory, setSelectedCategory] =
    useState(ALL_CATEGORIES_VALUE);
  const [selectedSpecialite, setSelectedSpecialite] = useState(
    ALL_SPECIALITES_VALUE,
  );
  const [recentOrdonnancesPage, setRecentOrdonnancesPage] = useState(0);
  const [isCreateTemplateOpen, setIsCreateTemplateOpen] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(
    null,
  );
  const [usingTemplateId, setUsingTemplateId] = useState<string | null>(null);
  const [previewOrdonnanceId, setPreviewOrdonnanceId] = useState<string | null>(
    null,
  );
  const [editingOrdonnanceId, setEditingOrdonnanceId] = useState<string | null>(
    null,
  );
  const normalizedTemplateSearch = templateSearchValue.trim().toLowerCase();

  const patientsQuery = useQuery({
    ...trpc.patient.searchPatients.queryOptions({}),
    throwOnError: false,
  });

  const categoriesQuery = useQuery({
    ...trpc.ordonnance.getToutesCategories.queryOptions(),
    throwOnError: false,
  });

  const patientRows = patientsQuery.data ?? [];
  const categoryRows = categoriesQuery.data ?? [];

  const ordonnancesByPatientQueries = useQueries({
    queries: patientRows.map((patient) => ({
      ...trpc.ordonnance.getOrdonnancesByPatient.queryOptions({
        patientId: patient.id,
      }),
      throwOnError: false,
      staleTime: 60_000,
    })),
  });

  const preRemplisByCategoryQueries = useQueries({
    queries: categoryRows.map((category) => ({
      ...trpc.ordonnance.getPreRemplisByCategorie.queryOptions({
        categorieId: category.id,
      }),
      throwOnError: false,
      staleTime: 60_000,
    })),
  });

  const preRemplis = useMemo(
    () =>
      categoryRows.flatMap((category, categoryIndex) =>
        (preRemplisByCategoryQueries[categoryIndex]?.data ?? []).map(
          (item) => ({
            ...item,
            category,
          }),
        ),
      ),
    [categoryRows, preRemplisByCategoryQueries],
  );

  const preRempliDetailQueries = useQueries({
    queries: preRemplis.map((item) => ({
      ...trpc.ordonnance.getPreRempliById.queryOptions({ id: item.id }),
      throwOnError: false,
      staleTime: 60_000,
    })),
  });

  const recentOrdonnances = useMemo<RecentOrdonnanceItem[]>(() => {
    return patientRows
      .flatMap((patient, patientIndex) => {
        const fullName = buildFullName(patient);
        return (ordonnancesByPatientQueries[patientIndex]?.data ?? []).map(
          (ordonnance) => ({
            id: ordonnance.id,
            patientId: ordonnance.patient_id,
            rendezVousId: ordonnance.rendez_vous_id,
            patientName: fullName,
            patientMatricule: patient.matricule ?? "",
            date: ordonnance.date_prescription,
            remarques: ordonnance.remarques,
            type: inferOrdonnanceType(ordonnance),
            medicaments: ordonnance.medicaments,
          }),
        );
      })
      .sort((left, right) => right.date.localeCompare(left.date));
  }, [ordonnancesByPatientQueries, patientRows]);

  const preRempliCards = useMemo<PreRempliCardItem[]>(() => {
    return preRemplis
      .map((item, index) => {
        const detail = preRempliDetailQueries[index]?.data as
          | PreRempliDetail
          | undefined;
        const medicationNames =
          detail?.medicaments
            ?.map((medicament) => medicament.nom_medicament)
            .filter(Boolean)
            .join(" ") ?? "";

        return {
          id: item.id,
          nom: item.nom,
          description: item.description,
          specialite: item.specialite,
          categorieId: item.category.id,
          categorieNom: item.category.nom,
          medicationCount: detail?.medicaments?.length ?? 0,
          searchableText: [
            item.nom,
            item.description,
            item.specialite,
            item.category.nom,
            medicationNames,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase(),
        };
      })
      .sort((left, right) => left.nom.localeCompare(right.nom, "fr"));
  }, [preRempliDetailQueries, preRemplis]);

  const availableSpecialites = useMemo(
    () =>
      Array.from(
        new Set(
          preRempliCards
            .map((item) => item.specialite?.trim())
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort((left, right) => left.localeCompare(right, "fr")),
    [preRempliCards],
  );

  const recentOrdonnancesPageCount = Math.max(
    1,
    Math.ceil(recentOrdonnances.length / RECENT_ORDONNANCES_PAGE_SIZE),
  );

  useEffect(() => {
    setRecentOrdonnancesPage((current) =>
      Math.min(current, recentOrdonnancesPageCount - 1),
    );
  }, [recentOrdonnancesPageCount]);

  const visibleRecentOrdonnances = useMemo(
    () =>
      recentOrdonnances.slice(
        recentOrdonnancesPage * RECENT_ORDONNANCES_PAGE_SIZE,
        (recentOrdonnancesPage + 1) * RECENT_ORDONNANCES_PAGE_SIZE,
      ),
    [recentOrdonnances, recentOrdonnancesPage],
  );

  const filteredPreRemplis = useMemo(() => {
    return preRempliCards.filter((item) => {
      const matchesSearch = normalizedTemplateSearch
        ? item.searchableText.includes(normalizedTemplateSearch)
        : true;
      const matchesCategory =
        selectedCategory === ALL_CATEGORIES_VALUE
          ? true
          : item.categorieId === selectedCategory;
      const matchesSpecialite =
        selectedSpecialite === ALL_SPECIALITES_VALUE
          ? true
          : item.specialite === selectedSpecialite;

      return matchesSearch && matchesCategory && matchesSpecialite;
    });
  }, [
    normalizedTemplateSearch,
    preRempliCards,
    selectedCategory,
    selectedSpecialite,
  ]);

  const previewOrdonnance =
    recentOrdonnances.find((item) => item.id === previewOrdonnanceId) ?? null;
  const editingOrdonnance =
    recentOrdonnances.find((item) => item.id === editingOrdonnanceId) ?? null;

  const allQueries = [
    patientsQuery,
    categoriesQuery,
    ...ordonnancesByPatientQueries,
    ...preRemplisByCategoryQueries,
    ...preRempliDetailQueries,
  ];

  const failedQueries = allQueries.filter((query) => query.isError);
  const isInitialLoading =
    (patientsQuery.isLoading || categoriesQuery.isLoading) &&
    !patientsQuery.data &&
    !categoriesQuery.data;

  const retryFailedQueries = async () => {
    await Promise.all(failedQueries.map((query) => query.refetch()));
  };

  const refreshOrdonnancePageData = async () => {
    await Promise.all([
      patientsQuery.refetch(),
      categoriesQuery.refetch(),
      ...ordonnancesByPatientQueries.map((query) => query.refetch()),
      ...preRemplisByCategoryQueries.map((query) => query.refetch()),
      ...preRempliDetailQueries.map((query) => query.refetch()),
    ]);
  };

  const handlePrintOrdonnance = async (ordonnanceId: string) => {
    try {
      const payload = await trpcClient.export.exporterOrdonnance.mutate({
        id: ordonnanceId,
      });
      openBase64Pdf({
        base64Data: payload.data,
        filename: payload.filename,
        mimeType: payload.mimeType,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Impossible d'ouvrir cette ordonnance.";
      toast.error(message);
    }
  };

  const handleCreateNewTemplate = () => {
    setIsCreateTemplateOpen(true);
  };

  const handleUseTemplate = (templateId: string) => {
    setUsingTemplateId(templateId);
  };

  const handleEditTemplate = (templateId: string) => {
    setEditingTemplateId(templateId);
  };

  const heroStyle = {
    "--ordonnance-hero-texture": `url(${headerTexture})`,
  } as CSSProperties;

  return (
    <div className="min-h-screen bg-[#f8fbff]">
      <div className="flex min-h-screen">
        <Sidebar currentUser={sidebarUser} />

        <main className="flex-1 overflow-auto px-8 py-6">
          <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-7">
            {failedQueries.length > 0 ? (
              <div className="flex items-center justify-between rounded-[14px] border border-[#f77a21] bg-[#fff7ed] px-4 py-3">
                <p className="font-['Inter'] text-[13px] text-[#b45309]">
                  Certaines données de la page Ordonnances n&apos;ont pas pu
                  être chargées.
                </p>
                <button
                  className="rounded-[10px] border border-[#f77a21] px-3 py-1.5 font-['Inter'] text-[12px] font-medium text-[#f77a21] transition-colors hover:bg-[#ffedd5]"
                  onClick={() => void retryFailedQueries()}
                  type="button"
                >
                  Réessayer
                </button>
              </div>
            ) : null}

            <section
              aria-labelledby="ordonnances-page-title"
              className="relative overflow-hidden rounded-[15px] border border-[color:color-mix(in_srgb,#c2e0ef_68%,white)] bg-[linear-gradient(97.5deg,color-mix(in_srgb,#c2e0ef_87%,white_13%)_0%,#ffffff_99.9%)] px-6 py-4 shadow-[0_4px_20px_rgba(118,187,221,0.5)]"
              style={heroStyle}
            >
              <div
                aria-hidden="true"
                className="pointer-events-none absolute left-[-5%] right-[-9%] top-[-205%] bottom-[-70%] opacity-20"
                style={{
                  backgroundImage: "var(--ordonnance-hero-texture)",
                  backgroundRepeat: "no-repeat",
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              />

              <div className="relative z-[1] flex min-h-[104px] flex-col items-start justify-center gap-3">
                <div className="min-w-0">
                  <h1
                    className="m-0 font-['Plus_Jakarta_Sans'] text-[28px] font-bold leading-[1.1] text-[#0f3460]"
                    id="ordonnances-page-title"
                  >
                    Ordonnances
                  </h1>
                  <p className="mt-[3px] font-['Plus_Jakarta_Sans'] text-[17px] font-semibold leading-[1.2] text-[#052ca0]">
                    Consultez vos ordonnances récentes et créez de nouveaux
                    modèles
                  </p>
                </div>
              </div>
            </section>

            <section className="flex flex-col gap-4">
              <div className="flex items-end justify-between gap-4">
                <SectionHeading
                  icon={<Files className="size-[17px] text-[#265284]" />}
                  title="Ordonnances récentes"
                />
                <div className="flex items-center gap-2 rounded-full border border-[#d9edf7] bg-[#f8fbff] p-1">
                  <button
                    aria-label="Voir les ordonnances précédentes"
                    className="inline-flex size-[34px] items-center justify-center rounded-full text-[#5d7b96] transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-35"
                    disabled={recentOrdonnancesPage === 0}
                    onClick={() =>
                      setRecentOrdonnancesPage((current) =>
                        Math.max(0, current - 1),
                      )
                    }
                    type="button"
                  >
                    <ChevronLeft className="size-[18px]" strokeWidth={2.2} />
                  </button>
                  <button
                    aria-label="Voir les ordonnances suivantes"
                    className="inline-flex size-[34px] items-center justify-center rounded-full text-[#5d7b96] transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-35"
                    disabled={
                      recentOrdonnancesPage >= recentOrdonnancesPageCount - 1
                    }
                    onClick={() =>
                      setRecentOrdonnancesPage((current) =>
                        Math.min(recentOrdonnancesPageCount - 1, current + 1),
                      )
                    }
                    type="button"
                  >
                    <ChevronRight className="size-[18px]" strokeWidth={2.2} />
                  </button>
                </div>
              </div>

              <div className="overflow-hidden rounded-[20px] border border-[#cfe6f3] bg-[linear-gradient(180deg,#ffffff_0%,#fbfdff_100%)] p-3 shadow-[0px_10px_28px_-20px_rgba(15,52,96,0.22)]">
                <div className="grid grid-cols-[minmax(0,420px)_154px_140px_minmax(36px,1fr)_144px] items-center gap-4 rounded-[14px] bg-[#f5fbff] px-4 py-[12px]">
                  <TableHeadCell>PATIENT</TableHeadCell>
                  <TableHeadCell className="text-center">DATE</TableHeadCell>
                  <TableHeadCell className="text-center">TYPE</TableHeadCell>
                  <div aria-hidden="true" />
                  <TableHeadCell className="text-center">ACTIONS</TableHeadCell>
                </div>

                {isInitialLoading ? (
                  <div className="mt-3 flex flex-col gap-3">
                    {Array.from({ length: 4 }).map((_, index) => (
                      <div
                        key={index}
                        className="grid grid-cols-[minmax(0,420px)_154px_140px_minmax(36px,1fr)_144px] items-center gap-4 rounded-[15px] border border-[#e6f1f8] bg-white px-4 py-[8px]"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="size-[40px] rounded-full bg-[#edf5fb]" />
                          <div className="space-y-2">
                            <div className="h-3.5 w-[128px] rounded-full bg-[#edf5fb]" />
                            <div className="h-2.5 w-[72px] rounded-full bg-[#edf5fb]" />
                          </div>
                        </div>
                        <div className="mx-auto h-3.5 w-[92px] rounded-full bg-[#edf5fb]" />
                        <div className="mx-auto h-3.5 w-[74px] rounded-full bg-[#edf5fb]" />
                        <div aria-hidden="true" />
                        <div className="mx-auto h-8 w-[118px] rounded-[12px] bg-[#edf5fb]" />
                      </div>
                    ))}
                  </div>
                ) : visibleRecentOrdonnances.length === 0 ? (
                  <div className="pt-3">
                    <EmptySectionState text="Aucune ordonnance récente ne correspond à cette recherche." />
                  </div>
                ) : (
                  <div className="mt-3 flex flex-col gap-3">
                    {visibleRecentOrdonnances.map((ordonnance) => (
                      <article
                        key={ordonnance.id}
                        className="grid grid-cols-[minmax(0,420px)_154px_140px_minmax(36px,1fr)_144px] items-center gap-4 rounded-[15px] border border-[#dbeaf4] bg-white px-4 py-[8px] shadow-[0px_10px_22px_-20px_rgba(15,52,96,0.18)] transition-[transform,box-shadow,border-color,background-color] duration-200 ease-out hover:border-[#b7d8ea] hover:bg-[#fcfeff] hover:shadow-[0px_16px_28px_-24px_rgba(15,52,96,0.24)]"
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span className="inline-flex size-[40px] shrink-0 items-center justify-center rounded-full border border-[#d9edf7] bg-[#cfe9f8] font-['Plus_Jakarta_Sans'] text-[14px] font-bold tracking-[-0.03em] text-[#5b84a0]">
                            {buildInitials(ordonnance.patientName)}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-['Poppins'] text-[14px] font-semibold leading-[19px] text-[#0f3460]">
                              {ordonnance.patientName}
                            </p>
                            <p className="mt-0.5 truncate font-['Inter'] text-[11px] font-semibold leading-[15px] text-[#365a78]">
                              #{ordonnance.patientMatricule || "Sans matricule"}
                            </p>
                            <p className="mt-0.5 truncate font-['Inter'] text-[10px] leading-[14px] text-[#6d879d]">
                              {ordonnance.medicaments.length} médicament
                              {ordonnance.medicaments.length > 1 ? "s" : ""}
                              {ordonnance.medicaments[0]?.nom_medicament
                                ? ` · ${ordonnance.medicaments[0].nom_medicament}`
                                : ""}
                            </p>
                          </div>
                        </div>

                        <div className="mx-auto inline-flex w-fit items-center gap-1.5 rounded-full border border-[#dcecf6] bg-[#f8fbff] px-2.5 py-1 font-['Poppins'] text-[11px] font-medium leading-[16px] text-[#5d728a]">
                          <CalendarDays className="size-[13px] text-[#6d8297]" />
                          <span>{formatDisplayDate(ordonnance.date)}</span>
                        </div>

                        <div className="flex justify-center">
                          <OrdonnanceTypeBadge type={ordonnance.type} />
                        </div>

                        <div aria-hidden="true" />

                        <div className="flex items-center justify-center gap-2">
                          <ActionIconButton
                            ariaLabel="Voir l'ordonnance"
                            icon={
                              <Eye className="size-[13px]" strokeWidth={2} />
                            }
                            onClick={() =>
                              setPreviewOrdonnanceId(ordonnance.id)
                            }
                          />
                          <ActionIconButton
                            ariaLabel="Modifier l'ordonnance"
                            icon={
                              <Pencil className="size-[13px]" strokeWidth={2} />
                            }
                            onClick={() =>
                              setEditingOrdonnanceId(ordonnance.id)
                            }
                          />
                          <ActionIconButton
                            ariaLabel="Imprimer l'ordonnance"
                            icon={
                              <Printer
                                className="size-[13px]"
                                strokeWidth={2}
                              />
                            }
                            onClick={() =>
                              void handlePrintOrdonnance(ordonnance.id)
                            }
                          />
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <section className="flex flex-col gap-4 pb-4">
              <div className="flex items-center justify-between gap-4">
                <SectionHeading
                  icon={<FileStack className="size-[18px] text-[#265284]" />}
                  title="Ordonnances pré-remplis"
                />
                <button
                  className="inline-flex h-[42px] min-w-[288px] cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-[14px] bg-[#052ca0] px-[24px] py-3 font-['Plus_Jakarta_Sans'] text-[16px] font-semibold text-white shadow-[0px_4px_12px_0px_rgba(5,44,160,0.4)] transition-colors hover:bg-[#0a3ac7]"
                  onClick={handleCreateNewTemplate}
                  type="button"
                >
                  <Plus className="size-4" strokeWidth={2.2} />
                  Nouveau modèle
                </button>
              </div>

              <div className="grid gap-2.5 xl:grid-cols-[minmax(190px,0.72fr)_minmax(190px,0.72fr)_minmax(300px,0.96fr)] xl:items-center">
                <div className="relative">
                  <select
                    className="h-[42px] w-full appearance-none rounded-[13px] border border-[#cfe1ec] bg-[#f2f8fd] px-3.5 pr-10 font-['Plus_Jakarta_Sans'] text-[13px] font-medium text-[#21496f] outline-none transition-[border-color,background-color,box-shadow] focus:border-[#9fcbdf] focus:bg-[#fafdff] focus:shadow-[0_8px_20px_-18px_rgba(15,52,96,0.28)]"
                    onChange={(event) =>
                      setSelectedCategory(event.target.value)
                    }
                    value={selectedCategory}
                  >
                    <option value={ALL_CATEGORIES_VALUE}>
                      Toutes les catégories
                    </option>
                    {categoryRows.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.nom}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    className="pointer-events-none absolute right-3.5 top-1/2 size-[17px] -translate-y-1/2 text-[#265284]"
                    strokeWidth={1.8}
                  />
                </div>

                <div className="relative">
                  <select
                    className="h-[42px] w-full appearance-none rounded-[13px] border border-[#cfe1ec] bg-[#f2f8fd] px-3.5 pr-10 font-['Plus_Jakarta_Sans'] text-[13px] font-medium text-[#21496f] outline-none transition-[border-color,background-color,box-shadow] focus:border-[#9fcbdf] focus:bg-[#fafdff] focus:shadow-[0_8px_20px_-18px_rgba(15,52,96,0.28)]"
                    onChange={(event) =>
                      setSelectedSpecialite(event.target.value)
                    }
                    value={selectedSpecialite}
                  >
                    <option value={ALL_SPECIALITES_VALUE}>
                      Toutes les spécialités
                    </option>
                    {availableSpecialites.map((specialite) => (
                      <option key={specialite} value={specialite}>
                        {specialite}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    className="pointer-events-none absolute right-3.5 top-1/2 size-[17px] -translate-y-1/2 text-[#265284]"
                    strokeWidth={1.8}
                  />
                </div>

                <label className="relative block w-full">
                  <Search
                    className="pointer-events-none absolute left-3.5 top-1/2 size-[16px] -translate-y-1/2 text-[#265284]"
                    strokeWidth={1.9}
                  />
                  <input
                    className="h-[42px] w-full rounded-[13px] border border-[#cfe1ec] bg-[#eef6fc] pl-[40px] pr-3.5 font-['Plus_Jakarta_Sans'] text-[13px] font-medium text-[#21496f] outline-none transition-[border-color,background-color,box-shadow] placeholder:text-[rgba(38,82,132,0.42)] focus:border-[#9fcbdf] focus:bg-[#fafdff] focus:shadow-[0_8px_20px_-18px_rgba(15,52,96,0.28)]"
                    onChange={(event) =>
                      setTemplateSearchValue(event.target.value)
                    }
                    placeholder="Rechercher un médicament..."
                    value={templateSearchValue}
                  />
                </label>
              </div>

              {preRempliCards.length === 0 && categoriesQuery.isLoading ? (
                <div className="grid gap-[18px] md:grid-cols-2 xl:grid-cols-3">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <div
                      key={index}
                      className="h-[176px] rounded-[14px] border-[0.8px] border-[#c2e0ef] bg-white shadow-[0px_4px_20px_0px_rgba(194,224,239,0.22)]"
                    />
                  ))}
                </div>
              ) : filteredPreRemplis.length === 0 ? (
                <EmptySectionState text="Aucun modèle pré-rempli ne correspond à cette recherche." />
              ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {filteredPreRemplis.map((item) => (
                    <article
                      key={item.id}
                      className="group flex min-h-[184px] flex-col overflow-hidden rounded-[20px] border border-[#cfe6f3] bg-white shadow-[0px_14px_30px_-26px_rgba(15,52,96,0.3)] transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-[#b7d8ea] hover:shadow-[0px_20px_34px_-28px_rgba(15,52,96,0.34)]"
                    >
                      <div className="flex h-full flex-col px-4 pb-4 pt-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="pr-2 font-['Plus_Jakarta_Sans'] text-[16px] font-semibold leading-[22px] text-[#0f3460]">
                              {item.nom}
                            </h3>
                            {item.specialite ? (
                              <p className="mt-1 font-['Inter'] text-[11px] font-medium uppercase tracking-[0.08em] text-[#6d879d]">
                                {item.specialite}
                              </p>
                            ) : null}
                          </div>
                          <span className="inline-flex h-[22px] items-center rounded-full border border-[#cfe6f3] bg-[#f0f8ff] px-[9px] font-['Inter'] text-[10px] font-semibold text-[#265284]">
                            Modèle
                          </span>
                        </div>

                        <p className="mt-2.5 min-h-[46px] font-['Inter'] text-[12px] leading-[18px] text-[#4f6d87]">
                          {item.description ||
                            "Modèle pré-rempli de prescription médicale"}
                        </p>

                        <div className="mt-3 inline-flex w-fit items-center rounded-full border border-[#dcecf6] bg-[#f8fbff] px-3 py-1 font-['Inter'] text-[11px] font-medium text-[#62819b]">
                          {item.medicationCount} médicament
                          {item.medicationCount > 1 ? "s" : ""}
                        </div>

                        <div className="mt-auto flex items-center gap-[10px] pt-5">
                          <button
                            className="h-[36px] w-full rounded-[13px] bg-[#76bbdd] font-['Plus_Jakarta_Sans'] text-[13px] font-semibold text-white shadow-[0px_8px_16px_-10px_rgba(118,187,221,0.72)] transition-[transform,background-color,box-shadow] duration-200 ease-out hover:bg-[#69b2d6] hover:shadow-[0px_14px_22px_-14px_rgba(118,187,221,0.78)]"
                            onClick={() => handleUseTemplate(item.id)}
                            type="button"
                          >
                            Utiliser
                          </button>
                          <button
                            className="h-[36px] rounded-[13px] border border-[#f77a21] px-4 font-['Plus_Jakarta_Sans'] text-[12px] font-semibold text-[#f77a21] transition-[background-color,border-color] duration-200 ease-out hover:bg-[#fff7ed]"
                            onClick={() => handleEditTemplate(item.id)}
                            type="button"
                          >
                            Modifier
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
        </main>
      </div>

      <NouveauOrdonnanceDialog
        onOpenChange={setIsCreateTemplateOpen}
        onSaved={refreshOrdonnancePageData}
        open={isCreateTemplateOpen}
      />
      <ModifierOrdonnanceDialog
        onOpenChange={(open) => {
          if (!open) {
            setEditingTemplateId(null);
          }
        }}
        onSaved={refreshOrdonnancePageData}
        open={Boolean(editingTemplateId)}
        templateId={editingTemplateId}
      />
      <UtiliserPreRempliDialog
        onClose={() => setUsingTemplateId(null)}
        onSaved={refreshOrdonnancePageData}
        patients={patientRows}
        templateId={usingTemplateId}
      />
      <OrdonnancePreviewDialog
        onClose={() => setPreviewOrdonnanceId(null)}
        onPrint={(ordonnanceId) => void handlePrintOrdonnance(ordonnanceId)}
        ordonnance={previewOrdonnance}
      />
      <OrdonnanceEditDialog
        onClose={() => setEditingOrdonnanceId(null)}
        onPrint={(ordonnanceId) => void handlePrintOrdonnance(ordonnanceId)}
        onSaved={refreshOrdonnancePageData}
        ordonnance={editingOrdonnance}
      />
    </div>
  );
}

function SectionHeading(props: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2">
      {props.icon}
      <h2 className="font-['Plus_Jakarta_Sans'] text-[20px] font-medium leading-[28px] text-[#0f3460]">
        {props.title}
      </h2>
    </div>
  );
}

function UtiliserPreRempliDialog({
  templateId,
  patients,
  onClose,
  onSaved,
}: {
  templateId: string | null;
  patients: PatientSearchRow[];
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const { trpc } = Route.useRouteContext();
  const open = Boolean(templateId);
  useDialogScrollLock(open);

  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [selectedSuiviId, setSelectedSuiviId] = useState("");
  const [selectedRendezVousId, setSelectedRendezVousId] = useState("");
  const [remarques, setRemarques] = useState("");
  const [rows, setRows] = useState<EditableOrdonnanceMedicamentRow[]>([
    createEmptyEditMedicationRow(),
  ]);
  const [activeSearchRowId, setActiveSearchRowId] = useState<string | null>(
    null,
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [hydratedTemplateId, setHydratedTemplateId] = useState<string | null>(
    null,
  );

  const templateDetailQuery = useQuery({
    ...trpc.ordonnance.getPreRempliById.queryOptions({
      id: templateId ?? EMPTY_UUID,
    }),
    enabled: open,
    staleTime: 60_000,
  });

  const { data: suivis = [] } = useQuery({
    ...trpc.consultation.getPatientSuivis.queryOptions({
      patient_id: selectedPatientId || EMPTY_UUID,
    }),
    enabled: open && Boolean(selectedPatientId),
  });

  const { data: patientFullRecord } = useQuery({
    ...trpc.patient.getPatientFullRecord.queryOptions({
      id: selectedPatientId || EMPTY_UUID,
    }),
    enabled: open && Boolean(selectedPatientId),
  });

  const searchQuery = useQuery({
    ...trpc.ordonnance.rechercherMedicaments.queryOptions({
      query: debouncedSearchTerm,
    }),
    enabled: open && debouncedSearchTerm.length >= 2,
  });

  const rendezVous = (patientFullRecord?.rendez_vous ?? []) as RendezVousLite[];
  const suivisList = (suivis ?? []) as SuiviLite[];
  const selectedSuivi = useMemo(
    () => suivisList.find((suivi) => suivi.id === selectedSuiviId) ?? null,
    [selectedSuiviId, suivisList],
  );

  const sortedSearchResults = useMemo(() => {
    const items = (searchQuery.data ?? []) as SearchMedicamentOption[];
    const term = debouncedSearchTerm.toLowerCase();
    if (!term) return items;

    const score = (item: SearchMedicamentOption) => {
      const name = item.nom_medicament.toLowerCase();
      const generic = (item.nom_generique ?? "").toLowerCase();

      if (name === term) return 0;
      if (name.startsWith(term)) return 1;
      if (generic === term) return 2;
      if (generic.startsWith(term)) return 3;
      if (name.includes(term)) return 4;
      if (generic.includes(term)) return 5;
      return 6;
    };

    return [...items].sort((a, b) => {
      const scoreDiff = score(a) - score(b);
      if (scoreDiff !== 0) return scoreDiff;
      return a.nom_medicament.localeCompare(b.nom_medicament, "fr");
    });
  }, [searchQuery.data, debouncedSearchTerm]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setSelectedPatientId("");
    setSelectedSuiviId("");
    setSelectedRendezVousId("");
    setRemarques("");
    setRows([createEmptyEditMedicationRow()]);
    setActiveSearchRowId(null);
    setSearchTerm("");
    setDebouncedSearchTerm("");
    setIsSaving(false);
    setHydratedTemplateId(null);
  }, [open, templateId]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setDebouncedSearchTerm(searchTerm.trim());
    }, 280);

    return () => window.clearTimeout(timeout);
  }, [open, searchTerm]);

  useEffect(() => {
    if (!open || !templateDetailQuery.data) {
      return;
    }

    if (hydratedTemplateId === templateDetailQuery.data.id) {
      return;
    }

    const templateRows = templateDetailQuery.data.medicaments?.length
      ? templateDetailQuery.data.medicaments.map((medicament) => ({
          localId: crypto.randomUUID(),
          medicament_externe_id: medicament.medicament_externe_id,
          nom_medicament: medicament.nom_medicament,
          dosage: medicament.dosage ?? "",
          posologie: medicament.posologie_defaut ?? "",
          duree_traitement: medicament.duree_defaut ?? "",
          instructions: medicament.instructions_defaut ?? "",
        }))
      : [createEmptyEditMedicationRow()];

    setRows(templateRows);
    setHydratedTemplateId(templateDetailQuery.data.id);
  }, [hydratedTemplateId, open, templateDetailQuery.data]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setSelectedSuiviId("");
    setSelectedRendezVousId("");
  }, [open, selectedPatientId]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSaving) {
        onClose();
      }
    };

    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [isSaving, onClose, open]);

  if (!templateId) {
    return null;
  }

  const updateRow = (
    localId: string,
    patch: Partial<EditableOrdonnanceMedicamentRow>,
  ) => {
    setRows((current) =>
      current.map((item) =>
        item.localId === localId ? { ...item, ...patch } : item,
      ),
    );
  };

  const handlePatientChange = (patientId: string) => {
    setSelectedPatientId(patientId);
  };

  const handleSuiviChange = (suiviId: string) => {
    setSelectedSuiviId(suiviId);
    const latestRendezVous = rendezVous
      .filter((item) => item.suivi_id === suiviId && item.statut === "termine")
      .sort((left, right) => {
        const leftTime = new Date(`${left.date}T${left.heure}`).getTime();
        const rightTime = new Date(`${right.date}T${right.heure}`).getTime();
        return rightTime - leftTime;
      })[0];
    setSelectedRendezVousId(latestRendezVous?.id ?? "");
  };

  const handleRemoveRow = (localId: string) => {
    setRows((current) => {
      const nextRows = current.filter((item) => item.localId !== localId);
      return nextRows.length > 0 ? nextRows : [createEmptyEditMedicationRow()];
    });
  };

  const handleSave = async () => {
    if (!selectedPatientId) {
      toast.error("Sélectionnez un patient.");
      return;
    }

    if (!selectedSuiviId) {
      toast.error("Sélectionnez le suivi lié.");
      return;
    }

    if (!selectedRendezVousId) {
      toast.error(
        "Aucun rendez-vous terminé trouvé pour ce suivi. Impossible d'attribuer le modèle.",
      );
      return;
    }

    const medicaments = rows
      .map((row) => ({
        medicament_externe_id: row.medicament_externe_id.trim(),
        dosage: row.dosage.trim() || null,
        posologie: row.posologie.trim(),
        duree_traitement: row.duree_traitement.trim() || null,
        instructions: row.instructions.trim() || null,
      }))
      .filter(
        (row) =>
          row.medicament_externe_id ||
          row.posologie ||
          row.dosage ||
          row.duree_traitement ||
          row.instructions,
      );

    if (
      medicaments.length === 0 ||
      medicaments.some((row) => !row.medicament_externe_id || !row.posologie)
    ) {
      toast.error(
        "Chaque médicament renseigné doit être sélectionné et avoir une posologie.",
      );
      return;
    }

    setIsSaving(true);
    try {
      await trpcClient.ordonnance.creerOrdonnance.mutate({
        patient_id: selectedPatientId,
        rendez_vous_id: selectedRendezVousId,
        date_prescription: todayIsoDate(),
        remarques: remarques.trim() || null,
        pre_rempli_origine_id: templateId,
        medicaments,
      });

      await onSaved();
      toast.success("Modèle attribué au patient.");
      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Impossible d'attribuer ce modèle.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const isLoadingInitialData = templateDetailQuery.isLoading;
  const selectedPatient = patients.find(
    (patient) => patient.id === selectedPatientId,
  );

  return (
    <>
      <OrdonnanceDialogMotionStyles />
      <div
        className="fixed inset-0 z-[140] flex items-center justify-center overflow-hidden bg-[rgba(10,35,65,0.24)] px-4 py-8 backdrop-blur-[4px]"
        onMouseDown={(event) => {
          if (event.currentTarget === event.target && !isSaving) {
            onClose();
          }
        }}
        style={{ animation: "ordonnanceOverlayIn 180ms ease-out" }}
      >
        <div
          className="flex max-h-[calc(100vh-64px)] w-full max-w-[600px] flex-col overflow-hidden rounded-[14px] bg-white shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] transition-[height,transform] duration-300 ease-out"
          style={{
            animation:
              "ordonnanceDialogIn 220ms cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        >
          <div className="flex h-[68px] shrink-0 items-center justify-between border-b-[0.8px] border-[#c2e0ef] px-5">
            <div className="flex min-w-0 items-center gap-2">
              <FilePlus2 className="size-5 shrink-0 text-[#0f3460]" />
              <div className="min-w-0">
                <p className="truncate font-['Plus_Jakarta_Sans'] text-[18px] font-medium text-[#0f3460]">
                  Utiliser un modèle d'ordonnance
                </p>
                {templateDetailQuery.data?.nom ? (
                  <p className="truncate font-['Inter'] text-[11px] text-[#6d879d]">
                    {templateDetailQuery.data.nom}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                aria-label="Aide"
                className="cursor-pointer text-[#0f3460] transition-colors hover:text-[#265284]"
                type="button"
              >
                <CircleHelp className="size-5" />
              </button>
              <button
                aria-label="Fermer l'utilisation du modèle"
                className="cursor-pointer text-[#0f3460] transition-colors hover:text-[#265284] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isSaving}
                onClick={onClose}
                type="button"
              >
                <X className="size-5" />
              </button>
            </div>
          </div>

          <div className="consultation-modal-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-5 pb-4 pt-5">
            {isLoadingInitialData ? (
              <div className="flex h-[420px] items-center justify-center">
                <Loader2 className="size-6 animate-spin text-[#76bbdd]" />
              </div>
            ) : (
              <>
                <FieldLabel required text="Patient" />
                <select
                  className="h-[50px] min-h-[50px] w-full rounded-[10px] border-[1.5px] border-[#c2e0ef] bg-white px-4 py-0 font-['Inter'] text-[14px] leading-[50px] text-[#0f3460]"
                  onChange={(event) => handlePatientChange(event.target.value)}
                  value={selectedPatientId}
                >
                  <option value="">Sélectionner un patient</option>
                  {patients.map((patient) => (
                    <option key={patient.id} value={patient.id}>
                      {buildFullName(patient)}
                      {patient.matricule ? ` · ${patient.matricule}` : ""}
                    </option>
                  ))}
                </select>

                {selectedPatient ? (
                  <div className="mt-2 rounded-[10px] border border-[#d9edf7] bg-[#f8fbff] px-3 py-2">
                    <p className="font-['Inter'] text-[12px] font-semibold text-[#0f3460]">
                      {buildFullName(selectedPatient)}
                    </p>
                    <p className="font-['Inter'] text-[11px] text-[#6d879d]">
                      #{selectedPatient.matricule || "Sans matricule"}
                    </p>
                  </div>
                ) : null}

                <div className="mt-4">
                  <FieldLabel required text="Suivi lié" />
                  <select
                    className="h-[50px] min-h-[50px] w-full rounded-[10px] border-[1.5px] border-[#c2e0ef] bg-white px-4 py-0 font-['Inter'] text-[14px] leading-[50px] text-[#0f3460] disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={!selectedPatientId}
                    onChange={(event) => handleSuiviChange(event.target.value)}
                    value={selectedSuiviId}
                  >
                    <option value="">
                      {selectedPatientId
                        ? "Sélectionner un suivi"
                        : "Choisir un patient d'abord"}
                    </option>
                    {suivisList.map((suivi) => (
                      <option key={suivi.id} value={suivi.id}>
                        {suivi.motif} ({suivi.date_ouverture})
                      </option>
                    ))}
                  </select>
                </div>

                {!selectedRendezVousId && selectedSuivi ? (
                  <p className="mt-3 rounded-[10px] border border-[#f97316] bg-[#fff7ed] px-3 py-2 font-['Inter'] text-[12px] text-[#b45309]">
                    Aucun rendez-vous terminé trouvé pour ce suivi.
                    L'attribution est bloquée.
                  </p>
                ) : null}

                <div className="mt-4 space-y-3">
                  {rows.map((row, index) => (
                    <div
                      key={row.localId}
                      className="rounded-[10px] border border-[#c2e0ef] bg-[#f8fafc]"
                    >
                      <div className="flex items-center justify-between border-b border-[#c2e0ef] bg-[#c2e0ef] px-4 py-2">
                        <p className="font-['Plus_Jakarta_Sans'] text-[14px] font-medium text-[#265284]">
                          médicament {index + 1}
                        </p>
                        {rows.length > 1 ? (
                          <button
                            className="cursor-pointer rounded-[8px] border border-[#fecaca] px-2 py-1 font-['Inter'] text-[12px] text-[#dc2626] transition-colors hover:border-[#fca5a5] hover:bg-[#fef2f2]"
                            onClick={() => handleRemoveRow(row.localId)}
                            type="button"
                          >
                            supprimer
                          </button>
                        ) : null}
                      </div>

                      <div className="space-y-2 p-3">
                        <div className="relative">
                          <input
                            className="h-[34px] w-full rounded-[4px] border border-[#c2e0ef] bg-white px-2 pr-8 font-['Plus_Jakarta_Sans'] text-[14px] text-[#0f3460]"
                            onBlur={() => {
                              window.setTimeout(() => {
                                setActiveSearchRowId((current) =>
                                  current === row.localId ? null : current,
                                );
                              }, 120);
                            }}
                            onChange={(event) => {
                              const value = event.target.value;
                              setSearchTerm(value);
                              updateRow(row.localId, {
                                nom_medicament: value,
                                medicament_externe_id:
                                  value.trim() !== row.nom_medicament.trim()
                                    ? ""
                                    : row.medicament_externe_id,
                              });
                            }}
                            onFocus={() => {
                              setActiveSearchRowId(row.localId);
                              setSearchTerm(row.nom_medicament);
                            }}
                            placeholder="Nom du médicament / DCI *"
                            value={row.nom_medicament}
                          />
                          <Search className="absolute right-2 top-2.5 size-4 text-[#94a3b8]" />
                        </div>

                        {activeSearchRowId === row.localId ? (
                          <div className="consultation-modal-scrollbar max-h-[180px] overflow-auto rounded-[8px] border border-[#c2e0ef] bg-white p-1">
                            {searchQuery.isPending ? (
                              <p className="px-2 py-1.5 font-['Inter'] text-[12px] text-[#64748b]">
                                Recherche en cours...
                              </p>
                            ) : null}

                            {!searchQuery.isPending && searchQuery.isError ? (
                              <p className="px-2 py-1.5 font-['Inter'] text-[12px] text-[#b45309]">
                                Impossible de charger les suggestions.
                              </p>
                            ) : null}

                            {!searchQuery.isPending &&
                            !searchQuery.isError &&
                            debouncedSearchTerm.length >= 2 &&
                            sortedSearchResults.length === 0 ? (
                              <p className="px-2 py-1.5 font-['Inter'] text-[12px] text-[#64748b]">
                                Aucun médicament trouvé.
                              </p>
                            ) : null}

                            {!searchQuery.isPending &&
                            !searchQuery.isError &&
                            debouncedSearchTerm.length >= 2
                              ? sortedSearchResults.slice(0, 8).map((item) => (
                                  <button
                                    key={item.id}
                                    className="w-full cursor-pointer rounded-[6px] px-2 py-1.5 text-left hover:bg-[#f8fafc]"
                                    onMouseDown={(event) =>
                                      event.preventDefault()
                                    }
                                    onClick={() => {
                                      updateRow(row.localId, {
                                        medicament_externe_id: String(item.id),
                                        nom_medicament: item.nom_medicament,
                                        posologie:
                                          row.posologie ||
                                          item.posologie_adulte ||
                                          item.posologie_enfant ||
                                          "",
                                        dosage:
                                          row.dosage ||
                                          item.dose_maximale ||
                                          "",
                                        instructions:
                                          row.instructions ||
                                          item.frequence_administration ||
                                          "",
                                      });
                                      setActiveSearchRowId(null);
                                      setSearchTerm(item.nom_medicament);
                                    }}
                                    type="button"
                                  >
                                    <p className="font-['Inter'] text-[13px] font-medium text-[#0f3460]">
                                      {item.nom_medicament}
                                    </p>
                                    {item.nom_generique ? (
                                      <p className="font-['Inter'] text-[11px] text-[rgba(100,116,139,0.9)]">
                                        {item.nom_generique}
                                      </p>
                                    ) : null}
                                  </button>
                                ))
                              : null}

                            {debouncedSearchTerm.length < 2 ? (
                              <p className="px-2 py-1.5 font-['Inter'] text-[12px] text-[#64748b]">
                                Tapez au moins 2 caractères pour rechercher.
                              </p>
                            ) : null}
                          </div>
                        ) : null}

                        <div className="grid grid-cols-2 gap-2">
                          <input
                            className="h-[33px] rounded-[4px] border border-[#c2e0ef] bg-white px-2 font-['Plus_Jakarta_Sans'] text-[14px] text-[#0f3460]"
                            onChange={(event) =>
                              updateRow(row.localId, {
                                posologie: event.target.value,
                              })
                            }
                            placeholder="Posologie"
                            value={row.posologie}
                          />
                          <input
                            className="h-[33px] rounded-[4px] border border-[#c2e0ef] bg-white px-2 font-['Plus_Jakarta_Sans'] text-[14px] text-[#0f3460]"
                            onChange={(event) =>
                              updateRow(row.localId, {
                                duree_traitement: event.target.value,
                              })
                            }
                            placeholder="Durée"
                            value={row.duree_traitement}
                          />
                        </div>

                        <input
                          className="h-[33px] w-full rounded-[4px] border border-[#c2e0ef] bg-white px-2 font-['Plus_Jakarta_Sans'] text-[14px] text-[#0f3460]"
                          onChange={(event) =>
                            updateRow(row.localId, {
                              dosage: event.target.value,
                            })
                          }
                          placeholder="Dosage"
                          value={row.dosage}
                        />

                        <input
                          className="h-[33px] w-full rounded-[4px] border border-[#c2e0ef] bg-white px-2 font-['Plus_Jakarta_Sans'] text-[14px] text-[#0f3460]"
                          onChange={(event) =>
                            updateRow(row.localId, {
                              instructions: event.target.value,
                            })
                          }
                          placeholder="Instructions..."
                          value={row.instructions}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  className="mt-3 flex h-[42px] min-h-[42px] cursor-pointer items-center justify-center gap-2 rounded-[10px] border-[1.6px] border-dashed border-[#265284] py-0 font-['Inter'] text-[14px] font-semibold text-[#265284] transition-colors hover:bg-[#f8fbff]"
                  onClick={() =>
                    setRows((current) => [
                      ...current,
                      createEmptyEditMedicationRow(),
                    ])
                  }
                  type="button"
                >
                  <Plus className="size-4" />
                  Ajouter un autre médicament
                </button>

                <div className="mt-4">
                  <FieldLabel text="Remarques" />
                  <textarea
                    className="h-[74px] w-full resize-none rounded-[10px] border-[0.8px] border-[#c2e0ef] bg-white px-3 py-2 font-['Inter'] text-[14px] text-[#0f3460]"
                    onChange={(event) => setRemarques(event.target.value)}
                    placeholder="Remarques..."
                    value={remarques}
                  />
                </div>

                <div className="mt-4 flex items-center justify-end gap-2 pb-1">
                  <button
                    className="h-[37.6px] cursor-pointer rounded-[10px] border border-[#f97316] px-4 font-['Inter'] text-[14px] text-[#f97316] transition-colors hover:bg-[#fff7ed] disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isSaving}
                    onClick={onClose}
                    type="button"
                  >
                    Annuler
                  </button>
                  <button
                    className="h-[37.6px] min-w-[150px] cursor-pointer rounded-[10px] bg-[#76bbdd] px-4 font-['Poppins'] text-[14px] text-white transition-colors hover:bg-[#63b0d6] disabled:cursor-not-allowed disabled:opacity-70"
                    disabled={isSaving}
                    onClick={() => void handleSave()}
                    type="button"
                  >
                    {isSaving ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="size-4 animate-spin" />
                        Attribution...
                      </span>
                    ) : (
                      "Attribuer"
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function OrdonnancePreviewDialog({
  ordonnance,
  onClose,
  onPrint,
}: {
  ordonnance: RecentOrdonnanceItem | null;
  onClose: () => void;
  onPrint: (ordonnanceId: string) => void;
}) {
  useDialogScrollLock(Boolean(ordonnance));

  if (!ordonnance) {
    return null;
  }

  return (
    <>
      <OrdonnanceDialogMotionStyles />
      <div
        className="fixed inset-0 z-[140] flex items-center justify-center overflow-hidden bg-[rgba(10,35,65,0.24)] px-4 py-8 backdrop-blur-[4px]"
        onMouseDown={(event) => {
          if (event.currentTarget === event.target) {
            onClose();
          }
        }}
        style={{ animation: "ordonnanceOverlayIn 180ms ease-out" }}
      >
        <div className="mx-auto flex w-full max-w-[640px] items-center justify-center">
          <div
            className="flex max-h-[calc(100vh-64px)] w-full flex-col overflow-hidden rounded-[22px] border border-[#cfe6f3] bg-white shadow-[0_26px_60px_-30px_rgba(15,52,96,0.45)]"
            style={{
              animation:
                "ordonnanceDialogIn 220ms cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          >
            <div className="shrink-0 flex items-start justify-between gap-4 border-b border-[#e2f0f8] px-6 py-5">
              <div>
                <p className="font-['Plus_Jakarta_Sans'] text-[22px] font-semibold leading-[28px] text-[#0f3460]">
                  Aperçu de l'ordonnance
                </p>
                <p className="mt-1 font-['Inter'] text-[13px] text-[#6d879d]">
                  {ordonnance.patientName} ·{" "}
                  {formatDisplayDate(ordonnance.date)}
                </p>
              </div>
              <button
                aria-label="Fermer l'aperçu"
                className="inline-flex size-9 items-center justify-center rounded-full text-[#5d728a] transition-colors hover:bg-[#f0f7fc]"
                onClick={onClose}
                type="button"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="consultation-modal-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5">
              <div className="rounded-[18px] border border-[#d9edf7] bg-[#f8fbff] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-['Inter'] text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6d879d]">
                      Patient
                    </p>
                    <p className="mt-1 font-['Plus_Jakarta_Sans'] text-[17px] font-semibold text-[#0f3460]">
                      {ordonnance.patientName}
                    </p>
                    <p className="font-['Inter'] text-[12px] font-semibold text-[#365a78]">
                      #{ordonnance.patientMatricule || "Sans matricule"}
                    </p>
                  </div>
                  <div className="flex flex-col items-start gap-2 sm:items-end">
                    <div className="inline-flex items-center gap-1.5 rounded-full border border-[#dcecf6] bg-white px-3 py-1.5 font-['Inter'] text-[12px] font-medium text-[#5d728a]">
                      <CalendarDays className="size-4" />
                      {formatDisplayDate(ordonnance.date)}
                    </div>
                    <OrdonnanceTypeBadge type={ordonnance.type} />
                  </div>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                <p className="font-['Plus_Jakarta_Sans'] text-[16px] font-semibold text-[#0f3460]">
                  Médicaments prescrits
                </p>
                {ordonnance.medicaments.map((medicament, index) => (
                  <div
                    className="rounded-[16px] border border-[#e1eef6] bg-white px-4 py-3"
                    key={medicament.id}
                  >
                    <p className="font-['Plus_Jakarta_Sans'] text-[15px] font-semibold text-[#0f3460]">
                      {index + 1}. {medicament.nom_medicament}
                    </p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <PreviewInfo
                        label="Posologie"
                        value={medicament.posologie}
                      />
                      <PreviewInfo
                        label="Durée"
                        value={medicament.duree_traitement ?? "—"}
                      />
                      <PreviewInfo
                        label="Dosage"
                        value={medicament.dosage ?? "—"}
                      />
                      <PreviewInfo
                        label="Instructions"
                        value={medicament.instructions ?? "—"}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {ordonnance.remarques ? (
                <div className="mt-5 rounded-[16px] border border-[#e1eef6] bg-[#fbfdff] px-4 py-3">
                  <p className="font-['Inter'] text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6d879d]">
                    Remarques
                  </p>
                  <p className="mt-1 font-['Inter'] text-[13px] leading-5 text-[#365a78]">
                    {ordonnance.remarques}
                  </p>
                </div>
              ) : null}
            </div>

            <div className="shrink-0 flex items-center justify-end gap-3 border-t border-[#e2f0f8] bg-white px-6 py-4">
              <button
                className="h-[38px] rounded-[12px] border border-[#cfe6f3] bg-white px-4 font-['Inter'] text-[13px] font-medium text-[#365a78] transition-colors hover:bg-[#f8fbff]"
                onClick={onClose}
                type="button"
              >
                Fermer
              </button>
              <button
                className="inline-flex h-[38px] items-center gap-2 rounded-[12px] bg-[#052ca0] px-4 font-['Inter'] text-[13px] font-semibold text-white transition-colors hover:bg-[#0a3ac7]"
                onClick={() => onPrint(ordonnance.id)}
                type="button"
              >
                <Printer className="size-4" />
                Imprimer
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function OrdonnanceEditDialog({
  ordonnance,
  onClose,
  onPrint,
  onSaved,
}: {
  ordonnance: RecentOrdonnanceItem | null;
  onClose: () => void;
  onPrint: (ordonnanceId: string) => void;
  onSaved: () => Promise<void> | void;
}) {
  const { trpc } = Route.useRouteContext();
  useDialogScrollLock(Boolean(ordonnance));

  const [date, setDate] = useState("");
  const [selectedSuiviId, setSelectedSuiviId] = useState("");
  const [selectedRendezVousId, setSelectedRendezVousId] = useState("");
  const [remarques, setRemarques] = useState("");
  const [rows, setRows] = useState<EditableOrdonnanceMedicamentRow[]>([
    createEmptyEditMedicationRow(),
  ]);
  const [removedMedicamentIds, setRemovedMedicamentIds] = useState<string[]>(
    [],
  );
  const [activeSearchRowId, setActiveSearchRowId] = useState<string | null>(
    null,
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const open = Boolean(ordonnance);
  const patientId = ordonnance?.patientId ?? EMPTY_UUID;

  const { data: suivis = [] } = useQuery({
    ...trpc.consultation.getPatientSuivis.queryOptions({
      patient_id: patientId,
    }),
    enabled: open,
  });

  const { data: patientFullRecord } = useQuery({
    ...trpc.patient.getPatientFullRecord.queryOptions({ id: patientId }),
    enabled: open,
  });

  const rendezVous = (patientFullRecord?.rendez_vous ?? []) as RendezVousLite[];
  const suivisList = (suivis ?? []) as SuiviLite[];

  const selectedSuivi = useMemo(
    () => suivisList.find((suivi) => suivi.id === selectedSuiviId) ?? null,
    [selectedSuiviId, suivisList],
  );

  const rendezVousTerminesForSelectedSuivi = useMemo(() => {
    return rendezVous
      .filter(
        (item) =>
          item.suivi_id === selectedSuiviId && item.statut === "termine",
      )
      .sort((left, right) => {
        const leftTime = new Date(`${left.date}T${left.heure}`).getTime();
        const rightTime = new Date(`${right.date}T${right.heure}`).getTime();
        return rightTime - leftTime;
      });
  }, [rendezVous, selectedSuiviId]);

  const searchQuery = useQuery({
    ...trpc.ordonnance.rechercherMedicaments.queryOptions({
      query: debouncedSearchTerm,
    }),
    enabled: open && debouncedSearchTerm.length >= 2,
  });

  const sortedSearchResults = useMemo(() => {
    const items = (searchQuery.data ?? []) as SearchMedicamentOption[];
    const term = debouncedSearchTerm.toLowerCase();
    if (!term) return items;

    const score = (item: SearchMedicamentOption) => {
      const name = item.nom_medicament.toLowerCase();
      const generic = (item.nom_generique ?? "").toLowerCase();

      if (name === term) return 0;
      if (name.startsWith(term)) return 1;
      if (generic === term) return 2;
      if (generic.startsWith(term)) return 3;
      if (name.includes(term)) return 4;
      if (generic.includes(term)) return 5;
      return 6;
    };

    return [...items].sort((a, b) => {
      const scoreDiff = score(a) - score(b);
      if (scoreDiff !== 0) return scoreDiff;
      return a.nom_medicament.localeCompare(b.nom_medicament, "fr");
    });
  }, [searchQuery.data, debouncedSearchTerm]);

  useEffect(() => {
    if (!ordonnance) {
      return;
    }

    setDate(ordonnance.date);
    setSelectedRendezVousId(ordonnance.rendezVousId);
    setRemarques(ordonnance.remarques ?? "");
    setRows(
      ordonnance.medicaments.map((medicament) => ({
        localId: crypto.randomUUID(),
        ordonnanceMedicamentId: medicament.id,
        medicament_externe_id: medicament.medicament_externe_id,
        nom_medicament: medicament.nom_medicament,
        dosage: medicament.dosage ?? "",
        posologie: medicament.posologie,
        duree_traitement: medicament.duree_traitement ?? "",
        instructions: medicament.instructions ?? "",
      })),
    );
    setRemovedMedicamentIds([]);
    setActiveSearchRowId(null);
    setSearchTerm("");
    setDebouncedSearchTerm("");
    setIsSaving(false);
  }, [ordonnance]);

  useEffect(() => {
    if (!ordonnance) {
      return;
    }

    const originalRendezVous = rendezVous.find(
      (item) => item.id === ordonnance.rendezVousId,
    );

    setSelectedSuiviId(originalRendezVous?.suivi_id ?? "");
  }, [ordonnance, rendezVous]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setDebouncedSearchTerm(searchTerm.trim());
    }, 280);

    return () => window.clearTimeout(timeout);
  }, [open, searchTerm]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSaving) {
        onClose();
      }
    };

    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [isSaving, onClose, open]);

  if (!ordonnance) {
    return null;
  }

  const updateRow = (
    localId: string,
    patch: Partial<EditableOrdonnanceMedicamentRow>,
  ) => {
    setRows((current) =>
      current.map((item) =>
        item.localId === localId ? { ...item, ...patch } : item,
      ),
    );
  };

  const handleSuiviChange = (suiviId: string) => {
    setSelectedSuiviId(suiviId);
    const latestRendezVous = rendezVous
      .filter((item) => item.suivi_id === suiviId && item.statut === "termine")
      .sort((left, right) => {
        const leftTime = new Date(`${left.date}T${left.heure}`).getTime();
        const rightTime = new Date(`${right.date}T${right.heure}`).getTime();
        return rightTime - leftTime;
      })[0];
    setSelectedRendezVousId(latestRendezVous?.id ?? "");
  };

  const handleRemoveRow = (row: EditableOrdonnanceMedicamentRow) => {
    const ordonnanceMedicamentId = row.ordonnanceMedicamentId;

    if (ordonnanceMedicamentId) {
      setRemovedMedicamentIds((current) =>
        current.includes(ordonnanceMedicamentId)
          ? current
          : [...current, ordonnanceMedicamentId],
      );
    }

    setRows((current) => {
      const nextRows = current.filter((item) => item.localId !== row.localId);
      return nextRows.length > 0 ? nextRows : [createEmptyEditMedicationRow()];
    });
  };

  const handleSave = async () => {
    if (!selectedSuiviId) {
      toast.error("Le suivi est obligatoire.");
      return;
    }

    if (!selectedRendezVousId) {
      toast.error(
        "Aucun rendez-vous terminé trouvé pour ce suivi. La modification est bloquée.",
      );
      return;
    }

    const touchedRows = rows.filter(
      (row) =>
        row.nom_medicament.trim() ||
        row.medicament_externe_id.trim() ||
        row.posologie.trim() ||
        row.dosage.trim() ||
        row.duree_traitement.trim() ||
        row.instructions.trim(),
    );

    const invalidMedicament = touchedRows.find(
      (row) => !row.medicament_externe_id.trim() || !row.posologie.trim(),
    );

    if (invalidMedicament) {
      toast.error(
        "Chaque médicament doit être sélectionné dans la recherche et avoir une posologie.",
      );
      return;
    }

    if (touchedRows.length === 0) {
      toast.error("Ajoutez au moins un médicament valide.");
      return;
    }

    setIsSaving(true);
    try {
      await trpcClient.ordonnance.modifierOrdonnance.mutate({
        id: ordonnance.id,
        data: {
          rendez_vous_id: selectedRendezVousId,
          date_prescription: date,
          remarques: remarques.trim() || null,
        },
      });

      await Promise.all(
        removedMedicamentIds.map((ordonnanceMedicamentId) =>
          trpcClient.ordonnance.retirerMedicament.mutate({
            ordonnanceMedicamentId,
          }),
        ),
      );

      await Promise.all(
        touchedRows.map((row) =>
          row.ordonnanceMedicamentId
            ? trpcClient.ordonnance.modifierMedicament.mutate({
                ordonnanceMedicamentId: row.ordonnanceMedicamentId,
                data: {
                  medicament_externe_id: row.medicament_externe_id.trim(),
                  dosage: row.dosage.trim() || null,
                  posologie: row.posologie.trim(),
                  duree_traitement: row.duree_traitement.trim() || null,
                  instructions: row.instructions.trim() || null,
                },
              })
            : trpcClient.ordonnance.ajouterMedicament.mutate({
                ordonnanceId: ordonnance.id,
                data: {
                  medicament_externe_id: row.medicament_externe_id.trim(),
                  dosage: row.dosage.trim() || null,
                  posologie: row.posologie.trim(),
                  duree_traitement: row.duree_traitement.trim() || null,
                  instructions: row.instructions.trim() || null,
                },
              }),
        ),
      );

      await onSaved();
      toast.success("Ordonnance modifiée.");
      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Impossible de modifier cette ordonnance.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <OrdonnanceDialogMotionStyles />
      <div
        className="fixed inset-0 z-[140] flex items-center justify-center overflow-hidden bg-[rgba(10,35,65,0.24)] px-4 py-8 backdrop-blur-[4px]"
        onMouseDown={(event) => {
          if (event.currentTarget === event.target && !isSaving) {
            onClose();
          }
        }}
        style={{ animation: "ordonnanceOverlayIn 180ms ease-out" }}
      >
        <div
          className="flex max-h-[calc(100vh-64px)] w-full max-w-[600px] flex-col overflow-hidden rounded-[14px] bg-white shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] transition-[height,transform] duration-300 ease-out"
          style={{
            animation:
              "ordonnanceDialogIn 220ms cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        >
          <div className="flex h-[68px] shrink-0 items-center justify-between border-b-[0.8px] border-[#c2e0ef] px-5">
            <div className="flex items-center gap-2">
              <FileText className="size-5 text-[#0f3460]" />
              <p className="font-['Plus_Jakarta_Sans'] text-[18px] font-medium text-[#0f3460]">
                Modifier une ordonnance
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                aria-label="Aide"
                className="cursor-pointer text-[#0f3460] transition-colors hover:text-[#265284]"
                type="button"
              >
                <CircleHelp className="size-5" />
              </button>
              <button
                aria-label="Fermer la modification"
                className="cursor-pointer text-[#0f3460] transition-colors hover:text-[#265284] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isSaving}
                onClick={onClose}
                type="button"
              >
                <X className="size-5" />
              </button>
            </div>
          </div>

          <div className="consultation-modal-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-5 pb-4 pt-5">
            <FieldLabel required text="Suivi lié" />
            <select
              className="h-[50px] min-h-[50px] w-full rounded-[10px] border-[1.5px] border-[#c2e0ef] bg-white px-4 py-0 font-['Inter'] text-[14px] leading-[50px] text-[#0f3460]"
              onChange={(event) => handleSuiviChange(event.target.value)}
              value={selectedSuiviId}
            >
              <option value="">Sélectionner un suivi</option>
              {suivisList.map((suivi) => (
                <option key={suivi.id} value={suivi.id}>
                  {suivi.motif} ({suivi.date_ouverture})
                </option>
              ))}
            </select>

            <div className="mt-4 space-y-3">
              {rows.map((row, index) => (
                <div
                  key={row.localId}
                  className="rounded-[10px] border border-[#c2e0ef] bg-[#f8fafc]"
                >
                  <div className="flex items-center justify-between border-b border-[#c2e0ef] bg-[#c2e0ef] px-4 py-2">
                    <p className="font-['Plus_Jakarta_Sans'] text-[14px] font-medium text-[#265284]">
                      médicament {index + 1}
                    </p>
                    {rows.length > 1 ? (
                      <button
                        className="cursor-pointer rounded-[8px] border border-[#fecaca] px-2 py-1 font-['Inter'] text-[12px] text-[#dc2626] transition-colors hover:border-[#fca5a5] hover:bg-[#fef2f2]"
                        onClick={() => handleRemoveRow(row)}
                        type="button"
                      >
                        supprimer
                      </button>
                    ) : null}
                  </div>

                  <div className="space-y-2 p-3">
                    <div className="relative">
                      <input
                        className="h-[34px] w-full rounded-[4px] border border-[#c2e0ef] bg-white px-2 pr-8 font-['Plus_Jakarta_Sans'] text-[14px] text-[#0f3460]"
                        onBlur={() => {
                          window.setTimeout(() => {
                            setActiveSearchRowId((current) =>
                              current === row.localId ? null : current,
                            );
                          }, 120);
                        }}
                        onChange={(event) => {
                          const value = event.target.value;
                          setSearchTerm(value);
                          updateRow(row.localId, {
                            nom_medicament: value,
                            medicament_externe_id:
                              value.trim() !== row.nom_medicament.trim()
                                ? ""
                                : row.medicament_externe_id,
                          });
                        }}
                        onFocus={() => {
                          setActiveSearchRowId(row.localId);
                          setSearchTerm(row.nom_medicament);
                        }}
                        placeholder="Nom du médicament / DCI *"
                        value={row.nom_medicament}
                      />
                      <Search className="absolute right-2 top-2.5 size-4 text-[#94a3b8]" />
                    </div>

                    {activeSearchRowId === row.localId ? (
                      <div className="consultation-modal-scrollbar max-h-[180px] overflow-auto rounded-[8px] border border-[#c2e0ef] bg-white p-1">
                        {searchQuery.isPending ? (
                          <p className="px-2 py-1.5 font-['Inter'] text-[12px] text-[#64748b]">
                            Recherche en cours...
                          </p>
                        ) : null}

                        {!searchQuery.isPending && searchQuery.isError ? (
                          <p className="px-2 py-1.5 font-['Inter'] text-[12px] text-[#b45309]">
                            Impossible de charger les suggestions.
                          </p>
                        ) : null}

                        {!searchQuery.isPending &&
                        !searchQuery.isError &&
                        debouncedSearchTerm.length >= 2 &&
                        sortedSearchResults.length === 0 ? (
                          <p className="px-2 py-1.5 font-['Inter'] text-[12px] text-[#64748b]">
                            Aucun médicament trouvé.
                          </p>
                        ) : null}

                        {!searchQuery.isPending &&
                        !searchQuery.isError &&
                        debouncedSearchTerm.length >= 2
                          ? sortedSearchResults.slice(0, 8).map((item) => (
                              <button
                                key={item.id}
                                className="w-full cursor-pointer rounded-[6px] px-2 py-1.5 text-left hover:bg-[#f8fafc]"
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => {
                                  updateRow(row.localId, {
                                    medicament_externe_id: String(item.id),
                                    nom_medicament: item.nom_medicament,
                                    posologie:
                                      row.posologie ||
                                      item.posologie_adulte ||
                                      item.posologie_enfant ||
                                      "",
                                    dosage:
                                      row.dosage || item.dose_maximale || "",
                                    instructions:
                                      row.instructions ||
                                      item.frequence_administration ||
                                      "",
                                  });
                                  setActiveSearchRowId(null);
                                  setSearchTerm(item.nom_medicament);
                                }}
                                type="button"
                              >
                                <p className="font-['Inter'] text-[13px] font-medium text-[#0f3460]">
                                  {item.nom_medicament}
                                </p>
                                {item.nom_generique ? (
                                  <p className="font-['Inter'] text-[11px] text-[rgba(100,116,139,0.9)]">
                                    {item.nom_generique}
                                  </p>
                                ) : null}
                              </button>
                            ))
                          : null}

                        {debouncedSearchTerm.length < 2 ? (
                          <p className="px-2 py-1.5 font-['Inter'] text-[12px] text-[#64748b]">
                            Tapez au moins 2 caractères pour rechercher.
                          </p>
                        ) : null}
                      </div>
                    ) : null}

                    <div className="grid grid-cols-2 gap-2">
                      <input
                        className="h-[33px] rounded-[4px] border border-[#c2e0ef] bg-white px-2 font-['Plus_Jakarta_Sans'] text-[14px] text-[#0f3460]"
                        onChange={(event) =>
                          updateRow(row.localId, {
                            posologie: event.target.value,
                          })
                        }
                        placeholder="Posologie"
                        value={row.posologie}
                      />
                      <input
                        className="h-[33px] rounded-[4px] border border-[#c2e0ef] bg-white px-2 font-['Plus_Jakarta_Sans'] text-[14px] text-[#0f3460]"
                        onChange={(event) =>
                          updateRow(row.localId, {
                            duree_traitement: event.target.value,
                          })
                        }
                        placeholder="Durée"
                        value={row.duree_traitement}
                      />
                    </div>

                    <input
                      className="h-[33px] w-full rounded-[4px] border border-[#c2e0ef] bg-white px-2 font-['Plus_Jakarta_Sans'] text-[14px] text-[#0f3460]"
                      onChange={(event) =>
                        updateRow(row.localId, { dosage: event.target.value })
                      }
                      placeholder="Dosage"
                      value={row.dosage}
                    />

                    <input
                      className="h-[33px] w-full rounded-[4px] border border-[#c2e0ef] bg-white px-2 font-['Plus_Jakarta_Sans'] text-[14px] text-[#0f3460]"
                      onChange={(event) =>
                        updateRow(row.localId, {
                          instructions: event.target.value,
                        })
                      }
                      placeholder="Instructions..."
                      value={row.instructions}
                    />
                  </div>
                </div>
              ))}
            </div>

            {!selectedRendezVousId && selectedSuivi ? (
              <p className="mt-3 rounded-[10px] border border-[#f97316] bg-[#fff7ed] px-3 py-2 font-['Inter'] text-[12px] text-[#b45309]">
                Aucun rendez-vous terminé trouvé pour ce suivi. La modification
                d'ordonnance est bloquée.
              </p>
            ) : null}

            <button
              className="mt-3 flex h-[42px] min-h-[42px] cursor-pointer items-center justify-center gap-2 rounded-[10px] border-[1.6px] border-dashed border-[#265284] py-0 font-['Inter'] text-[14px] font-semibold text-[#265284] transition-colors hover:bg-[#f8fbff]"
              onClick={() =>
                setRows((current) => [
                  ...current,
                  createEmptyEditMedicationRow(),
                ])
              }
              type="button"
            >
              <Plus className="size-4" />
              Ajouter un autre médicament
            </button>

            <div className="mt-4">
              <FieldLabel text="Remarques" />
              <textarea
                className="h-[74px] w-full resize-none rounded-[10px] border-[0.8px] border-[#c2e0ef] bg-white px-3 py-2 font-['Inter'] text-[14px] text-[#0f3460]"
                onChange={(event) => setRemarques(event.target.value)}
                placeholder="Remarques..."
                value={remarques}
              />
            </div>

            <div className="mt-4 flex items-center justify-between pb-1">
              <div className="flex items-center gap-2">
                <button
                  className="h-[37.6px] cursor-pointer rounded-[10px] border border-[#f97316] px-4 font-['Inter'] text-[14px] text-[#f97316] transition-colors hover:bg-[#fff7ed] disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isSaving}
                  onClick={onClose}
                  type="button"
                >
                  Annuler
                </button>
                <button
                  className="h-[37.6px] cursor-pointer rounded-[10px] bg-[#76bbdd] px-4 font-['Poppins'] text-[14px] text-white transition-colors hover:bg-[#63b0d6] disabled:cursor-not-allowed disabled:opacity-70"
                  disabled={isSaving}
                  onClick={() => void handleSave()}
                  type="button"
                >
                  {isSaving ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="size-4 animate-spin" />
                      Enregistrement...
                    </span>
                  ) : (
                    "Enregistrer"
                  )}
                </button>
              </div>

              <button
                className="inline-flex cursor-pointer items-center gap-1 rounded-[4px] border border-[#265284] px-2 py-1 font-['Poppins'] text-[12px] text-[#265284] transition-colors hover:bg-[#f0f6ff] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isSaving}
                onClick={() => onPrint(ordonnance.id)}
                type="button"
              >
                imprimer
                <Printer className="size-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function OrdonnanceDialogMotionStyles() {
  return (
    <style>
      {`
        @keyframes ordonnanceOverlayIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes ordonnanceDialogIn {
          from {
            opacity: 0;
            transform: translateY(18px) scale(0.985);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}
    </style>
  );
}

function useDialogScrollLock(isOpen: boolean) {
  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth =
      window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
    };
  }, [isOpen]);
}

function PreviewInfo(props: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div>
      <p className="font-['Inter'] text-[10px] font-semibold uppercase tracking-[0.08em] text-[#8aa0b3]">
        {props.label}
      </p>
      <p className="mt-0.5 font-['Inter'] text-[12px] leading-5 text-[#365a78]">
        {props.value || "—"}
      </p>
    </div>
  );
}

function FieldLabel({ text, required }: { text: string; required?: boolean }) {
  return (
    <p className="mb-1 font-['Plus_Jakarta_Sans'] text-[12px] font-medium uppercase tracking-[0.3px] text-[rgba(100,116,139,0.9)]">
      {text}
      {required ? <span className="text-[#f97316]">*</span> : null}
    </p>
  );
}

function EditField(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="font-['Inter'] text-[10px] font-semibold uppercase tracking-[0.08em] text-[#8aa0b3]">
        {props.label}
        {props.required ? " *" : ""}
      </span>
      <input
        className="mt-1 h-[38px] w-full rounded-[11px] border border-[#d9edf7] bg-white px-3 font-['Inter'] text-[12px] text-[#0f3460] outline-none focus:border-[#76bbdd]"
        onChange={(event) => props.onChange(event.target.value)}
        value={props.value}
      />
    </label>
  );
}

function TableHeadCell(props: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={`font-['Inter'] text-[10px] font-semibold uppercase tracking-[0.04em] text-[#265284] ${props.className ?? ""}`}
    >
      {props.children}
    </p>
  );
}

function ActionIconButton(props: {
  icon: React.ReactNode;
  onClick: () => void;
  ariaLabel: string;
}) {
  return (
    <button
      aria-label={props.ariaLabel}
      className="inline-flex size-[40px] items-center justify-center rounded-[9px] border border-[#d7e7f2] bg-white text-[#f77a21] shadow-[0px_6px_12px_-12px_rgba(15,52,96,0.24)] transition-[transform,background-color,border-color,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:border-[#c0d9e8] hover:bg-white hover:shadow-[0px_12px_18px_-16px_rgba(15,52,96,0.32)]"
      onClick={props.onClick}
      type="button"
    >
      {props.icon}
    </button>
  );
}

function OrdonnanceTypeBadge(props: { type: "ia" | "preRemplie" | "manuel" }) {
  const config =
    props.type === "ia"
      ? {
          label: "IA",
          className: "border-[#e9d4ff] bg-[#faf5ff] text-[#8200db]",
          icon: <Sparkles className="size-[12px]" strokeWidth={1.8} />,
        }
      : props.type === "preRemplie"
        ? {
            label: "Pré-remplie",
            className: "border-[#bbf7d0] bg-[#f0fdf4] text-[#16a34a]",
            icon: <FilePlus2 className="size-[12px]" strokeWidth={1.8} />,
          }
        : {
            label: "Manuel",
            className: "border-[#bedbff] bg-[#eff6ff] text-[#1447e6]",
            icon: <SquarePen className="size-[12px]" strokeWidth={1.8} />,
          };

  return (
    <span
      className={`inline-flex h-[26px] w-fit items-center gap-1 rounded-full border px-[10px] font-['Inter'] text-[10px] font-semibold ${config.className}`}
    >
      {config.icon}
      <span>{config.label}</span>
    </span>
  );
}

function EmptySectionState(props: { text: string }) {
  return (
    <div className="rounded-[14px] border-[0.8px] border-dashed border-[#c2e0ef] bg-white px-5 py-10 text-center">
      <p className="font-['Inter'] text-[13px] text-[#64748b]">{props.text}</p>
    </div>
  );
}

function buildFullName(patient: PatientSearchRow) {
  return (
    [patient.nom, patient.prenom].filter(Boolean).join(" ").trim() ||
    "Patient inconnu"
  );
}

function buildInitials(fullName: string) {
  const parts = fullName
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) {
    return "PT";
  }

  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
}

function formatDisplayDate(date: string) {
  if (!date) {
    return "Date inconnue";
  }

  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) {
    return date;
  }

  return parsedDate.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function inferOrdonnanceType(
  ordonnance: OrdonnanceRow,
): "ia" | "preRemplie" | "manuel" {
  if (ordonnance.pre_rempli_origine_id) {
    return "preRemplie";
  }

  const remarks = ordonnance.remarques?.trim().toLowerCase() ?? "";
  if (
    remarks.includes("ia") ||
    remarks.includes("assistant") ||
    remarks.includes("priorisation") ||
    remarks.includes("validation finale")
  ) {
    return "ia";
  }

  return "manuel";
}
