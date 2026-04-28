import type { AppRouter } from "@doctor.com/api/routers/index";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import type { inferRouterOutputs } from "@trpc/server";
import { Search } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import { toast } from "sonner";

import { Sidebar } from "@/components/sidebar";
import { requireSession } from "@/lib/require-session";
import { trpc, trpcClient } from "@/utils/trpc";

import emptySearchIcon from "./components/255f1de574a39b67ffed7c31ea0da0b5a1b791e2.svg";
import { AlphabetFilter } from "./components/-alphabet-filter";
import { CategoryDropdown } from "./components/-category-dropdown";
import {
  formatMedicationBaseCount,
  formatMedicationCount,
  type MobileCatalogItem,
  toCardFromMobileItem,
  toCardFromSearchItem,
} from "./components/-medication-helpers";
import { MedicationCard } from "./components/-medication-card";
import { MEDICATIONS_PAGE_TEXT } from "./components/-page-data";
import { TopographicHeader } from "./components/-topographic-header";
import { AjouterMedicamentDialog } from "./popups/-ajouter-medicament";
import { VoirMedicamentDialog } from "./popups/-voir-medicament";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type SearchMedicamentsItem = RouterOutputs["medicaments"]["rechercherMedicaments"]["items"][number];

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

  const deferredSearchValue = useDeferredValue(searchValue.trim());

  const filtersQuery = useQuery(trpc.medicaments.getMobileCatalogFilters.queryOptions());

  const mobileCatalogQuery = useQuery(
    trpc.medicaments.searchMobileCatalog.queryOptions({
      query: deferredSearchValue.length > 0 ? deferredSearchValue : null,
      starts_with: selectedLetter,
      category: selectedCategory,
      limit: 80,
    }),
  );

  const advancedSearchQuery = useQuery({
    ...trpc.medicaments.rechercherMedicaments.queryOptions({
      query: deferredSearchValue.length >= 2 ? deferredSearchValue : null,
      classe_therapeutique:
        selectedCategory !== MEDICATIONS_PAGE_TEXT.selectedCategory
          ? selectedCategory
          : null,
      page: 1,
      page_size: 80,
    }),
    enabled: deferredSearchValue.length >= 2,
  });

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

  const mobileMap = useMemo(() => {
    const map = new Map<number, MobileCatalogItem>();
    for (const item of mobileCatalogQuery.data?.items ?? []) {
      map.set(item.id, item);
    }
    return map;
  }, [mobileCatalogQuery.data?.items]);

  const displayedItems = useMemo(() => {
    if (deferredSearchValue.length >= 2 && advancedSearchQuery.data) {
      return advancedSearchQuery.data.items
        .filter((item: SearchMedicamentsItem) => {
          const firstLetter = item.nom_medicament.trim().charAt(0).toUpperCase();
          return !selectedLetter || firstLetter === selectedLetter;
        })
        .map((item) => toCardFromSearchItem(item, mobileMap));
    }

    return (mobileCatalogQuery.data?.items ?? []).map((item) => toCardFromMobileItem(item));
  }, [
    advancedSearchQuery.data,
    deferredSearchValue.length,
    mobileCatalogQuery.data?.items,
    mobileMap,
    selectedLetter,
  ]);

  const totalResults =
    deferredSearchValue.length >= 2 && advancedSearchQuery.data
      ? displayedItems.length
      : mobileCatalogQuery.data?.total ?? 0;

  const resultsTitle = `Médicaments commençant par "${selectedLetter}"`;
  const headerSubtitle = formatMedicationBaseCount(filtersQuery.data?.totalCount ?? 0);
  const isDetailView = viewMedicamentId !== null;

  async function refreshQueries() {
    await Promise.all([
      filtersQuery.refetch(),
      mobileCatalogQuery.refetch(),
      deferredSearchValue.length >= 2 ? advancedSearchQuery.refetch() : Promise.resolve(),
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
    <div className="flex h-svh bg-[#FBFBFC]">
      <Sidebar currentUser={sidebarUser} />

      <main className="flex-1 overflow-auto bg-[#FBFBFC]">
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
          <div className="mx-auto w-[1220px] max-w-[calc(100%-48px)] pb-[61px] pt-[41px]">
            <div className="ml-[62px] w-[1091px] max-w-full">
              <TopographicHeader
                onAdd={() => setIsAddOpen(true)}
                subtitle={headerSubtitle}
              />
            </div>

            <div className="relative ml-[61px] mt-[37px] flex w-[1091px] max-w-full items-start gap-[53px]">
              <label className="relative block w-[686px] max-w-full">
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

            <div className="ml-[67px] mt-[36px] w-[1091px] max-w-full">
              <AlphabetFilter onSelect={setSelectedLetter} selectedLetter={selectedLetter} />
            </div>

            <section className="mt-[33px] w-full">
              <div className="ml-[67px] mt-[40px] flex items-center gap-[16px]">
                <div className="flex size-[64px] items-center justify-center rounded-[14px] bg-[linear-gradient(135deg,#FFB14A_0%,#FF8A1F_58%,#FF7A00_100%)] shadow-[0px_8px_20px_rgba(255,138,31,0.22)]">
                  <span className="font-['Inter'] text-[36px] font-semibold leading-none text-white">
                    {selectedLetter}
                  </span>
                </div>

                <div className="flex flex-col">
                  <h2 className="font-['Inter'] text-[32px] font-semibold leading-[1.1] text-[#0F3460]">
                    {resultsTitle}
                  </h2>
                  <p className="mt-[7px] font-['Inter'] text-[14px] font-normal leading-none text-[#1F4CC3]">
                    {formatMedicationCount(totalResults)}
                  </p>
                </div>
              </div>

              {mobileCatalogQuery.isLoading || advancedSearchQuery.isLoading ? (
                <div className="ml-[67px] mt-[30px] font-['Inter'] text-[14px] text-[#0f3460]">
                  Chargement des médicaments...
                </div>
              ) : displayedItems.length === 0 ? (
                <div className="ml-[67px] mt-[30px] flex h-[352px] w-[1091px] max-w-[calc(100%-67px)] flex-col items-center justify-center gap-[13px] rounded-[14px] border-[0.67px] border-[#C2E0EF] bg-white px-6 py-8 shadow-[0px_4px_20px_rgba(194,224,239,0.2)]">
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
                <div className="ml-[67px] mt-[30px] grid w-[1086px] max-w-[calc(100%-67px)] grid-cols-1 gap-x-[16px] gap-y-[14px] xl:grid-cols-3">
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
