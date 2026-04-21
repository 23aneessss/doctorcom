import type { AppRouter } from "@doctor.com/api/routers/index";
import { useQueries, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import type { inferRouterOutputs } from "@trpc/server";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Download,
  Eye,
  FilePlus2,
  FileStack,
  Files,
  Pencil,
  Plus,
  Printer,
  Search,
  Sparkles,
  SquarePen,
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
type OrdonnanceRow = RouterOutputs["ordonnance"]["getOrdonnancesByPatient"][number];
type CategoryRow = RouterOutputs["ordonnance"]["getToutesCategories"][number];
type PreRempliDetail = RouterOutputs["ordonnance"]["getPreRempliById"];

type RecentOrdonnanceItem = {
  id: string;
  patientId: string;
  patientName: string;
  patientMatricule: string;
  date: string;
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

const RECENT_ORDONNANCES_PAGE_SIZE = 3;
const ALL_CATEGORIES_VALUE = "__all_categories__";
const ALL_SPECIALITES_VALUE = "__all_specialites__";

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
  const [selectedCategory, setSelectedCategory] = useState(ALL_CATEGORIES_VALUE);
  const [selectedSpecialite, setSelectedSpecialite] = useState(
    ALL_SPECIALITES_VALUE,
  );
  const [recentOrdonnancesPage, setRecentOrdonnancesPage] = useState(0);
  const [isCreateTemplateOpen, setIsCreateTemplateOpen] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(
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
            patientName: fullName,
            patientMatricule: patient.matricule ?? "",
            date: ordonnance.date_prescription,
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

  const handleViewOrdonnance = async (ordonnanceId: string) => {
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

  const handleDownloadOrdonnance = async (ordonnanceId: string) => {
    try {
      const payload = await trpcClient.export.exporterOrdonnance.mutate({
        id: ordonnanceId,
      });
      downloadBase64Pdf(payload.data, payload.filename, payload.mimeType);
      toast.success("Ordonnance téléchargée.");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Impossible de télécharger cette ordonnance.";
      toast.error(message);
    }
  };

  const handleEditOrdonnance = () => {
    toast.info("Le frame de modification arrive à l’étape suivante.");
  };

  const handleCreateNewTemplate = () => {
    setIsCreateTemplateOpen(true);
  };

  const handleUseTemplate = () => {
    toast.info(
      "L'utilisation d’un modèle sera branchée avec le prochain frame.",
    );
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
                  Certaines données de la page Ordonnances n&apos;ont pas pu être
                  chargées.
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
                    disabled={recentOrdonnancesPage >= recentOrdonnancesPageCount - 1}
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
                <div className="grid grid-cols-[minmax(0,420px)_154px_140px_minmax(36px,1fr)_188px] items-center gap-4 rounded-[14px] bg-[#f5fbff] px-4 py-[12px]">
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
                        className="grid grid-cols-[minmax(0,420px)_154px_140px_minmax(36px,1fr)_188px] items-center gap-4 rounded-[15px] border border-[#e6f1f8] bg-white px-4 py-[8px]"
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
                        className="grid grid-cols-[minmax(0,420px)_154px_140px_minmax(36px,1fr)_188px] items-center gap-4 rounded-[15px] border border-[#dbeaf4] bg-white px-4 py-[8px] shadow-[0px_10px_22px_-20px_rgba(15,52,96,0.18)] transition-[transform,box-shadow,border-color,background-color] duration-200 ease-out hover:border-[#b7d8ea] hover:bg-[#fcfeff] hover:shadow-[0px_16px_28px_-24px_rgba(15,52,96,0.24)]"
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
                            icon={<Eye className="size-[13px]" strokeWidth={2} />}
                            onClick={() => void handleViewOrdonnance(ordonnance.id)}
                          />
                          <ActionIconButton
                            ariaLabel="Modifier l'ordonnance"
                            icon={<Pencil className="size-[13px]" strokeWidth={2} />}
                            onClick={handleEditOrdonnance}
                          />
                          <ActionIconButton
                            ariaLabel="Imprimer l'ordonnance"
                            icon={<Printer className="size-[13px]" strokeWidth={2} />}
                            onClick={() => void handleViewOrdonnance(ordonnance.id)}
                          />
                          <ActionIconButton
                            ariaLabel="Télécharger l'ordonnance"
                            icon={<Download className="size-[13px]" strokeWidth={2} />}
                            onClick={() =>
                              void handleDownloadOrdonnance(ordonnance.id)
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

              <div className="grid gap-3 xl:grid-cols-[minmax(0,1.3fr)_minmax(260px,0.85fr)_minmax(260px,0.85fr)] xl:items-center">
                <label className="relative block w-full">
                  <Search
                    className="pointer-events-none absolute left-4 top-1/2 size-[20px] -translate-y-1/2 text-[#265284]"
                    strokeWidth={1.9}
                  />
                  <input
                    className="h-[50px] w-full rounded-[16px] border-[1.5px] border-[#c2e0ef] bg-white pl-[52px] pr-4 font-['Plus_Jakarta_Sans'] text-[15px] text-[#0f3460] outline-none transition-colors placeholder:text-[rgba(38,82,132,0.45)] focus:border-[#76bbdd]"
                    onChange={(event) => setTemplateSearchValue(event.target.value)}
                    placeholder="Rechercher un médicament..."
                    value={templateSearchValue}
                  />
                </label>

                <div className="relative">
                  <select
                    className="h-[50px] w-full appearance-none rounded-[16px] border-[1.5px] border-[#c2e0ef] bg-white px-4 pr-12 font-['Plus_Jakarta_Sans'] text-[15px] text-[#0f3460] outline-none transition-colors focus:border-[#76bbdd]"
                    onChange={(event) => setSelectedSpecialite(event.target.value)}
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
                    className="pointer-events-none absolute right-4 top-1/2 size-[20px] -translate-y-1/2 text-[#265284]"
                    strokeWidth={1.8}
                  />
                </div>

                <div className="relative">
                  <select
                    className="h-[50px] w-full appearance-none rounded-[16px] border-[1.5px] border-[#c2e0ef] bg-white px-4 pr-12 font-['Plus_Jakarta_Sans'] text-[15px] text-[#0f3460] outline-none transition-colors focus:border-[#76bbdd]"
                    onChange={(event) => setSelectedCategory(event.target.value)}
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
                    className="pointer-events-none absolute right-4 top-1/2 size-[20px] -translate-y-1/2 text-[#265284]"
                    strokeWidth={1.8}
                  />
                </div>
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
                          onClick={handleUseTemplate}
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
    </div>
  );
}

function SectionHeading(props: {
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <div className="flex items-center gap-2">
      {props.icon}
      <h2 className="font-['Plus_Jakarta_Sans'] text-[20px] font-medium leading-[28px] text-[#0f3460]">
        {props.title}
      </h2>
    </div>
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

function OrdonnanceTypeBadge(props: {
  type: "ia" | "preRemplie" | "manuel";
}) {
  const config =
    props.type === "ia"
      ? {
          label: "IA",
          className:
            "border-[#e9d4ff] bg-[#faf5ff] text-[#8200db]",
          icon: <Sparkles className="size-[12px]" strokeWidth={1.8} />,
        }
      : props.type === "preRemplie"
        ? {
            label: "Pré-remplie",
            className:
              "border-[#bbf7d0] bg-[#f0fdf4] text-[#16a34a]",
            icon: <FilePlus2 className="size-[12px]" strokeWidth={1.8} />,
          }
        : {
            label: "Manuel",
            className:
              "border-[#bedbff] bg-[#eff6ff] text-[#1447e6]",
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
  return [patient.nom, patient.prenom].filter(Boolean).join(" ").trim() || "Patient inconnu";
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

  return parts
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
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

function inferOrdonnanceType(ordonnance: OrdonnanceRow): "ia" | "preRemplie" | "manuel" {
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

function downloadBase64Pdf(
  base64Data: string,
  filename: string,
  mimeType = "application/pdf",
) {
  const binary = atob(base64Data);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  const blob = new Blob([bytes], { type: mimeType });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
  }, 1_000);
}
