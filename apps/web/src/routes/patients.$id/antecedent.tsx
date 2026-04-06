import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueries, useSuspenseQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Check,
  Pencil,
  Plus,
  RotateCcw,
  ShieldAlert,
  Trash2,
  UserRound,
} from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import { toast } from "sonner";

import { Skeleton } from "@/components/ui/skeleton";
import { queryClient, trpc, trpcClient } from "@/utils/trpc";

type PopupEventDetail = {
  type: "antecedent-personnel" | "antecedent-familial";
  mode?: "create" | "edit";
  antecedentId?: string;
  initialValues?: Record<string, string | boolean | undefined | null>;
};

export const Route = createFileRoute("/patients/$id/antecedent")({
  component: RouteComponent,
  pendingComponent: AntecedentSkeleton,
  pendingMs: 0,
});

function RouteComponent() {
  const { id } = Route.useParams();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const { data: antecedents } = useSuspenseQuery(
    trpc.medicalHistory.getAntecedentsPatient.queryOptions({ patient_id: id })
  );

  const personnels = useMemo(
    () => antecedents.filter((a) => a.type === "personnel"),
    [antecedents]
  );
  const familiaux = useMemo(
    () => antecedents.filter((a) => a.type === "familial"),
    [antecedents]
  );

  const personnelsDetails = useQueries({
    queries: personnels.map((a) =>
      trpc.medicalHistory.getAntecedentsPersonnels.queryOptions({ antecedent_id: a.id })
    ),
  });

  const familiauxDetails = useQueries({
    queries: familiaux.map((a) =>
      trpc.medicalHistory.getAntecedentsFamiliaux.queryOptions({ antecedent_id: a.id })
    ),
  });

  const personnelsMap = useMemo(() => {
    const map = new Map<string, { type: string; details: string | null; est_actif: boolean }>();
    personnels.forEach((antecedent, index) => {
      const first = personnelsDetails[index]?.data?.[0];
      if (first) {
        map.set(antecedent.id, {
          type: first.type,
          details: first.details,
          est_actif: first.est_actif,
        });
      }
    });
    return map;
  }, [personnels, personnelsDetails]);

  const familiauxMap = useMemo(() => {
    const map = new Map<string, { details: string | null; lien_parente: string | null }>();
    familiaux.forEach((antecedent, index) => {
      const first = familiauxDetails[index]?.data?.[0];
      if (first) {
        map.set(antecedent.id, {
          details: first.details,
          lien_parente: first.lien_parente,
        });
      }
    });
    return map;
  }, [familiaux, familiauxDetails]);

  const deleteAntecedentMutation = useMutation({
    mutationFn: async (antecedentId: string) => {
      return trpcClient.medicalHistory.supprimerAntecedent.mutate({
        antecedent_id: antecedentId,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries(
        trpc.medicalHistory.getAntecedentsPatient.queryFilter({ patient_id: id })
      );
      toast.success("Antécédent supprimé");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const inactivateMutation = useMutation({
    mutationFn: async (antecedentId: string) => {
      const personnelsRows = await trpcClient.medicalHistory.getAntecedentsPersonnels.query({
        antecedent_id: antecedentId,
      });

      if (!personnelsRows[0]) {
        throw new Error("Aucun antécédent personnel associé");
      }

      return trpcClient.medicalHistory.marquerAntecedentPersonnelInactif.mutate({
        antecedent_personnel_id: personnelsRows[0].id,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries(
        trpc.medicalHistory.getAntecedentsPatient.queryFilter({ patient_id: id })
      );
      toast.success("Antécédent personnel marqué inactif");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: async (antecedentId: string) => {
      return trpcClient.medicalHistory.mettreAJourAntecedent.mutate({
        antecedent_id: antecedentId,
        donnees: {
          personnel: {
            est_actif: true,
          },
        },
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries(
        trpc.medicalHistory.getAntecedentsPatient.queryFilter({ patient_id: id })
      );
      toast.success("Antécédent personnel réactivé");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const openPopup = (detail: PopupEventDetail) => {
    window.dispatchEvent(
      new CustomEvent("patient-popup-open", {
        detail,
      })
    );
  };

  const handleEditPersonnel = async (antecedentId: string, description: string) => {
    setPendingId(antecedentId);
    try {
      const personnelsRows = await trpcClient.medicalHistory.getAntecedentsPersonnels.query({
        antecedent_id: antecedentId,
      });
      const first = personnelsRows[0];
      openPopup({
        type: "antecedent-personnel",
        mode: "edit",
        antecedentId,
        initialValues: {
          description,
          type: first?.type ?? description,
          details: first?.details ?? "",
          est_actif: first?.est_actif ?? true,
        },
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur inattendue");
    } finally {
      setPendingId(null);
    }
  };

  const handleEditFamilial = async (antecedentId: string, description: string) => {
    setPendingId(antecedentId);
    try {
      const familiauxRows = await trpcClient.medicalHistory.getAntecedentsFamiliaux.query({
        antecedent_id: antecedentId,
      });
      const first = familiauxRows[0];
      openPopup({
        type: "antecedent-familial",
        mode: "edit",
        antecedentId,
        initialValues: {
          description,
          lien_parente: first?.lien_parente ?? "",
          details: first?.details ?? "",
        },
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur inattendue");
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div className="flex w-full flex-col gap-6 pb-4">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section className="rounded-[14px] border-[0.8px] border-[#c2e0ef] bg-white px-[24.8px] pb-[16px] pt-[24.8px] shadow-[0px_4px_6px_0px_rgba(0,0,0,0.1),0px_2px_4px_0px_rgba(0,0,0,0.1)]">
          <div className="mb-6 flex items-center justify-between pl-[10px]">
            <div className="flex items-center gap-2">
              <UserRound className="size-5 text-[#0f3460]" />
              <h3 className="font-['Plus_Jakarta_Sans'] text-[20px] font-medium leading-7 text-[#0f3460]">
                Antecedents Personnels
              </h3>
            </div>
            <button
              className="flex h-[36px] w-[103px] cursor-pointer items-center justify-center gap-2 rounded-[10px] bg-[#76bbdd] font-['Inter'] text-[14px] font-medium text-white shadow-[0px_4px_12px_0px_rgba(118,187,221,0.5)]"
              onClick={() => openPopup({ type: "antecedent-personnel", mode: "create" })}
              type="button"
            >
              <Plus className="size-4" />
              Ajouter
            </button>
          </div>

          <div className="flex flex-col gap-3">
            {personnels.length === 0 ? (
              <EmptyState text="Aucun antécédent personnel" />
            ) : (
              personnels.map((antecedent) => {
                const details = personnelsMap.get(antecedent.id);
                const isActive = details?.est_actif ?? true;
                return (
                  <article
                    key={antecedent.id}
                    className="flex items-start justify-between rounded-[10px] border-[0.8px] border-[#c2e0ef] bg-[#f9fafb] px-[12.8px] py-[12.8px]"
                  >
                    <div className="min-w-0 pr-3">
                      <div className="flex items-center gap-2">
                        <p className="font-['Inter'] text-[14px] text-[#0f3460]">{antecedent.description}</p>
                        <span
                          className={`inline-flex items-center gap-1 rounded-[8px] border-[0.8px] px-2 py-[2px] font-['Poppins'] text-[12px] leading-4 ${
                            isActive
                              ? "border-[#7bf1a8] bg-[#f0fdf4] text-[#008236]"
                              : "border-[#fecaca] bg-[#fef2f2] text-[#b91c1c]"
                          }`}
                        >
                          {isActive ? <Check className="size-3" /> : <ShieldAlert className="size-3" />}
                          {isActive ? "Actif" : "Inactif"}
                        </span>
                      </div>
                      <p className="font-['Inter'] text-[14px] text-[#4b6787]">
                        {details?.details?.trim() || "Sans details"}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <IconActionButton
                        tone="orange"
                        disabled={pendingId === antecedent.id}
                        onClick={() => handleEditPersonnel(antecedent.id, antecedent.description)}
                      >
                        <Pencil className="size-4 text-[#f77a21]" />
                      </IconActionButton>
                      <IconActionButton
                        disabled={
                          inactivateMutation.isPending ||
                          reactivateMutation.isPending ||
                          pendingId === antecedent.id
                        }
                        onClick={() => {
                          if (isActive) {
                            inactivateMutation.mutate(antecedent.id);
                            return;
                          }
                          reactivateMutation.mutate(antecedent.id);
                        }}
                      >
                        {isActive ? (
                          <ShieldAlert className="size-4 text-[#0f3460]" />
                        ) : (
                          <RotateCcw className="size-4 text-[#0f3460]" />
                        )}
                      </IconActionButton>
                      <IconActionButton
                        tone="orange"
                        disabled={deleteAntecedentMutation.isPending}
                        onClick={() => deleteAntecedentMutation.mutate(antecedent.id)}
                      >
                        <Trash2 className="size-4 text-[#f77a21]" />
                      </IconActionButton>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>

        <section className="rounded-[14px] border-[0.8px] border-[#c2e0ef] bg-white px-[24.8px] pb-[16px] pt-[24.8px] shadow-[0px_4px_6px_0px_rgba(0,0,0,0.1),0px_2px_4px_0px_rgba(0,0,0,0.1)]">
          <div className="mb-6 flex items-center justify-between pl-[10px]">
            <div className="flex items-center gap-2">
              <UserRound className="size-5 text-[#0f3460]" />
              <h3 className="font-['Plus_Jakarta_Sans'] text-[20px] font-medium leading-7 text-[#0f3460]">
                Antecedents Familiaux
              </h3>
            </div>
            <button
              className="flex h-[36px] w-[103px] cursor-pointer items-center justify-center gap-2 rounded-[10px] bg-[#76bbdd] font-['Inter'] text-[14px] font-medium text-white shadow-[0px_4px_12px_0px_rgba(118,187,221,0.5)]"
              onClick={() => openPopup({ type: "antecedent-familial", mode: "create" })}
              type="button"
            >
              <Plus className="size-4" />
              Ajouter
            </button>
          </div>

          <div className="flex flex-col gap-3">
            {familiaux.length === 0 ? (
              <EmptyState text="Aucun antécédent familial" />
            ) : (
              familiaux.map((antecedent) => {
                const details = familiauxMap.get(antecedent.id);
                return (
                  <article
                    key={antecedent.id}
                    className="flex items-start justify-between rounded-[10px] border-[0.8px] border-[#c2e0ef] bg-[#f9fafb] px-[12.8px] py-[12.8px]"
                  >
                    <div className="min-w-0 pr-3">
                      <p className="font-['Inter'] text-[14px] text-[#0f3460]">
                        {details?.lien_parente?.trim() || "Lien non defini"}
                      </p>
                      <p className="font-['Inter'] text-[14px] text-[#4b6787]">{antecedent.description}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <IconActionButton
                        tone="orange"
                        disabled={pendingId === antecedent.id}
                        onClick={() => handleEditFamilial(antecedent.id, antecedent.description)}
                      >
                        <Pencil className="size-4 text-[#f77a21]" />
                      </IconActionButton>
                      <IconActionButton
                        tone="orange"
                        disabled={deleteAntecedentMutation.isPending}
                        onClick={() => deleteAntecedentMutation.mutate(antecedent.id)}
                      >
                        <Trash2 className="size-4 text-[#f77a21]" />
                      </IconActionButton>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function IconActionButton({
  onClick,
  children,
  disabled,
  tone = "default",
}: {
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
  tone?: "default" | "orange";
}) {
  return (
    <button
      className={`flex size-[35.2px] cursor-pointer items-center justify-center rounded-[10px] border-[1.6px] bg-white disabled:cursor-not-allowed disabled:opacity-60 ${
        tone === "orange"
          ? "border-[#f77a21] hover:bg-[#fff7ed]"
          : "border-[#c2e0ef]"
      }`}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex h-[154px] items-center justify-center rounded-[10px] border-[0.8px] border-dashed border-[#c2e0ef] bg-[#f9fafb]">
      <div className="flex items-center gap-2 text-[#64748b]">
        <AlertTriangle className="size-4" />
        <span className="font-['Inter'] text-[14px]">{text}</span>
      </div>
    </div>
  );
}

function AntecedentSkeleton() {
  return (
    <div className="grid w-full grid-cols-1 gap-6 pb-4 xl:grid-cols-2">
      <Skeleton className="h-[272px] rounded-[14px]" />
      <Skeleton className="h-[272px] rounded-[14px]" />
    </div>
  );
}
