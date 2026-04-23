import { useQuery } from "@tanstack/react-query";

import { trpc } from "@/utils/trpc";

import { MedicationDialogShell } from "./-medication-dialog-shared";

export function VoirMedicamentDialog({
  open,
  onOpenChange,
  medicamentId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  medicamentId?: number | null;
}) {
  const detailQuery = useQuery({
    ...trpc.medicaments.getMobileMedicamentById.queryOptions({ id: medicamentId ?? 1 }),
    enabled: open && Boolean(medicamentId),
  });

  return (
    <MedicationDialogShell open={open} title="Détail du médicament" onOpenChange={onOpenChange} width="w-[760px]">
      {detailQuery.isLoading ? (
        <div className="px-6 py-8 font-['Inter'] text-[14px] text-[#0f3460]">Chargement du médicament...</div>
      ) : detailQuery.isError ? (
        <div className="px-6 py-8 font-['Inter'] text-[14px] text-red-600">{detailQuery.error.message}</div>
      ) : detailQuery.data ? (
        <div className="max-h-[78vh] space-y-5 overflow-y-auto px-6 pb-6 pt-6">
          <div className="space-y-1">
            <h4 className="font-['Plus_Jakarta_Sans'] text-[22px] font-bold text-[#0f3460]">
              {detailQuery.data.name}
            </h4>
            <p className="font-['Inter'] text-[14px] text-[#052ca0]">
              {detailQuery.data.genericName ?? "Sans nom générique"}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <InfoCard label="Catégorie" value={detailQuery.data.category} />
            <InfoCard label="Famille" value={detailQuery.data.family ?? "-"} />
            <InfoCard label="Posologie adulte" value={detailQuery.data.adultDosage ?? "-"} />
            <InfoCard label="Posologie enfant" value={detailQuery.data.childDosage ?? "-"} />
            <InfoCard label="Dose maximale" value={detailQuery.data.maxDose ?? "-"} />
            <InfoCard label="Fréquence" value={detailQuery.data.administrationFrequency ?? "-"} />
            <InfoCard label="Grossesse" value={detailQuery.data.pregnancy ?? "-"} />
            <InfoCard label="Allaitement" value={detailQuery.data.breastfeeding ?? "-"} />
          </div>

          <InfoList title="Substances actives" items={detailQuery.data.activeSubstances} />
          <InfoList title="Indications" items={detailQuery.data.indications} />
          <InfoList title="Contre-indications" items={detailQuery.data.contraIndications} />
          <InfoList title="Précautions" items={detailQuery.data.precautions} />
          <InfoList title="Interactions" items={detailQuery.data.interactions} />
          <InfoList title="Présentations" items={detailQuery.data.presentations.map((item) => [item.forme, item.dosage].filter(Boolean).join(" | "))} />
          <InfoList title="Effets indésirables" items={detailQuery.data.sideEffects.map((item) => item.frequency ? `${item.effect} | ${item.frequency}` : item.effect)} />
        </div>
      ) : null}
    </MedicationDialogShell>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[12px] border border-[#c2e0ef] bg-[#f8fafc] p-4">
      <p className="font-['Inter'] text-[12px] font-medium uppercase tracking-[0.04em] text-[rgba(100,116,139,0.9)]">
        {label}
      </p>
      <p className="mt-1 font-['Inter'] text-[14px] text-[#0f3460]">{value}</p>
    </div>
  );
}

function InfoList({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="rounded-[12px] border border-[#c2e0ef] bg-white p-4">
      <h5 className="font-['Plus_Jakarta_Sans'] text-[16px] font-semibold text-[#0f3460]">
        {title}
      </h5>
      {items.length ? (
        <div className="mt-3 flex flex-col gap-2">
          {items.map((item) => (
            <p key={`${title}-${item}`} className="rounded-[10px] bg-[#f8fafc] px-3 py-2 font-['Inter'] text-[14px] text-[#0f3460]">
              {item}
            </p>
          ))}
        </div>
      ) : (
        <p className="mt-3 font-['Inter'] text-[14px] text-[rgba(100,116,139,0.9)]">Aucune donnée</p>
      )}
    </section>
  );
}
