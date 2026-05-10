import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Sidebar } from "@/components/sidebar";
import { MedicationCatalogSkeleton } from "@/components/page-skeletons";
import { requireSession } from "@/lib/require-session";
import { trpc, trpcClient } from "@/utils/trpc";

import emptySearchIcon from "./components/255f1de574a39b67ffed7c31ea0da0b5a1b791e2.svg";
import { AlphabetFilter } from "./components/-alphabet-filter";
import { CategoryDropdown } from "./components/-category-dropdown";
import {
  formatMedicationBaseCount,
  formatMedicationCount,
  toCardFromMobileItem,
} from "./components/-medication-helpers";
import { MedicationCard } from "./components/-medication-card";
import { MEDICATIONS_PAGE_TEXT } from "./components/-page-data";
import { TopographicHeader } from "./components/-topographic-header";
import { AjouterMedicamentDialog } from "./popups/-ajouter-medicament";
import { VoirMedicamentDialog } from "./popups/-voir-medicament";

const MEDICATIONS_PAGE_SIZE = 24;

export const Route = createFileRoute("/medicament/")({
  component: RouteComponent,
  beforeLoad: async () => {
    const session = await requireSession();
    return { session };
  },
});

function RouteComponent() {
  const { session } = Route.useRouteContext();
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
  const [selectedLetter, setSelectedLetter] = useState("A");
  const [selectedCategory, setSelectedCategory] = useState<string>(
    MEDICATIONS_PAGE_TEXT.selectedCategory,
  );
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [viewMedicamentId, setViewMedicamentId] = useState<number | null>(null);
  const [isDetailEditing, setIsDetailEditing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const deferredSearchValue = useDeferredValue(searchValue.trim());

  useEffect(() => {
    setCurrentPage(1);
  }, [deferredSearchValue, selectedCategory, selectedLetter]);

  const filtersQuery = useQuery(trpc.medicaments.getMobileCatalogFilters.queryOptions());

  const mobileCatalogQuery = useQuery(
    trpc.medicaments.searchMobileCatalog.queryOptions({
      query: deferredSearchValue.length > 0 ? deferredSearchValue : null,
      starts_with: selectedLetter,
      category: selectedCategory,
      page: currentPage,
      page_size: MEDICATIONS_PAGE_SIZE,
    }),
  );

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return trpcClient.medicaments.supprimerMedicament.mutate({ id });
    },
    onSuccess: async (_data, id) => {
      toast.success("Médicament supprimé");
      if (viewMedicamentId === id) {
        setViewMedicamentId(null);
      }
      await refreshQueries();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const categories = useMemo(() => {
    const backendCategories = filtersQuery.data?.categories ?? [];
    return [
      MEDICATIONS_PAGE_TEXT.selectedCategory,
      ...backendCategories.filter(
        (category) => category !== MEDICATIONS_PAGE_TEXT.selectedCategory,
      ),
    ];
  }, [filtersQuery.data?.categories]);

  const displayedItems = useMemo(() => {
    return (mobileCatalogQuery.data?.items ?? []).map((item) => toCardFromMobileItem(item));
  }, [mobileCatalogQuery.data?.items]);

  const totalResults = mobileCatalogQuery.data?.total ?? 0;
  const pageCount = mobileCatalogQuery.data?.page_count ?? 1;
  const pageStart =
    totalResults === 0 ? 0 : (currentPage - 1) * MEDICATIONS_PAGE_SIZE + 1;
  const pageEnd = Math.min(currentPage * MEDICATIONS_PAGE_SIZE, totalResults);

  const resultsTitle = `Médicaments commençant par "${selectedLetter}"`;
  const headerSubtitle = formatMedicationBaseCount(filtersQuery.data?.totalCount ?? 0);
  const isDetailView = viewMedicamentId !== null;

  async function refreshQueries() {
    await Promise.all([
      filtersQuery.refetch(),
      mobileCatalogQuery.refetch(),
    ]);
  }

  function handleDelete(id: number) {
    const confirmed = window.confirm("Supprimer ce médicament ?");
    if (!confirmed) {
      return;
    }

    deleteMutation.mutate(id);
  }

  return (
    <div className="flex h-screen h-svh h-dvh overflow-hidden bg-[#f3f7fb]">
      <Sidebar currentUser={sidebarUser} />

      <main className="h-full min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto bg-[#f3f7fb] px-[clamp(1.25rem,2.3vw,2.2rem)] py-[clamp(0.875rem,1.6vw,1.5rem)] max-[58rem]:px-3">
        {isDetailView ? (
          <VoirMedicamentDialog
            isDeleting={deleteMutation.isPending && deleteMutation.variables === viewMedicamentId}
            isEditing={isDetailEditing}
            medicamentId={viewMedicamentId}
            onDelete={handleDelete}
            onEditModeChange={setIsDetailEditing}
            onOpenChange={(open) => {
              if (!open) {
                setViewMedicamentId(null);
                setIsDetailEditing(false);
              }
            }}
            onUpdated={() => {
              void refreshQueries();
            }}
            open
          />
        ) : (
          <div className="flex w-full flex-col gap-[clamp(0.75rem,1.5vw,1.125rem)] px-[clamp(0.25rem,0.65vw,0.55rem)] pb-10">
            <TopographicHeader
              onAdd={() => setIsAddOpen(true)}
              subtitle={headerSubtitle}
            />

            <div className="relative grid w-full grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)]">
              <label className="relative block w-full">
                <Search
                  className="pointer-events-none absolute left-[17px] top-1/2 size-[18px] -translate-y-1/2 text-[#173FB8]"
                  strokeWidth={2.15}
                />
                <input
                  type="text"
                  value={searchValue}
                  onChange={(event) => setSearchValue(event.target.value)}
                  placeholder={MEDICATIONS_PAGE_TEXT.searchPlaceholder}
                  className="h-[50px] w-full rounded-[12px] border border-[#C2E0EF] bg-white pl-[47px] pr-[16px] font-['Inter'] text-[14px] font-normal text-[#0F3460] outline-none placeholder:text-[#C1BFE1] shadow-[0px_2px_6px_rgba(118,187,221,0.08)]"
                />
              </label>

              <CategoryDropdown
                categories={categories}
                onSelect={setSelectedCategory}
                selectedCategory={selectedCategory}
              />
            </div>

            <div className="w-full">
              <AlphabetFilter onSelect={setSelectedLetter} selectedLetter={selectedLetter} />
            </div>

            <section className="mt-2 w-full">
              <div className="flex items-center gap-[16px] max-[40rem]:items-start">
                <div className="flex size-[64px] shrink-0 items-center justify-center rounded-[14px] bg-[linear-gradient(135deg,#FFB14A_0%,#FF8A1F_58%,#FF7A00_100%)] shadow-[0px_8px_20px_rgba(255,138,31,0.22)]">
                  <span className="font-['Inter'] text-[36px] font-semibold leading-none text-white">
                    {selectedLetter}
                  </span>
                </div>

                <div className="flex min-w-0 flex-col">
                  <h2 className="break-words font-['Inter'] text-[clamp(1.45rem,7vw,2rem)] font-semibold leading-[1.1] text-[#0F3460]">
                    {resultsTitle}
                  </h2>
                  <p className="mt-[7px] font-['Inter'] text-[14px] font-normal leading-none text-[#1F4CC3]">
                    {formatMedicationCount(totalResults)}
                  </p>
                </div>
              </div>

              {mobileCatalogQuery.isLoading ? (
                <MedicationCatalogSkeleton />
              ) : displayedItems.length === 0 ? (
                <div className="mt-[30px] flex h-[352px] w-full flex-col items-center justify-center gap-[13px] rounded-[14px] border-[0.67px] border-[#C2E0EF] bg-white px-6 py-8 shadow-[0px_4px_20px_rgba(194,224,239,0.2)]">
                  <div className="flex size-[82px] items-center justify-center rounded-full bg-[rgba(194,224,239,0.3)]">
                    <img
                      alt=""
                      aria-hidden="true"
                      className="size-[28px]"
                      src={emptySearchIcon}
                    />
                  </div>
                  <p className="font-['Plus_Jakarta_Sans'] text-[22px] font-semibold leading-none text-[#0F3460] text-center">
                    Aucun médicament trouvé
                  </p>
                  <p className="font-['Plus_Jakarta_Sans'] text-[16px] font-normal leading-none text-[#052CA0] text-center">
                    Aucun médicament ne correspond à vos critères de recherche.
                  </p>
                </div>
              ) : (
                <>
                  <div className="mt-[30px] grid w-full grid-cols-1 gap-x-[16px] gap-y-[14px] xl:grid-cols-3">
                    {displayedItems.map((medication) => (
                      <MedicationCard
                        key={medication.id}
                        id={medication.id}
                        isDeleting={deleteMutation.isPending && deleteMutation.variables === medication.id}
                        name={medication.name}
                        onDelete={handleDelete}
                        onEdit={(id) => {
                          setViewMedicamentId(id);
                          setIsDetailEditing(true);
                        }}
                        onView={(id) => {
                          setViewMedicamentId(id);
                          setIsDetailEditing(false);
                        }}
                        pharmacologicalFamily={medication.pharmacologicalFamily}
                        primaryTag={medication.primaryTag}
                        scientificName={medication.scientificName}
                      />
                    ))}
                  </div>

                  <div className="mt-5 flex flex-col gap-3 rounded-[14px] border border-[#C2E0EF] bg-white px-4 py-3 shadow-[0px_4px_20px_rgba(194,224,239,0.18)] sm:flex-row sm:items-center sm:justify-between">
                    <p className="font-['Inter'] text-[12px] font-medium text-[#4d7291]">
                      Affichage {pageStart.toLocaleString("fr-FR")}-
                      {pageEnd.toLocaleString("fr-FR")} sur{" "}
                      {totalResults.toLocaleString("fr-FR")}
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        className="h-9 rounded-[10px] border border-[#C2E0EF] bg-white px-3 font-['Inter'] text-[12px] font-semibold text-[#265284] transition-colors hover:bg-[#f0f8ff] disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={currentPage <= 1 || mobileCatalogQuery.isFetching}
                        onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                        type="button"
                      >
                        Précédent
                      </button>
                      <span className="min-w-[92px] text-center font-['Inter'] text-[12px] font-semibold text-[#0F3460]">
                        Page {currentPage} / {pageCount}
                      </span>
                      <button
                        className="h-9 rounded-[10px] border border-[#C2E0EF] bg-white px-3 font-['Inter'] text-[12px] font-semibold text-[#265284] transition-colors hover:bg-[#f0f8ff] disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={
                          currentPage >= pageCount || mobileCatalogQuery.isFetching
                        }
                        onClick={() =>
                          setCurrentPage((page) => Math.min(pageCount, page + 1))
                        }
                        type="button"
                      >
                        Suivant
                      </button>
                    </div>
                  </div>
                </>
              )}
            </section>
          </div>
        )}
      </main>

      <AjouterMedicamentDialog
        onCreated={() => {
          void refreshQueries();
        }}
        onOpenChange={setIsAddOpen}
        open={isAddOpen}
      />
    </div>
  );
}
