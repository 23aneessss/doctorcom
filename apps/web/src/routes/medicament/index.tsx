import { createFileRoute } from "@tanstack/react-router";
import { Search } from "lucide-react";

import { Sidebar } from "@/components/sidebar";
import { requireSession } from "@/lib/require-session";

import { AlphabetFilter } from "./components/-alphabet-filter";
import { CategoryDropdown } from "./components/-category-dropdown";
import { MedicationCard } from "./components/-medication-card";
import {
  MEDICATIONS_LIST,
  MEDICATIONS_PAGE_TEXT,
} from "./components/-page-data";
import { TopographicHeader } from "./components/-topographic-header";

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

  return (
    <div className="flex h-svh bg-[#FBFBFC]">
      <Sidebar currentUser={sidebarUser} />

      <main className="flex-1 overflow-auto bg-[#FBFBFC]">
        <div className="mx-auto w-[1220px] max-w-[calc(100%-48px)] pb-[61px] pt-[41px]">
          <div className="ml-[62px] w-[1091px] max-w-full">
            <TopographicHeader />
          </div>

          <div className="relative ml-[61px] mt-[37px] flex w-[1091px] max-w-full items-start gap-[53px]">
            <label className="relative block w-[686px] max-w-full">
              <Search
                className="pointer-events-none absolute left-[17px] top-1/2 size-[18px] -translate-y-1/2 text-[#173FB8]"
                strokeWidth={2.15}
              />
              <input
                type="text"
                placeholder={MEDICATIONS_PAGE_TEXT.searchPlaceholder}
                className="h-[50px] w-full rounded-[12px] border border-[#C2E0EF] bg-white pl-[47px] pr-[16px] font-['Inter'] text-[14px] font-normal text-[#0F3460] outline-none placeholder:text-[#C1BFE1] shadow-[0px_2px_6px_rgba(118,187,221,0.08)]"
              />
            </label>

            <CategoryDropdown />
          </div>

          <div className="ml-[67px] mt-[36px] w-[1091px] max-w-full">
            <AlphabetFilter />
          </div>

          <section className="mt-[33px] w-full">
            <div className="ml-[67px] h-px w-[1086px] max-w-[calc(100%-67px)] bg-[#C9DEEA]" />

            <div className="ml-[67px] mt-[40px] flex items-center gap-[16px]">
              <div className="flex size-[64px] items-center justify-center rounded-[14px] bg-[linear-gradient(135deg,#FFB14A_0%,#FF8A1F_58%,#FF7A00_100%)] shadow-[0px_8px_20px_rgba(255,138,31,0.22)]">
                <span className="font-['Inter'] text-[36px] font-semibold leading-none text-white">
                  B
                </span>
              </div>

              <div className="flex flex-col">
                <h2 className="font-['Inter'] text-[32px] font-semibold leading-[1.1] text-[#0F3460]">
                  {MEDICATIONS_PAGE_TEXT.resultsTitle}
                </h2>
                <p className="mt-[7px] font-['Inter'] text-[14px] font-normal leading-none text-[#1F4CC3]">
                  {MEDICATIONS_PAGE_TEXT.resultsCount}
                </p>
              </div>
            </div>

            <div className="ml-[67px] mt-[30px] grid w-[1086px] max-w-[calc(100%-67px)] grid-cols-1 gap-x-[41px] gap-y-[44px] xl:grid-cols-3">
              {MEDICATIONS_LIST.map((medication, index) => (
                <MedicationCard
                  key={`${medication.name}-${index}`}
                  condition={medication.condition}
                  name={medication.name}
                  primaryTag={medication.primaryTag}
                  scientificName={medication.scientificName}
                  secondaryTag={medication.secondaryTag}
                />
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
