import type { AppRouter } from "@doctor.com/api/routers/index";
import { useQueries, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import type { inferRouterOutputs } from "@trpc/server";
import {
  CalendarDays,
  CircleUserRound,
  Download,
  Eye,
  FilePlus2,
  FileStack,
  Files,
  Pencil,
  Printer,
  Search,
  Sparkles,
  SquarePen,
} from "lucide-react";
import type { CSSProperties } from "react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import plusIcon from "@/assets/icons/+.svg";
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
  date: string;
  type: "ia" | "preRemplie" | "manuel";
  medicaments: OrdonnanceRow["medicaments"];
};

type PreRempliCardItem = {
  id: string;
  nom: string;
  description: string | null;
  specialite: string | null;
  medicationCount: number;
  searchableText: string;
};

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

  const [searchValue, setSearchValue] = useState("");
  const [isCreateTemplateOpen, setIsCreateTemplateOpen] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(
    null,
  );
  const normalizedSearch = searchValue.trim().toLowerCase();

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

  const filteredRecentOrdonnances = useMemo(() => {
    if (!normalizedSearch) {
      return recentOrdonnances;
    }

    return recentOrdonnances.filter((item) =>
      [
        item.patientName,
        item.date,
        item.type,
        item.medicaments.map((medicament) => medicament.nom_medicament).join(" "),
        item.medicaments.map((medicament) => medicament.dci).join(" "),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch),
    );
  }, [normalizedSearch, recentOrdonnances]);

  const visibleRecentOrdonnances = useMemo(
    () => filteredRecentOrdonnances.slice(0, 6),
    [filteredRecentOrdonnances],
  );

  const filteredPreRemplis = useMemo(() => {
    if (!normalizedSearch) {
      return preRempliCards;
    }

    return preRempliCards.filter((item) =>
      item.searchableText.includes(normalizedSearch),
    );
  }, [normalizedSearch, preRempliCards]);

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

              <div className="relative z-[1] flex min-h-[104px] flex-col items-start justify-between gap-4 lg:flex-row lg:items-center">
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

                <button
                  className="inline-flex min-h-[60px] min-w-[222px] items-center justify-center gap-3 rounded-[15px] border-0 bg-[#c2e0ef] px-6 py-3 font-['Plus_Jakarta_Sans'] text-[16px] font-bold tracking-[-0.01em] text-[#0f3460] whitespace-nowrap transition-[background-color,box-shadow] duration-150 ease-out hover:bg-[color:color-mix(in_srgb,#c2e0ef_88%,white_12%)] hover:shadow-[0_6px_16px_rgba(15,52,96,0.14)]"
                  onClick={handleCreateNewTemplate}
                  type="button"
                >
                  <img
                    alt=""
                    aria-hidden="true"
                    className="block h-[24px] w-[24px] shrink-0"
                    src={plusIcon}
                  />
                  <span className="block leading-[1.15]">Nouveau modèle</span>
                </button>
              </div>
            </section>

            <div className="flex justify-end">
              <label className="relative block w-full max-w-[468px]">
                <Search
                  className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-[#3b82f6]"
                  strokeWidth={1.8}
                />
                <input
                  className="h-[50px] w-full rounded-[14px] border-[1.5px] border-[#c2e0ef] bg-white pl-11 pr-4 font-['Plus_Jakarta_Sans'] text-[14px] text-[#0f3460] outline-none transition-colors placeholder:text-[rgba(5,44,160,0.38)] focus:border-[#76bbdd]"
                  onChange={(event) => setSearchValue(event.target.value)}
                  placeholder="Rechercher un médicament..."
                  value={searchValue}
                />
              </label>
            </div>

            <section className="flex flex-col gap-4">
              <SectionHeading
                icon={<Files className="size-[17px] text-[#265284]" />}
                title="Ordonnances récentes"
              />

              <div className="overflow-hidden rounded-[14px] border-[0.8px] border-[#c2e0ef] bg-white shadow-[0px_4px_20px_0px_rgba(194,224,239,0.22)]">
                <div className="grid grid-cols-[minmax(0,1.3fr)_150px_170px_170px] items-center gap-[50px] bg-[#f8fbff] px-4 py-[14px]">
                  <TableHeadCell>PATIENT</TableHeadCell>
                  <TableHeadCell>DATE</TableHeadCell>
                  <TableHeadCell>TYPE</TableHeadCell>
                  <TableHeadCell>ACTIONS</TableHeadCell>
                </div>

                {isInitialLoading ? (
                  <div className="flex flex-col">
                    {Array.from({ length: 4 }).map((_, index) => (
                      <div
                        key={index}
                        className="grid grid-cols-[minmax(0,1.3fr)_150px_170px_170px] items-center gap-[50px] border-t border-[#e7f2f8] px-4 py-[16px]"
                      >
                        <div className="h-4 w-[150px] rounded-full bg-[#edf5fb]" />
                        <div className="h-4 w-[92px] rounded-full bg-[#edf5fb]" />
                        <div className="h-4 w-[74px] rounded-full bg-[#edf5fb]" />
                        <div className="h-8 w-[110px] rounded-full bg-[#edf5fb]" />
                      </div>
                    ))}
                  </div>
                ) : visibleRecentOrdonnances.length === 0 ? (
                  <EmptySectionState text="Aucune ordonnance récente ne correspond à cette recherche." />
                ) : (
                  visibleRecentOrdonnances.map((ordonnance) => (
                    <div
                      key={ordonnance.id}
                      className="grid grid-cols-[minmax(0,1.3fr)_150px_170px_170px] items-center gap-[50px] border-t border-[#dbeaf4] px-4 py-[14px] transition-colors hover:bg-[#fbfdff]"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <CircleUserRound
                          className="size-8 shrink-0 text-[#0f3460]"
                          strokeWidth={1.8}
                        />
                        <span className="truncate font-['Poppins'] text-[14px] leading-[20px] text-[#0f3460]">
                          {ordonnance.patientName}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 font-['Poppins'] text-[14px] leading-[20px] text-[#64748b]">
                        <CalendarDays className="size-[14px] text-[#64748b]" />
                        <span>{ordonnance.date}</span>
                      </div>

                      <OrdonnanceTypeBadge type={ordonnance.type} />

                      <div className="flex items-center gap-2">
                        <ActionIconButton
                          ariaLabel="Voir l'ordonnance"
                          icon={<Eye className="size-[13px]" strokeWidth={1.9} />}
                          onClick={() => void handleViewOrdonnance(ordonnance.id)}
                        />
                        <ActionIconButton
                          ariaLabel="Modifier l'ordonnance"
                          icon={<Pencil className="size-[13px]" strokeWidth={1.9} />}
                          onClick={handleEditOrdonnance}
                        />
                        <ActionIconButton
                          ariaLabel="Imprimer l'ordonnance"
                          icon={<Printer className="size-[13px]" strokeWidth={1.9} />}
                          onClick={() => void handleViewOrdonnance(ordonnance.id)}
                        />
                        <ActionIconButton
                          ariaLabel="Télécharger l'ordonnance"
                          icon={<Download className="size-[13px]" strokeWidth={1.9} />}
                          onClick={() =>
                            void handleDownloadOrdonnance(ordonnance.id)
                          }
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="flex flex-col gap-4 pb-4">
              <SectionHeading
                icon={<FileStack className="size-[18px] text-[#265284]" />}
                title="Ordonnances pré-remplis"
              />

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
                <div className="grid gap-[18px] md:grid-cols-2 xl:grid-cols-3">
                  {filteredPreRemplis.map((item) => (
                    <article
                      key={item.id}
                      className="flex min-h-[176px] flex-col rounded-[14px] border-[0.8px] border-[#c2e0ef] bg-white px-5 pb-[18px] pt-5 shadow-[0px_4px_20px_0px_rgba(194,224,239,0.22)]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="pr-2 font-['Inter'] text-[14px] font-semibold leading-[20px] text-[#0f3460]">
                          {item.nom}
                        </h3>
                        <span className="inline-flex h-[20.6px] items-center rounded-[8px] border-[0.8px] border-[#c2e0ef] bg-[#f0f6ff] px-[8px] font-['Inter'] text-[10px] font-medium text-[#265284]">
                          Modèle
                        </span>
                      </div>

                      <p className="mt-2 min-h-[32px] font-['Inter'] text-[12px] leading-[16px] text-[#415c7b]">
                        {item.description ||
                          "Modèle pré-rempli de prescription médicale"}
                      </p>

                      <p className="mt-3 font-['Inter'] text-[12px] leading-[16px] text-[rgba(100,116,139,0.79)]">
                        {item.medicationCount} médicament
                        {item.medicationCount > 1 ? "s" : ""}
                      </p>

                      <div className="mt-auto flex items-center gap-[10px] pt-6">
                        <button
                          className="h-[29.6px] w-full rounded-[12px] bg-[#76bbdd] font-['Plus_Jakarta_Sans'] text-[14px] font-medium text-white shadow-[0px_4px_12px_0px_rgba(118,187,221,0.5)] transition-colors hover:bg-[#69b2d6]"
                          onClick={handleUseTemplate}
                          type="button"
                        >
                          Utiliser
                        </button>
                        <button
                          className="h-[29.6px] rounded-[12px] border border-[#f77a21] px-4 font-['Plus_Jakarta_Sans'] text-[12px] font-medium text-[#f77a21] transition-colors hover:bg-[#fff7ed]"
                          onClick={() => handleEditTemplate(item.id)}
                          type="button"
                        >
                          Modifier
                        </button>
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

function TableHeadCell(props: { children: React.ReactNode }) {
  return (
    <p className="font-['Inter'] text-[10px] font-semibold uppercase tracking-[0.04em] text-[#265284]">
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
      className="inline-flex size-[27.6px] items-center justify-center rounded-[4px] border-[0.8px] border-[#052ca0] text-[#f77a21] transition-colors hover:bg-[#f8fbff]"
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
      className={`inline-flex h-[20.6px] w-fit items-center gap-1 rounded-[8px] border-[0.8px] px-[8px] font-['Inter'] text-[10px] font-medium ${config.className}`}
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
