import { useMutation, useQueries, useQuery } from "@tanstack/react-query";
import {
  CircleHelp,
  FileStack,
  FileText,
  Loader2,
  Pencil,
  Plus,
  Printer,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { openBase64Pdf } from "@/lib/pdf-client";
import { MedicamentSugAiDialog } from "@/routes/patients.$id/popups/medicament-sug-ai";
import { trpc, trpcClient } from "@/utils/trpc";

type OrdonnanceMode = "manuel" | "pre-remplie";

type OrdonnanceRow = {
  id: string;
  medicament_externe_id: string;
  nom_medicament: string;
  dosage: string;
  posologie: string;
  duree_traitement: string;
  instructions: string;
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

type PreRempliItem = {
  id: string;
  nom: string;
  description: string | null;
  specialite: string | null;
  est_actif?: boolean;
};

function createEmptyRow(): OrdonnanceRow {
  return {
    id: crypto.randomUUID(),
    medicament_externe_id: "",
    nom_medicament: "",
    dosage: "",
    posologie: "",
    duree_traitement: "",
    instructions: "",
  };
}

export function NouvelleOrdonnanceDialog({
  open,
  onOpenChange,
  patientId,
  onCreated,
  values,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  onCreated?: () => void;
  values?: {
    mode?: OrdonnanceMode;
    suivi_id?: string;
    rendez_vous_id?: string;
    remarques?: string | null;
    medicaments?: Array<{
      medicament_externe_id: string;
      nom_medicament: string;
      dosage?: string;
      posologie: string;
      duree_traitement?: string;
      instructions?: string;
    }>;
  };
}) {
  const [mode, setMode] = useState<OrdonnanceMode>("manuel");
  const [selectedSuiviId, setSelectedSuiviId] = useState("");
  const [selectedRendezVousId, setSelectedRendezVousId] = useState("");
  const [rows, setRows] = useState<OrdonnanceRow[]>([createEmptyRow()]);
  const [remarques, setRemarques] = useState("");
  const [activeSearchRowId, setActiveSearchRowId] = useState<string | null>(
    null,
  );
  const [createdOrdonnanceId, setCreatedOrdonnanceId] = useState<string | null>(
    null,
  );
  const [showMedicationAiPanel, setShowMedicationAiPanel] = useState(false);
  const [isMedicationAiPanelVisible, setIsMedicationAiPanelVisible] =
    useState(false);
  const [selectedCategorieId, setSelectedCategorieId] = useState("");
  const [selectedPreRempliId, setSelectedPreRempliId] = useState("");
  const [selectedSpecialite, setSelectedSpecialite] = useState("");
  const [templateSearch, setTemplateSearch] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [isRowsDirty, setIsRowsDirty] = useState(false);
  const [appliedTemplateId, setAppliedTemplateId] = useState<string | null>(
    null,
  );
  const [templateActionLoadingId, setTemplateActionLoadingId] = useState<
    string | null
  >(null);

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

  const categoriesQuery = useQuery({
    ...trpc.ordonnance.getToutesCategories.queryOptions(),
    enabled: open && mode === "pre-remplie",
  });

  const preRemplisByCategorieQuery = useQuery({
    ...trpc.ordonnance.getPreRemplisByCategorie.queryOptions({
      categorieId:
        selectedCategorieId || "00000000-0000-0000-0000-000000000000",
    }),
    enabled: open && mode === "pre-remplie" && Boolean(selectedCategorieId),
  });

  const preRempliDetailQuery = useQuery({
    ...trpc.ordonnance.getPreRempliById.queryOptions({
      id: selectedPreRempliId || "00000000-0000-0000-0000-000000000000",
    }),
    enabled: open && mode === "pre-remplie" && Boolean(selectedPreRempliId),
  });

  const preRempliItems = useMemo(() => {
    return (preRemplisByCategorieQuery.data ?? []) as PreRempliItem[];
  }, [preRemplisByCategorieQuery.data]);

  const normalizedTemplateSearch = templateSearch.trim().toLowerCase();

  const filteredPreRemplis = useMemo(() => {
    return preRempliItems.filter((item) => {
      const bySpecialite =
        !selectedSpecialite ||
        (item.specialite ?? "").toLowerCase() ===
          selectedSpecialite.toLowerCase();

      if (!bySpecialite) {
        return false;
      }

      if (!normalizedTemplateSearch) {
        return true;
      }

      const inName = item.nom.toLowerCase().includes(normalizedTemplateSearch);
      const inDescription = (item.description ?? "")
        .toLowerCase()
        .includes(normalizedTemplateSearch);
      const inSpecialite = (item.specialite ?? "")
        .toLowerCase()
        .includes(normalizedTemplateSearch);

      return inName || inDescription || inSpecialite;
    });
  }, [preRempliItems, normalizedTemplateSearch, selectedSpecialite]);

  const uniqueSpecialites = useMemo(() => {
    const values = new Set<string>();
    preRempliItems.forEach((item) => {
      const value = item.specialite?.trim();
      if (value) values.add(value);
    });

    return [...values].sort((left, right) => left.localeCompare(right, "fr"));
  }, [preRempliItems]);

  const preRempliDetailsQueries = useQueries({
    queries: filteredPreRemplis.map((item) => ({
      ...trpc.ordonnance.getPreRempliById.queryOptions({ id: item.id }),
      enabled: open && mode === "pre-remplie",
      staleTime: 5 * 60 * 1000,
    })),
  });

  const preRempliCountById = useMemo(() => {
    const map = new Map<string, number>();

    filteredPreRemplis.forEach((item, index) => {
      const detail = preRempliDetailsQueries[index]?.data;
      map.set(item.id, detail?.medicaments.length ?? 0);
    });

    return map;
  }, [filteredPreRemplis, preRempliDetailsQueries]);

  const searchQuery = useQuery({
    ...trpc.ordonnance.rechercherMedicaments.queryOptions({
      query: debouncedSearchTerm,
    }),
    enabled: open && mode === "manuel" && debouncedSearchTerm.length >= 2,
  });

  const selectedSuivi = useMemo(
    () => suivisList.find((suivi) => suivi.id === selectedSuiviId) ?? null,
    [selectedSuiviId, suivisList],
  );

  const selectedSuiviLabel = selectedSuivi
    ? `${selectedSuivi.motif} (${selectedSuivi.date_ouverture})`
    : undefined;

  const rendezVousTerminesForSuivi = useMemo(() => {
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

  useEffect(() => {
    if (!open || mode !== "manuel") return;

    if (!selectedSuiviId && suivisList[0]?.id) {
      setSelectedSuiviId(suivisList[0].id);
    }
  }, [open, selectedSuiviId, suivisList]);

  useEffect(() => {
    if (!open) return;

    if (!selectedSuiviId) {
      setSelectedRendezVousId("");
      return;
    }

    const latest = rendezVousTerminesForSuivi[0];
    setSelectedRendezVousId(latest?.id ?? "");
  }, [open, selectedSuiviId, rendezVousTerminesForSuivi]);

  useEffect(() => {
    if (!open || mode !== "pre-remplie") return;
    if (!selectedCategorieId && categoriesQuery.data?.[0]?.id) {
      setSelectedCategorieId(categoriesQuery.data[0].id);
    }
  }, [open, mode, selectedCategorieId, categoriesQuery.data]);

  useEffect(() => {
    if (!selectedSpecialite) {
      return;
    }

    const stillExists = uniqueSpecialites.some(
      (item) => item.toLowerCase() === selectedSpecialite.toLowerCase(),
    );

    if (!stillExists) {
      setSelectedSpecialite("");
    }
  }, [selectedSpecialite, uniqueSpecialites]);

  useEffect(() => {
    if (!open || mode !== "pre-remplie") return;
    const templateList = preRemplisByCategorieQuery.data ?? [];
    const stillExists = templateList.some(
      (item) => item.id === selectedPreRempliId,
    );

    if (!stillExists && selectedPreRempliId) {
      setSelectedPreRempliId("");
    }
  }, [open, mode, selectedPreRempliId, preRemplisByCategorieQuery.data]);

  useEffect(() => {
    if (!open) return;

    const timeout = window.setTimeout(() => {
      setDebouncedSearchTerm(searchTerm.trim());
    }, 280);

    return () => window.clearTimeout(timeout);
  }, [open, mode, searchTerm]);

  useEffect(() => {
    if (!open || !values) return;

    setMode(values.mode ?? "manuel");
    setSelectedSuiviId(values.suivi_id ?? "");
    setSelectedRendezVousId(values.rendez_vous_id ?? "");
    setRows(
      values.medicaments?.length
        ? values.medicaments.map((item) => ({
            id: crypto.randomUUID(),
            medicament_externe_id: item.medicament_externe_id,
            nom_medicament: item.nom_medicament,
            dosage: item.dosage ?? "",
            posologie: item.posologie,
            duree_traitement: item.duree_traitement ?? "",
            instructions: item.instructions ?? "",
          }))
        : [createEmptyRow()],
    );
    setRemarques(values.remarques ?? "");
    setCreatedOrdonnanceId(null);
    setShowMedicationAiPanel(false);
    setSelectedCategorieId("");
    setSelectedPreRempliId("");
    setSelectedSpecialite("");
    setTemplateSearch("");
    setSearchTerm("");
    setDebouncedSearchTerm("");
    setAppliedTemplateId(null);
    setTemplateActionLoadingId(null);
    setIsRowsDirty(Boolean(values.medicaments?.length));
  }, [open, values]);

  useEffect(() => {
    if (!open || mode !== "pre-remplie") return;
    const detail = preRempliDetailQuery.data;
    if (!detail) return;
    if (appliedTemplateId === detail.id) return;

    if (
      isRowsDirty &&
      rows.some((row) => row.nom_medicament || row.posologie || row.dosage)
    ) {
      const shouldReplace = window.confirm(
        "Changer de modèle remplacera les médicaments déjà saisis. Continuer ?",
      );

      if (!shouldReplace) {
        return;
      }
    }

    const mappedRows = detail.medicaments.map((item) => ({
      id: crypto.randomUUID(),
      medicament_externe_id: item.medicament_externe_id,
      nom_medicament: item.nom_medicament,
      dosage: item.dosage ?? "",
      posologie: item.posologie_defaut ?? "",
      duree_traitement: item.duree_defaut ?? "",
      instructions: item.instructions_defaut ?? "",
    }));

    setRows(mappedRows.length > 0 ? mappedRows : [createEmptyRow()]);
    setIsRowsDirty(false);
    setAppliedTemplateId(detail.id);
  }, [
    open,
    mode,
    preRempliDetailQuery.data,
    appliedTemplateId,
    isRowsDirty,
    rows,
  ]);

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

  const createOrdonnanceMutation = useMutation({
    mutationFn: async () => {
      if (!selectedSuiviId) {
        throw new Error("Le suivi est obligatoire.");
      }

      if (!selectedRendezVousId) {
        throw new Error(
          "Aucun rendez-vous terminé trouvé pour ce suivi. Une ordonnance nécessite un rendez-vous terminé.",
        );
      }

      if (mode === "pre-remplie" && !selectedPreRempliId) {
        throw new Error(
          "Choisissez un modèle pré-rempli avant l'enregistrement.",
        );
      }

      const medicaments = rows
        .map((row) => ({
          medicament_externe_id: row.medicament_externe_id.trim(),
          dosage: row.dosage.trim() || null,
          posologie: row.posologie.trim(),
          duree_traitement: row.duree_traitement.trim() || null,
          instructions: row.instructions.trim() || null,
        }))
        .filter((row) => row.medicament_externe_id && row.posologie);

      if (medicaments.length === 0) {
        throw new Error("Ajoutez au moins un médicament valide.");
      }

      const today = new Date().toISOString().slice(0, 10);

      if (mode === "pre-remplie" && selectedPreRempliId) {
        const templateItems = preRempliDetailQuery.data?.medicaments ?? [];
        const templateExternalIds = new Set(
          templateItems.map((item) => item.medicament_externe_id),
        );

        const hasExtras = rows.some(
          (row) =>
            row.medicament_externe_id &&
            !templateExternalIds.has(row.medicament_externe_id),
        );

        if (!hasExtras) {
          const modifications: Array<{
            medicament_externe_id?: string;
            nom_medicament?: string;
            ignorer?: boolean;
            dosage?: string | null;
            posologie?: string;
            duree_traitement?: string | null;
            instructions?: string | null;
          }> = [];

          const rowsByExternalId = new Map(
            rows
              .filter((row) => row.medicament_externe_id)
              .map((row) => [row.medicament_externe_id, row]),
          );

          for (const templateItem of templateItems) {
            const row = rowsByExternalId.get(
              templateItem.medicament_externe_id,
            );
            if (!row) {
              modifications.push({
                medicament_externe_id: templateItem.medicament_externe_id,
                ignorer: true,
              });
              continue;
            }

            const dosage = row.dosage.trim() || null;
            const posologie = row.posologie.trim();
            const duree = row.duree_traitement.trim() || null;
            const instructions = row.instructions.trim() || null;

            const dosageChanged = dosage !== (templateItem.dosage ?? null);
            const posologieChanged =
              posologie !== (templateItem.posologie_defaut ?? "").trim();
            const dureeChanged = duree !== (templateItem.duree_defaut ?? null);
            const instructionsChanged =
              instructions !== (templateItem.instructions_defaut ?? null);

            if (
              dosageChanged ||
              posologieChanged ||
              dureeChanged ||
              instructionsChanged
            ) {
              modifications.push({
                medicament_externe_id: templateItem.medicament_externe_id,
                dosage,
                posologie,
                duree_traitement: duree,
                instructions,
              });
            }
          }

          const result =
            await trpcClient.ordonnance.creerOrdonnanceDepuisPreRempli.mutate({
              preRempliId: selectedPreRempliId,
              patientId,
              rendezVousId: selectedRendezVousId,
              modifications:
                modifications.length > 0 ? modifications : undefined,
            });

          return result.id;
        }
      }

      const result = await trpcClient.ordonnance.creerOrdonnance.mutate({
        patient_id: patientId,
        rendez_vous_id: selectedRendezVousId,
        date_prescription: today,
        remarques: remarques.trim() || null,
        pre_rempli_origine_id:
          mode === "pre-remplie" ? selectedPreRempliId || null : null,
        medicaments,
      });

      return result.id;
    },
    onSuccess: (ordonnanceId) => {
      setCreatedOrdonnanceId(ordonnanceId);
      toast.success("Ordonnance enregistrée avec succès");
      onCreated?.();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const previewMutation = useMutation({
    mutationFn: async () => {
      const ordonnanceId = createdOrdonnanceId;
      if (!ordonnanceId) {
        throw new Error(
          "Enregistrez d'abord l'ordonnance pour la prévisualiser.",
        );
      }

      return trpcClient.export.exporterOrdonnance.mutate({ id: ordonnanceId });
    },
    onSuccess: (payload) => {
      openBase64Pdf({
        base64Data: payload.data,
        filename: payload.filename,
        mimeType: payload.mimeType,
      });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  useEffect(() => {
    if (!open) return;
    setCreatedOrdonnanceId(null);
  }, [
    open,
    rows,
    remarques,
    selectedSuiviId,
    selectedRendezVousId,
    mode,
    selectedPreRempliId,
  ]);

  useEffect(() => {
    if (!open) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (showMedicationAiPanel) {
          setShowMedicationAiPanel(false);
          return;
        }
        onOpenChange(false);
      }
    };

    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [open, onOpenChange, showMedicationAiPanel]);

  useEffect(() => {
    if (mode === "pre-remplie" && showMedicationAiPanel) {
      setShowMedicationAiPanel(false);
    }
  }, [mode, showMedicationAiPanel]);

  useEffect(() => {
    if (!showMedicationAiPanel) {
      setIsMedicationAiPanelVisible(false);
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      setIsMedicationAiPanelVisible(true);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [showMedicationAiPanel]);

  useEffect(() => {
    if (!open) {
      setMode("manuel");
      setSelectedSuiviId("");
      setSelectedRendezVousId("");
      setRows([createEmptyRow()]);
      setRemarques("");
      setCreatedOrdonnanceId(null);
      setActiveSearchRowId(null);
      setShowMedicationAiPanel(false);
      setSelectedCategorieId("");
      setSelectedPreRempliId("");
      setSelectedSpecialite("");
      setTemplateSearch("");
      setSearchTerm("");
      setDebouncedSearchTerm("");
      setIsRowsDirty(false);
      setAppliedTemplateId(null);
      setTemplateActionLoadingId(null);
    }
  }, [open]);

  if (!open) {
    return null;
  }

  const isBusy =
    createOrdonnanceMutation.isPending || previewMutation.isPending;
  const showManualEditor = mode === "manuel";
  const hasRightPanel = showMedicationAiPanel;

  const applyTemplateRows = async (
    preRempliId: string,
    nextMode: OrdonnanceMode,
  ) => {
    setTemplateActionLoadingId(preRempliId);
    try {
      const detail = await trpcClient.ordonnance.getPreRempliById.query({
        id: preRempliId,
      });

      const mappedRows = detail.medicaments.map((item) => ({
        id: crypto.randomUUID(),
        medicament_externe_id: item.medicament_externe_id,
        nom_medicament: item.nom_medicament,
        dosage: item.dosage ?? "",
        posologie: item.posologie_defaut ?? "",
        duree_traitement: item.duree_defaut ?? "",
        instructions: item.instructions_defaut ?? "",
      }));

      setSelectedPreRempliId(preRempliId);
      setAppliedTemplateId(preRempliId);
      setRows(mappedRows.length > 0 ? mappedRows : [createEmptyRow()]);
      setMode(nextMode);
      setIsRowsDirty(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Impossible de charger le modèle.",
      );
    } finally {
      setTemplateActionLoadingId(null);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[rgba(10,35,65,0.2)] p-4"
        onMouseDown={(event) => {
          if (event.currentTarget === event.target) {
            onOpenChange(false);
          }
        }}
      >
        <div
          className={`my-4 flex w-full flex-col items-stretch gap-3 transition-[max-width] duration-300 ease-out ${
            hasRightPanel
              ? "max-w-[1215px] lg:flex-row lg:items-stretch"
              : "max-w-[600px] items-center"
          }`}
        >
          <div
            className={`flex w-full max-w-[600px] flex-col overflow-hidden rounded-[14px] bg-white shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] transition-[height,transform] duration-300 ease-out ${
              hasRightPanel ? "lg:h-[723px]" : ""
            }`}
          >
            <div className="flex h-[68px] items-center justify-between border-b-[0.8px] border-[#c2e0ef] px-5">
              <div className="flex items-center gap-2">
                <FileText className="size-5 text-[#0f3460]" />
                <p className="font-['Plus_Jakarta_Sans'] text-[18px] font-medium text-[#0f3460]">
                  Créer une ordonnance
                </p>
              </div>

              <div className="flex items-center gap-3">
                {mode === "manuel" ? (
                  <button
                    className={`inline-flex h-[33px] cursor-pointer items-center gap-2 rounded-[10px] border px-3 font-['Plus_Jakarta_Sans'] text-[13px] font-medium transition-colors ${
                      showMedicationAiPanel
                        ? "border-[#265284] bg-[#265284] text-white hover:bg-[#1f436d]"
                        : "border-[#c2e0ef] bg-[#f0f6ff] text-[#265284] hover:bg-[#e2eff8]"
                    }`}
                    onClick={() => {
                      setShowMedicationAiPanel((current) => !current);
                    }}
                    type="button"
                  >
                    <Sparkles className="size-3.5" />
                    <span>IA médicaments</span>
                  </button>
                ) : null}
                <button
                  aria-label="Aide"
                  className="cursor-pointer text-[#0f3460] transition-colors hover:text-[#265284]"
                  type="button"
                >
                  <CircleHelp className="size-5" />
                </button>
                <button
                  className="cursor-pointer text-[#0f3460] transition-colors hover:text-[#265284]"
                  onClick={() => onOpenChange(false)}
                  type="button"
                >
                  <X className="size-5" />
                </button>
              </div>
            </div>

            <div
              className={`consultation-modal-scrollbar flex flex-col overflow-y-auto px-5 pb-4 pt-5 ${
                hasRightPanel
                  ? "max-h-[calc(723px-68px)] lg:flex-1"
                  : "max-h-[82vh]"
              }`}
            >
              <FieldLabel required text="Suivi lié" />
              <select
                className="h-[50px] w-full rounded-[10px] border-[1.5px] border-[#c2e0ef] px-4 font-['Inter'] text-[14px] text-[#0f3460]"
                onChange={(event) => setSelectedSuiviId(event.target.value)}
                value={selectedSuiviId}
              >
                <option value="">Sélectionner un suivi</option>
                {suivisList.map((suivi) => (
                  <option key={suivi.id} value={suivi.id}>
                    {suivi.motif} ({suivi.date_ouverture})
                  </option>
                ))}
              </select>

              <div className="mt-4 grid grid-cols-2 gap-4">
                <button
                  className={`h-[37.6px] cursor-pointer rounded-[10px] border font-['Plus_Jakarta_Sans'] text-[14px] font-medium transition-colors ${
                    mode === "manuel"
                      ? "bg-[#265284] text-white"
                      : "border-[#c2e0ef] text-[rgba(100,116,139,0.9)] hover:bg-[#f8fafc]"
                  }`}
                  onClick={() => setMode("manuel")}
                  type="button"
                >
                  <span className="inline-flex items-center gap-2">
                    <Pencil className="size-4" />
                    <span>Manuel</span>
                  </span>
                </button>
                <button
                  className={`h-[37.6px] cursor-pointer rounded-[10px] border font-['Plus_Jakarta_Sans'] text-[14px] font-medium transition-colors ${
                    mode === "pre-remplie"
                      ? "bg-[#265284] text-white"
                      : "border-[#c2e0ef] text-[rgba(100,116,139,0.9)] hover:bg-[#f8fafc]"
                  }`}
                  onClick={() => {
                    setShowMedicationAiPanel(false);
                    setMode("pre-remplie");
                  }}
                  type="button"
                >
                  <span className="inline-flex items-center gap-2">
                    <FileStack className="size-4" />
                    <span>Pré-remplie</span>
                  </span>
                </button>
              </div>

              {mode === "pre-remplie" ? (
                <div className="mt-4 w-full rounded-[14px]">
                  <div className="flex w-full flex-col gap-[10px]">
                    <div className="relative h-[50px] w-full">
                      <input
                        className="h-[50px] w-full rounded-[14px] border-[1.5px] border-[#c2e0ef] bg-white pl-12 pr-4 font-['Plus_Jakarta_Sans'] text-[14px] text-[#0f3460] placeholder:text-[rgba(5,44,160,0.4)]"
                        onChange={(event) =>
                          setTemplateSearch(event.target.value)
                        }
                        placeholder="Rechercher un médicament..."
                        value={templateSearch}
                      />
                      <Search className="absolute left-4 top-[14px] size-5 text-[#265284]" />
                    </div>

                    <div className="grid grid-cols-2 gap-[10px]">
                      <select
                        className="h-[50px] rounded-[14px] border-[1.5px] border-[#c2e0ef] bg-white px-4 font-['Plus_Jakarta_Sans'] text-[14px] text-[#0f3460]"
                        onChange={(event) =>
                          setSelectedSpecialite(event.target.value)
                        }
                        value={selectedSpecialite}
                      >
                        <option value="">Toutes les spécialités</option>
                        {uniqueSpecialites.map((specialite) => (
                          <option key={specialite} value={specialite}>
                            {specialite}
                          </option>
                        ))}
                      </select>

                      <select
                        className="h-[50px] rounded-[14px] border-[1.5px] border-[#c2e0ef] bg-white px-4 font-['Plus_Jakarta_Sans'] text-[14px] text-[#0f3460]"
                        onChange={(event) => {
                          setSelectedCategorieId(event.target.value);
                          setSelectedPreRempliId("");
                          setAppliedTemplateId(null);
                        }}
                        value={selectedCategorieId}
                      >
                        <option value="">Toutes les catégories</option>
                        {(categoriesQuery.data ?? []).map((categorie) => (
                          <option key={categorie.id} value={categorie.id}>
                            {categorie.nom}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="consultation-modal-scrollbar mt-3 flex max-h-[365px] w-full flex-col gap-3 overflow-y-auto pr-1">
                    {filteredPreRemplis.length === 0 ? (
                      <div className="rounded-[10px] border-[1.5px] border-[#c2e0ef] bg-white px-4 py-6 text-center font-['Inter'] text-[13px] text-[rgba(100,116,139,0.9)]">
                        Aucun modèle trouvé.
                      </div>
                    ) : (
                      filteredPreRemplis.map((preRempli) => {
                        const medicamentsCount =
                          preRempliCountById.get(preRempli.id) ?? 0;
                        const isLoading =
                          templateActionLoadingId === preRempli.id;

                        const isSelected = selectedPreRempliId === preRempli.id;

                        return (
                          <article
                            key={preRempli.id}
                            className={`rounded-[10px] border-[1.5px] px-[16.8px] pb-[0.8px] pt-[16.8px] transition-colors ${
                              isSelected
                                ? "border-[#265284] bg-[#f0f6ff] shadow-[0px_0px_0px_2px_rgba(38,82,132,0.12)]"
                                : "border-[#c2e0ef] bg-white"
                            }`}
                          >
                            <div className="grid grid-cols-[1fr_auto] gap-3">
                              <div className="space-y-2">
                                <p className="font-['Inter'] text-[14px] font-semibold text-[#0f3460]">
                                  {preRempli.nom}
                                </p>
                                <p className="font-['Inter'] text-[12px] text-[#415c7b]">
                                  {preRempli.description ||
                                    "Modèle pré-rempli de prescription médicale"}
                                </p>
                                <p className="font-['Inter'] text-[12px] text-[rgba(100,116,139,0.79)]">
                                  {medicamentsCount > 0
                                    ? `${medicamentsCount} médicament${medicamentsCount > 1 ? "s" : ""}`
                                    : "Aucun médicament"}
                                </p>
                              </div>

                              <div className="flex flex-col gap-[10px] px-[12px] pb-[14px]">
                                <button
                                  className={`h-[29px] w-[72px] cursor-pointer rounded-[12px] font-['Plus_Jakarta_Sans'] text-[14px] font-medium text-white shadow-[0px_4px_12px_0px_rgba(118,187,221,0.5)] transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                                    isSelected
                                      ? "bg-[#265284] hover:bg-[#1f436d]"
                                      : "bg-[#76bbdd] hover:bg-[#63b0d6]"
                                  }`}
                                  disabled={isLoading}
                                  onClick={() =>
                                    void applyTemplateRows(
                                      preRempli.id,
                                      "pre-remplie",
                                    )
                                  }
                                  type="button"
                                >
                                  {isSelected ? "Utilisé" : "Utiliser"}
                                </button>
                                <button
                                  className="h-[29.59px] w-[72.31px] cursor-pointer rounded-[12px] border border-[#f77a21] font-['Plus_Jakarta_Sans'] text-[12px] font-medium text-[#f77a21] transition-colors hover:bg-[#fff7ed] disabled:cursor-not-allowed disabled:opacity-60"
                                  disabled={isLoading}
                                  onClick={() =>
                                    void applyTemplateRows(
                                      preRempli.id,
                                      "manuel",
                                    )
                                  }
                                  type="button"
                                >
                                  Modifier
                                </button>
                              </div>
                            </div>
                          </article>
                        );
                      })
                    )}
                  </div>
                </div>
              ) : null}

              {showManualEditor ? (
                <div className="mt-4 space-y-3">
                  {rows.map((row, index) => (
                    <div
                      key={row.id}
                      className="rounded-[10px] border border-[#c2e0ef] bg-[#f8fafc]"
                    >
                      <div className="flex items-center justify-between border-b border-[#c2e0ef] bg-[#c2e0ef] px-4 py-2">
                        <p className="font-['Plus_Jakarta_Sans'] text-[14px] font-medium text-[#265284]">
                          médicament {index + 1}
                        </p>
                        {rows.length > 1 ? (
                          <button
                            className="cursor-pointer rounded-[8px] border border-[#fecaca] px-2 py-1 font-['Inter'] text-[12px] text-[#dc2626] transition-colors hover:border-[#fca5a5] hover:bg-[#fef2f2]"
                            onClick={() => {
                              setRows((prev) =>
                                prev.filter((item) => item.id !== row.id),
                              );
                              setCreatedOrdonnanceId(null);
                            }}
                            type="button"
                          >
                            supprimer
                          </button>
                        ) : null}
                      </div>

                      <div className="space-y-2 p-3">
                        <div className="relative">
                          <input
                            className="h-[34px] w-full rounded-[4px] border border-[#c2e0ef] px-2 pr-8 font-['Plus_Jakarta_Sans'] text-[14px] text-[#0f3460]"
                            onChange={(event) => {
                              const value = event.target.value;
                              setSearchTerm(value);
                              setRows((prev) =>
                                prev.map((item) =>
                                  item.id === row.id
                                    ? {
                                        ...item,
                                        nom_medicament: value,
                                        medicament_externe_id:
                                          value.trim() !==
                                          item.nom_medicament.trim()
                                            ? ""
                                            : item.medicament_externe_id,
                                      }
                                    : item,
                                ),
                              );
                              setIsRowsDirty(true);
                            }}
                            onBlur={() => {
                              window.setTimeout(() => {
                                setActiveSearchRowId((current) =>
                                  current === row.id ? null : current,
                                );
                              }, 120);
                            }}
                            onFocus={() => {
                              setActiveSearchRowId(row.id);
                              setSearchTerm(row.nom_medicament);
                            }}
                            placeholder="Nom du médicament / DCI *"
                            value={row.nom_medicament}
                          />
                          <Search className="absolute right-2 top-2.5 size-4 text-[#94a3b8]" />
                        </div>

                        {activeSearchRowId === row.id ? (
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
                                      setRows((prev) =>
                                        prev.map((current) =>
                                          current.id === row.id
                                            ? {
                                                ...current,
                                                medicament_externe_id: String(
                                                  item.id,
                                                ),
                                                nom_medicament:
                                                  item.nom_medicament,
                                                posologie:
                                                  current.posologie ||
                                                  item.posologie_adulte ||
                                                  item.posologie_enfant ||
                                                  "",
                                                dosage:
                                                  current.dosage ||
                                                  item.dose_maximale ||
                                                  "",
                                                instructions:
                                                  current.instructions ||
                                                  item.frequence_administration ||
                                                  "",
                                              }
                                            : current,
                                        ),
                                      );
                                      setActiveSearchRowId(null);
                                      setSearchTerm(item.nom_medicament);
                                      setIsRowsDirty(true);
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
                            className="h-[33px] rounded-[4px] border border-[#c2e0ef] px-2 font-['Plus_Jakarta_Sans'] text-[14px] text-[#0f3460]"
                            onChange={(event) => {
                              const value = event.target.value;
                              setRows((prev) =>
                                prev.map((item) =>
                                  item.id === row.id
                                    ? { ...item, posologie: value }
                                    : item,
                                ),
                              );
                              setIsRowsDirty(true);
                            }}
                            placeholder="Posologie"
                            value={row.posologie}
                          />
                          <input
                            className="h-[33px] rounded-[4px] border border-[#c2e0ef] px-2 font-['Plus_Jakarta_Sans'] text-[14px] text-[#0f3460]"
                            onChange={(event) => {
                              const value = event.target.value;
                              setRows((prev) =>
                                prev.map((item) =>
                                  item.id === row.id
                                    ? { ...item, duree_traitement: value }
                                    : item,
                                ),
                              );
                              setIsRowsDirty(true);
                            }}
                            placeholder="Durée"
                            value={row.duree_traitement}
                          />
                        </div>

                        <input
                          className="h-[33px] w-full rounded-[4px] border border-[#c2e0ef] px-2 font-['Plus_Jakarta_Sans'] text-[14px] text-[#0f3460]"
                          onChange={(event) => {
                            const value = event.target.value;
                            setRows((prev) =>
                              prev.map((item) =>
                                item.id === row.id
                                  ? { ...item, dosage: value }
                                  : item,
                              ),
                            );
                            setIsRowsDirty(true);
                          }}
                          placeholder="Dosage"
                          value={row.dosage}
                        />

                        <input
                          className="h-[33px] w-full rounded-[4px] border border-[#c2e0ef] px-2 font-['Plus_Jakarta_Sans'] text-[14px] text-[#0f3460]"
                          onChange={(event) => {
                            const value = event.target.value;
                            setRows((prev) =>
                              prev.map((item) =>
                                item.id === row.id
                                  ? { ...item, instructions: value }
                                  : item,
                              ),
                            );
                            setIsRowsDirty(true);
                          }}
                          placeholder="Instructions..."
                          value={row.instructions}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              {!selectedRendezVousId && selectedSuivi ? (
                <p className="mt-3 rounded-[10px] border border-[#f97316] bg-[#fff7ed] px-3 py-2 font-['Inter'] text-[12px] text-[#b45309]">
                  Aucun rendez-vous terminé trouvé pour ce suivi. La création
                  d'ordonnance est bloquée.
                </p>
              ) : null}

              {showManualEditor ? (
                <button
                  className="mt-3 flex h-[42px] cursor-pointer items-center justify-center gap-2 rounded-[10px] border-[1.6px] border-dashed border-[#265284] font-['Inter'] text-[14px] font-semibold text-[#265284] transition-colors hover:bg-[#f8fbff]"
                  onClick={() => {
                    setRows((prev) => [...prev, createEmptyRow()]);
                    setIsRowsDirty(true);
                  }}
                  type="button"
                >
                  <Plus className="size-4" />
                  Ajouter un autre médicament
                </button>
              ) : null}

              {showManualEditor ? (
                <div className="mt-4">
                  <FieldLabel text="Remarques" />
                  <textarea
                    className="h-[74px] w-full resize-none rounded-[10px] border-[0.8px] border-[#c2e0ef] px-3 py-2 font-['Inter'] text-[14px] text-[#0f3460]"
                    onChange={(event) => setRemarques(event.target.value)}
                    placeholder="Remarques..."
                    value={remarques}
                  />
                </div>
              ) : null}

              <div className="mt-4 flex items-center justify-between pb-1">
                <div className="flex items-center gap-2">
                  <button
                    className="h-[37.6px] cursor-pointer rounded-[10px] border border-[#f97316] px-4 font-['Inter'] text-[14px] text-[#f97316] transition-colors hover:bg-[#fff7ed]"
                    onClick={() => onOpenChange(false)}
                    type="button"
                  >
                    Annuler
                  </button>
                  <button
                    className={`h-[37.6px] cursor-pointer rounded-[10px] px-4 font-['Poppins'] text-[14px] text-white transition-colors disabled:cursor-not-allowed disabled:opacity-70 ${
                      mode === "pre-remplie"
                        ? "bg-[#0f3460] hover:bg-[#0b2747]"
                        : "bg-[#76bbdd] hover:bg-[#63b0d6]"
                    }`}
                    disabled={isBusy}
                    onClick={() => createOrdonnanceMutation.mutate()}
                    type="button"
                  >
                    {createOrdonnanceMutation.isPending ? (
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
                  disabled={!createdOrdonnanceId || previewMutation.isPending}
                  onClick={() => previewMutation.mutate()}
                  type="button"
                >
                  imprimer
                  <Printer className="size-3.5" />
                </button>
              </div>
            </div>
          </div>

          {showMedicationAiPanel ? (
            <div
              className={`w-full max-w-[600px] self-center transition-[opacity,transform] duration-300 ease-out lg:self-start ${
                isMedicationAiPanelVisible
                  ? "translate-x-0 opacity-100"
                  : "translate-x-4 opacity-0"
              }`}
            >
              <MedicamentSugAiDialog
                onOpenChange={(nextOpen) => {
                  if (!nextOpen) {
                    setShowMedicationAiPanel(false);
                  }
                }}
                onSelectMedicament={(item) => {
                  const existingIndex = rows.findIndex(
                    (row) =>
                      row.medicament_externe_id === item.medicament_externe_id,
                  );

                  if (existingIndex >= 0) {
                    toast.info(
                      `${item.nom_medicament} est déjà présent dans l'ordonnance.`,
                    );
                    return;
                  }

                  setMode("manuel");
                  setRows((prev) => [
                    ...prev,
                    {
                      id: crypto.randomUUID(),
                      medicament_externe_id: item.medicament_externe_id,
                      nom_medicament: item.nom_medicament,
                      dosage: "",
                      posologie: "",
                      duree_traitement: "",
                      instructions: "",
                    },
                  ]);
                  toast.success(`${item.nom_medicament} ajouté à l'ordonnance`);
                  setShowMedicationAiPanel(false);
                  setIsRowsDirty(true);
                }}
                open={showMedicationAiPanel}
                suiviLabel={selectedSuiviLabel}
                variant="side-panel"
              />
            </div>
          ) : null}
        </div>
      </div>
    </>
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
