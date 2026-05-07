import type { AppRouter } from "@doctor.com/api/routers/index";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import {
  CircleHelp,
  FileStack,
  Loader2,
  Plus,
  Search,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { trpc, trpcClient } from "@/utils/trpc";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type CategoryRow = RouterOutputs["ordonnance"]["getToutesCategories"][number];
type PreRempliDetail = RouterOutputs["ordonnance"]["getPreRempliById"];
type SearchMedicamentOption =
  RouterOutputs["ordonnance"]["rechercherMedicaments"][number];

type TemplateMedicationRow = {
  localId: string;
  existingId?: string;
  medicament_externe_id: string;
  nom_medicament: string;
  posologie_defaut: string;
  duree_defaut: string;
  instructions_defaut: string;
  dosage: string;
};

function createEmptyMedicationRow(): TemplateMedicationRow {
  return {
    localId: crypto.randomUUID(),
    medicament_externe_id: "",
    nom_medicament: "",
    posologie_defaut: "",
    duree_defaut: "",
    instructions_defaut: "",
    dosage: "",
  };
}

function mapDetailToRows(detail: PreRempliDetail | undefined): TemplateMedicationRow[] {
  if (!detail?.medicaments?.length) {
    return [createEmptyMedicationRow()];
  }

  return detail.medicaments.map((item) => ({
    localId: crypto.randomUUID(),
    existingId: item.id,
    medicament_externe_id: item.medicament_externe_id,
    nom_medicament: item.nom_medicament,
    posologie_defaut: item.posologie_defaut ?? "",
    duree_defaut: item.duree_defaut ?? "",
    instructions_defaut: item.instructions_defaut ?? "",
    dosage: item.dosage ?? "",
  }));
}

export function ModeleOrdonnanceDialog({
  open,
  onOpenChange,
  mode,
  templateId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  templateId?: string | null;
  onSaved?: () => Promise<void> | void;
}) {
  useModalScrollLock(open);

  const categoriesQuery = useQuery({
    ...trpc.ordonnance.getToutesCategories.queryOptions(),
    enabled: open,
    staleTime: 60_000,
  });

  const templateDetailQuery = useQuery({
    ...trpc.ordonnance.getPreRempliById.queryOptions({
      id: templateId ?? "00000000-0000-0000-0000-000000000000",
    }),
    enabled: open && mode === "edit" && Boolean(templateId),
    staleTime: 60_000,
  });

  const [nom, setNom] = useState("");
  const [categorieId, setCategorieId] = useState("");
  const [description, setDescription] = useState("");
  const [remarques, setRemarques] = useState("");
  const [rows, setRows] = useState<TemplateMedicationRow[]>([
    createEmptyMedicationRow(),
  ]);
  const [activeSearchRowId, setActiveSearchRowId] = useState<string | null>(
    null,
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [hydratedTemplateId, setHydratedTemplateId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setDebouncedSearchTerm(searchTerm.trim());
    }, 220);

    return () => window.clearTimeout(timeout);
  }, [open, searchTerm]);

  useEffect(() => {
    if (!open || mode !== "create") {
      return;
    }

    setNom("");
    setDescription("");
    setRemarques("");
    setRows([createEmptyMedicationRow()]);
    setActiveSearchRowId(null);
    setSearchTerm("");
    setDebouncedSearchTerm("");
    setHydratedTemplateId(null);

    if (!categorieId && categoriesQuery.data?.[0]?.id) {
      setCategorieId(categoriesQuery.data[0].id);
    }
  }, [open, mode, categoriesQuery.data, categorieId]);

  useEffect(() => {
    if (!open || mode !== "edit" || !templateDetailQuery.data) {
      return;
    }

    if (hydratedTemplateId === templateDetailQuery.data.id) {
      return;
    }

    setNom(templateDetailQuery.data.nom);
    setCategorieId(templateDetailQuery.data.categorie_pre_rempli_id);
    setDescription(templateDetailQuery.data.description ?? "");
    setRemarques("");
    setRows(mapDetailToRows(templateDetailQuery.data));
    setActiveSearchRowId(null);
    setSearchTerm("");
    setDebouncedSearchTerm("");
    setHydratedTemplateId(templateDetailQuery.data.id);
  }, [open, mode, templateDetailQuery.data, hydratedTemplateId]);

  const searchQuery = useQuery({
    ...trpc.ordonnance.rechercherMedicaments.queryOptions({
      query: debouncedSearchTerm,
    }),
    enabled: open && debouncedSearchTerm.length >= 2 && activeSearchRowId !== null,
    staleTime: 60_000,
  });

  const searchResults = useMemo(() => {
    const items = (searchQuery.data ?? []) as SearchMedicamentOption[];
    const term = debouncedSearchTerm.toLowerCase();

    if (!term) {
      return items;
    }

    const score = (item: SearchMedicamentOption) => {
      const nom = item.nom_medicament.toLowerCase();
      const generic = (item.nom_generique ?? "").toLowerCase();

      if (nom === term) return 0;
      if (nom.startsWith(term)) return 1;
      if (generic === term) return 2;
      if (generic.startsWith(term)) return 3;
      if (nom.includes(term)) return 4;
      if (generic.includes(term)) return 5;
      return 6;
    };

    return [...items].sort((a, b) => {
      const diff = score(a) - score(b);
      if (diff !== 0) return diff;
      return a.nom_medicament.localeCompare(b.nom_medicament, "fr");
    });
  }, [debouncedSearchTerm, searchQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const trimmedNom = nom.trim();
      if (!trimmedNom) {
        throw new Error("Le nom du modèle est obligatoire.");
      }

      if (!categorieId) {
        throw new Error("La catégorie est obligatoire.");
      }

      const normalizedDescription = description.trim() || null;
      const normalizedRows = rows
        .map((row) => ({
          ...row,
          nom_medicament: row.nom_medicament.trim(),
          medicament_externe_id: row.medicament_externe_id.trim(),
          dosage: row.dosage.trim(),
          posologie_defaut: row.posologie_defaut.trim(),
          duree_defaut: row.duree_defaut.trim(),
          instructions_defaut: row.instructions_defaut.trim(),
        }))
        .filter(
          (row) =>
            row.nom_medicament ||
            row.medicament_externe_id ||
            row.posologie_defaut ||
            row.duree_defaut ||
            row.instructions_defaut ||
            row.dosage,
        );

      if (
        normalizedRows.some(
          (row) => row.nom_medicament && !row.medicament_externe_id,
        )
      ) {
        throw new Error(
          "Sélectionnez un médicament depuis la recherche pour chaque ligne renseignée.",
        );
      }

      if (mode === "create") {
        const created = await trpcClient.ordonnance.creerPreRempli.mutate({
          nom: trimmedNom,
          description: normalizedDescription,
          categorie_pre_rempli_id: categorieId,
          specialite: remarques.trim() || null,
          est_actif: true,
        });

        for (const [index, row] of normalizedRows.entries()) {
          if (!row.medicament_externe_id) continue;
          await trpcClient.ordonnance.ajouterMedicamentAuPreRempli.mutate({
            preRempliId: created.id,
            data: {
              medicament_externe_id: row.medicament_externe_id,
              dosage: row.dosage || null,
              posologie_defaut: row.posologie_defaut || null,
              duree_defaut: row.duree_defaut || null,
              instructions_defaut: row.instructions_defaut || null,
              ordre_affichage: index + 1,
            },
          });
        }

        return created.id;
      }

      if (!templateId) {
        throw new Error("Modèle introuvable.");
      }

      await trpcClient.ordonnance.mettreAJourPreRempli.mutate({
        id: templateId,
        data: {
          nom: trimmedNom,
          description: normalizedDescription,
          categorie_pre_rempli_id: categorieId,
          specialite: remarques.trim() || null,
        },
      });

      const existingItems = templateDetailQuery.data?.medicaments ?? [];
      const nextIds = new Set(
        normalizedRows
          .map((row) => row.existingId)
          .filter((value): value is string => Boolean(value)),
      );

      for (const item of existingItems) {
        if (!nextIds.has(item.id)) {
          await trpcClient.ordonnance.retirerMedicamentDuPreRempli.mutate({
            id: item.id,
          });
        }
      }

      for (const [index, row] of normalizedRows.entries()) {
        if (!row.medicament_externe_id) continue;

        const payload = {
          medicament_externe_id: row.medicament_externe_id,
          dosage: row.dosage || null,
          posologie_defaut: row.posologie_defaut || null,
          duree_defaut: row.duree_defaut || null,
          instructions_defaut: row.instructions_defaut || null,
          ordre_affichage: index + 1,
        };

        if (row.existingId) {
          await trpcClient.ordonnance.mettreAJourMedicamentDuPreRempli.mutate({
            id: row.existingId,
            data: payload,
          });
        } else {
          await trpcClient.ordonnance.ajouterMedicamentAuPreRempli.mutate({
            preRempliId: templateId,
            data: payload,
          });
        }
      }

      return templateId;
    },
    onSuccess: async () => {
      toast.success(
        mode === "create"
          ? "Modèle d’ordonnance créé."
          : "Modèle d’ordonnance mis à jour.",
      );
      await onSaved?.();
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Impossible d’enregistrer ce modèle.",
      );
    },
  });

  const handleRowChange = (
    localId: string,
    field: keyof Omit<TemplateMedicationRow, "localId" | "existingId">,
    value: string,
  ) => {
    setRows((current) =>
      current.map((row) => {
        if (row.localId !== localId) return row;

        if (field === "nom_medicament") {
          return {
            ...row,
            nom_medicament: value,
            medicament_externe_id: "",
          };
        }

        return {
          ...row,
          [field]: value,
        };
      }),
    );
  };

  const handleSelectMedication = (
    rowId: string,
    medication: SearchMedicamentOption,
  ) => {
    setRows((current) =>
      current.map((row) =>
        row.localId === rowId
          ? {
              ...row,
              medicament_externe_id: String(medication.id),
              nom_medicament: medication.nom_medicament,
            }
          : row,
      ),
    );
    setActiveSearchRowId(null);
    setSearchTerm("");
    setDebouncedSearchTerm("");
  };

  const activeSearchRow = rows.find((row) => row.localId === activeSearchRowId);

  if (!open) {
    return null;
  }

  const isLoadingInitialData =
    categoriesQuery.isLoading || (mode === "edit" && templateDetailQuery.isLoading);
  const normalizedRows = rows.map((row) => ({
    nom_medicament: row.nom_medicament.trim(),
    medicament_externe_id: row.medicament_externe_id.trim(),
    posologie_defaut: row.posologie_defaut.trim(),
    duree_defaut: row.duree_defaut.trim(),
    instructions_defaut: row.instructions_defaut.trim(),
    dosage: row.dosage.trim(),
  }));
  const isSaveBlocked =
    !nom.trim() ||
    !categorieId ||
    normalizedRows.some((row) => row.nom_medicament && !row.medicament_externe_id);

  return (
    <>
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
      <div
        className="fixed inset-0 z-[140] flex items-center justify-center overflow-hidden bg-[rgba(10,35,65,0.24)] px-4 py-8 backdrop-blur-[4px]"
        style={{ animation: "ordonnanceOverlayIn 180ms ease-out" }}
      >
      <div className="mx-auto flex w-full max-w-[760px] items-center justify-center">
        <div
          className="flex max-h-[calc(100vh-64px)] w-full flex-col overflow-hidden rounded-[18px] bg-white shadow-[0px_30px_60px_-16px_rgba(15,52,96,0.28)]"
          style={{ animation: "ordonnanceDialogIn 220ms cubic-bezier(0.22, 1, 0.36, 1)" }}
        >
          <div className="flex h-[75px] items-center justify-between border-b-[0.8px] border-[#c2e0ef] bg-[#f8fafc] px-5">
            <div className="flex items-center gap-2">
              <FileStack className="size-5 text-[#0f3460]" strokeWidth={1.9} />
              <h3 className="font-['Plus_Jakarta_Sans'] text-[18px] font-semibold text-[#0f3460]">
                {mode === "create"
                  ? "Créer un modèle d'ordonnance"
                  : "Modifier un modèle d'ordonnance"}
              </h3>
            </div>

            <div className="flex items-center gap-4 text-[#7a93af]">
              <CircleHelp className="size-5" strokeWidth={1.8} />
              <button
                className="text-[#7a93af] transition-colors hover:text-[#0f3460]"
                onClick={() => onOpenChange(false)}
                type="button"
              >
                <X className="size-5" strokeWidth={1.8} />
              </button>
            </div>
          </div>

          <div className="consultation-modal-scrollbar flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overscroll-contain px-5 pb-[27px] pt-5">
            {isLoadingInitialData ? (
              <div className="flex h-[620px] items-center justify-center">
                <Loader2 className="size-6 animate-spin text-[#76bbdd]" />
              </div>
            ) : (
              <>
                <Field label="Nom du modèle" required>
                  <input
                    className="h-[37.6px] w-full rounded-[10px] border-[0.8px] border-[#c2e0ef] px-3 font-['Inter'] text-[14px] text-[#0f172a] outline-none placeholder:text-[rgba(10,10,10,0.5)] focus:border-[#76bbdd]"
                    onChange={(event) => setNom(event.target.value)}
                    placeholder="Ex: Hypertension artérielle"
                    value={nom}
                  />
                </Field>

                <Field label="Catégorie" required>
                  <select
                    className="h-[37.6px] w-full rounded-[10px] border-[0.8px] border-[#c2e0ef] bg-white px-3 font-['Inter'] text-[14px] text-[#0f172a] outline-none focus:border-[#76bbdd]"
                    onChange={(event) => setCategorieId(event.target.value)}
                    value={categorieId}
                  >
                    <option value="">Choisir une catégorie</option>
                    {(categoriesQuery.data ?? []).map((category: CategoryRow) => (
                      <option key={category.id} value={category.id}>
                        {category.nom}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Description">
                  <textarea
                    className="min-h-[77.6px] w-full resize-none rounded-[10px] border-[0.8px] border-[#c2e0ef] px-3 py-2 font-['Inter'] text-[14px] text-[#0f172a] outline-none placeholder:text-[rgba(10,10,10,0.5)] focus:border-[#76bbdd]"
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Description détaillée du modèle"
                    rows={3}
                    value={description}
                  />
                </Field>

                <div className="space-y-3">
                  {rows.map((row, index) => (
                    <section
                      key={row.localId}
                      className="overflow-visible rounded-[10px] border-[0.8px] border-[#c2e0ef] bg-[#f8fafc]"
                    >
                      <div className="flex h-12 items-center justify-between rounded-t-[10px] bg-[rgba(194,224,239,0.9)] px-4">
                        <p className="font-['Plus_Jakarta_Sans'] text-[16px] font-medium text-[#265284]">
                          médicament {index + 1}
                        </p>
                        {rows.length > 1 ? (
                          <button
                            className="cursor-pointer rounded-[9px] border border-[#fecaca] bg-white/70 px-3 py-1.5 font-['Inter'] text-[13px] font-medium text-[#dc2626] transition-colors hover:border-[#fca5a5] hover:bg-[#fef2f2]"
                            onClick={() =>
                              setRows((current) => {
                                const nextRows = current.filter(
                                  (item) => item.localId !== row.localId,
                                );
                                return nextRows.length > 0
                                  ? nextRows
                                  : [createEmptyMedicationRow()];
                              })
                            }
                            type="button"
                          >
                            supprimer
                          </button>
                        ) : null}
                      </div>

                      <div className="space-y-2 rounded-b-[10px] bg-white px-3 py-3">
                        <div className="relative">
                          <input
                            className="h-[33.6px] w-full rounded-[4px] border-[0.8px] border-[#c2e0ef] px-2 font-['Inter'] text-[14px] text-[#0f172a] outline-none placeholder:text-[rgba(10,10,10,0.5)] focus:border-[#76bbdd]"
                            onChange={(event) => {
                              const value = event.target.value;
                              handleRowChange(
                                row.localId,
                                "nom_medicament",
                                value,
                              );
                              setActiveSearchRowId(row.localId);
                              setSearchTerm(value);
                            }}
                            onFocus={() => {
                              setActiveSearchRowId(row.localId);
                              setSearchTerm(row.nom_medicament);
                            }}
                            placeholder="Nom du médicament / DCI *"
                            value={row.nom_medicament}
                          />

                          {activeSearchRowId === row.localId &&
                          searchTerm.trim().length >= 2 ? (
                            <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-20 overflow-hidden rounded-[10px] border border-[#c2e0ef] bg-white shadow-[0px_14px_30px_-16px_rgba(15,52,96,0.35)]">
                              {searchQuery.isLoading ? (
                                <div className="flex items-center gap-2 px-3 py-3 text-[13px] text-[#64748b]">
                                  <Loader2 className="size-4 animate-spin" />
                                  Recherche…
                                </div>
                              ) : searchResults.length === 0 ? (
                                <div className="px-3 py-3 text-[13px] text-[#64748b]">
                                  Aucun médicament trouvé.
                                </div>
                              ) : (
                                searchResults.slice(0, 6).map((item) => (
                                  <button
                                    key={item.id}
                                    className="flex w-full items-start justify-between gap-3 border-b border-[#eef6fb] px-3 py-2 text-left last:border-b-0 hover:bg-[#f8fbff]"
                                    onClick={() =>
                                      handleSelectMedication(row.localId, item)
                                    }
                                    type="button"
                                  >
                                    <div className="min-w-0">
                                      <p className="truncate font-['Inter'] text-[13px] font-medium text-[#0f3460]">
                                        {item.nom_medicament}
                                      </p>
                                      {item.nom_generique ? (
                                        <p className="truncate font-['Inter'] text-[11px] text-[#64748b]">
                                          {item.nom_generique}
                                        </p>
                                      ) : null}
                                    </div>
                                    <Search className="mt-0.5 size-3.5 shrink-0 text-[#76bbdd]" />
                                  </button>
                                ))
                              )}
                            </div>
                          ) : null}
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <input
                            className="h-[33.6px] rounded-[4px] border-[0.8px] border-[#c2e0ef] px-2 font-['Inter'] text-[14px] text-[#0f172a] outline-none placeholder:text-[rgba(10,10,10,0.5)] focus:border-[#76bbdd]"
                            onChange={(event) =>
                              handleRowChange(
                                row.localId,
                                "posologie_defaut",
                                event.target.value,
                              )
                            }
                            placeholder="Posologie (ex: 1cp x3/j)"
                            value={row.posologie_defaut}
                          />
                          <input
                            className="h-[33.6px] rounded-[4px] border-[0.8px] border-[#c2e0ef] px-2 font-['Inter'] text-[14px] text-[#0f172a] outline-none placeholder:text-[rgba(10,10,10,0.5)] focus:border-[#76bbdd]"
                            onChange={(event) =>
                              handleRowChange(
                                row.localId,
                                "duree_defaut",
                                event.target.value,
                              )
                            }
                            placeholder="Durée (ex: 7 jours)"
                            value={row.duree_defaut}
                          />
                        </div>

                        <input
                          className="h-[33.6px] w-full rounded-[4px] border-[0.8px] border-[#c2e0ef] px-2 font-['Inter'] text-[14px] text-[#0f172a] outline-none placeholder:text-[rgba(10,10,10,0.5)] focus:border-[#76bbdd]"
                          onChange={(event) =>
                            handleRowChange(
                              row.localId,
                              "instructions_defaut",
                              event.target.value,
                            )
                          }
                          placeholder="Instructions..."
                          value={row.instructions_defaut}
                        />
                      </div>
                    </section>
                  ))}

                  <button
                    className="flex h-[42px] min-h-[42px] w-full cursor-pointer items-center justify-center gap-2 rounded-[10px] border-[1.6px] border-dashed border-[#265284] font-['Inter'] text-[14px] font-semibold text-[#265284] transition-colors hover:bg-[#f8fbff]"
                    onClick={() =>
                      setRows((current) => [
                        ...current,
                        createEmptyMedicationRow(),
                      ])
                    }
                    type="button"
                  >
                    <Plus className="size-4" />
                    Ajouter un autre médicament
                  </button>
                </div>

                <Field label="Remarques">
                  <textarea
                    className="min-h-[77.6px] w-full resize-none rounded-[10px] border-[0.8px] border-[#c2e0ef] px-3 py-2 font-['Inter'] text-[14px] text-[#0f172a] outline-none focus:border-[#76bbdd]"
                    onChange={(event) => setRemarques(event.target.value)}
                    rows={3}
                    value={remarques}
                  />
                </Field>
              </>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 border-t-[0.67px] border-[rgba(194,224,239,0.4)] px-5 pb-2 pt-[8.67px]">
            <button
              className="h-[37.6px] rounded-[12px] border border-[#f77a21] px-5 font-['Plus_Jakarta_Sans'] text-[14px] font-medium text-[#f77a21] transition-colors hover:bg-[#fff7ed]"
              onClick={() => onOpenChange(false)}
              type="button"
            >
              Annuler
            </button>
            <button
              className="inline-flex h-[37.6px] min-w-[140px] items-center justify-center gap-2 rounded-[12px] bg-[#76bbdd] px-5 font-['Inter'] text-[14px] font-medium text-white shadow-[0px_4px_12px_0px_rgba(118,187,221,0.5)] transition-colors hover:bg-[#69b2d6] disabled:cursor-not-allowed disabled:bg-[#c2e0ef] disabled:text-[#6b819d] disabled:shadow-none"
              disabled={saveMutation.isPending || isLoadingInitialData || isSaveBlocked}
              onClick={() => saveMutation.mutate()}
              type="button"
            >
              {saveMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              <span>
                {mode === "create" ? "Créer le modèle" : "Enregistrer"}
              </span>
            </button>
          </div>
        </div>
      </div>
      </div>
    </>
  );
}

function useModalScrollLock(isOpen: boolean) {
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

function Field({
  label,
  required = false,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="flex w-full flex-col gap-1">
      <span className="font-['Plus_Jakarta_Sans'] text-[14px] font-semibold uppercase tracking-[0.3px] text-[#0f3460]">
        {label}
        {required ? <span className="text-[#ff6467]">*</span> : null}
      </span>
      {children}
    </label>
  );
}
