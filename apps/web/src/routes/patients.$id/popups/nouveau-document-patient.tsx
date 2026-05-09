import { useMutation } from "@tanstack/react-query";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  FileCheck2,
  FileText,
  Loader2,
  ShieldAlert,
  UploadCloud,
  X,
  XCircle,
} from "lucide-react";
import type { ChangeEvent, DragEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { getServerBaseUrl } from "@/lib/server-url";
import { cn } from "@/lib/utils";
import { DialogShell } from "@/routes/agenda/popups/rdv-dialog-shared";
import { queryClient, trpc, trpcClient } from "@/utils/trpc";

type UploadedDocument = {
  id: string;
  patient_id: string;
  categorie_id: string;
  type_document: string;
  nom_document: string;
  chemin_fichier: string;
  type_fichier: string;
  taille_fichier: number;
  description: string | null;
  date_upload: string;
  uploade_par_utilisateur: string;
  est_archive: boolean;
};

type DocumentSummary = {
  document_key: string;
  title: string;
  description: string;
  anomalies: {
    label: string;
    severity: "info" | "warning" | "critical";
    details: string;
  }[];
};

type DocumentSuggestion = {
  suggestion_id: string;
  table: string;
  field: string;
  category:
    | "demographic"
    | "lab_value"
    | "antecedent"
    | "treatment"
    | "vaccination"
    | "other";
  current_value: string | null;
  suggested_value: string;
  reason: string;
  confidence: number;
  severity?: "normal" | "abnormal" | "critical";
  source?: {
    document_key: string;
    modality: string;
    snippet?: string;
  };
};

type ProposedAction = {
  action_id: string;
  mutation: string;
  input: Record<string, unknown>;
  description: string;
  suggestion_ids: string[];
};

type DocumentAnalysisResult = {
  validated: boolean;
  confidence: number;
  document_summaries: DocumentSummary[];
  identity_flag: "match" | "mismatch" | "uncertain";
  identity: {
    verifiable: boolean;
    patient_match: boolean;
    confidence: number;
    details: string;
    matched_fields: string[];
    mismatched_fields: { field: string; expected: string; found: string }[];
    risk_level: "low" | "medium" | "high";
  };
  suggestions?: DocumentSuggestion[];
  proposed_actions: ProposedAction[];
  extraction_stats: {
    documents_processed: number;
    processing_time_ms: number;
    cache_hit: boolean;
  };
};

type FileDraft = {
  id: string;
  file: File;
  nom_document: string;
  description: string;
  analyse: boolean;
  status: "ready" | "uploading" | "uploaded" | "error";
  uploadedDocument?: UploadedDocument;
  error?: string;
};

type SuggestionDecision = "accepted" | "rejected";

const MAX_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_DOCUMENT_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
]);
const ACCEPTED_DOCUMENT_EXTENSIONS = new Set([
  "pdf",
  "png",
  "jpg",
  "jpeg",
  "webp",
]);

export function NouveauDocumentPatientDialog({
  open,
  onOpenChange,
  patientId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  onCreated?: () => void;
}) {
  const [fileDrafts, setFileDrafts] = useState<FileDraft[]>([]);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [analysisResult, setAnalysisResult] =
    useState<DocumentAnalysisResult | null>(null);
  const [verificationError, setVerificationError] = useState<string | null>(
    null,
  );
  const [suggestionDecisions, setSuggestionDecisions] = useState<
    Record<string, SuggestionDecision>
  >({});

  useEffect(() => {
    if (open) return;
    setFileDrafts([]);
    setIsDraggingFile(false);
    setAnalysisResult(null);
    setVerificationError(null);
    setSuggestionDecisions({});
  }, [open]);

  const analysisMutation = useMutation({
    mutationFn: async (documents: UploadedDocument[]) => {
      return (await trpcClient.ai.documentAnomaly.analyzeDocuments.mutate({
        patient_id: patientId,
        document_keys: documents.map((document) => document.chemin_fichier),
      })) as DocumentAnalysisResult;
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (fileDrafts.length === 0) {
        throw new Error("Ajoutez au moins un document.");
      }

      const draftsToUpload = fileDrafts.filter(
        (draft) => draft.status !== "uploaded",
      );
      if (draftsToUpload.length === 0) {
        throw new Error("Tous les documents sélectionnés sont déjà importés.");
      }

      const uploadedItems: { draftId: string; document: UploadedDocument }[] = [];
      const failedItems: { draftId: string; message: string }[] = [];

      for (const draft of draftsToUpload) {
        setFileDrafts((current) =>
          current.map((item) =>
            item.id === draft.id
              ? { ...item, status: "uploading", error: undefined }
              : item,
          ),
        );

        try {
          const document = await uploadDocument(patientId, draft);
          uploadedItems.push({ draftId: draft.id, document });
          setFileDrafts((current) =>
            current.map((item) =>
              item.id === draft.id
                ? { ...item, status: "uploaded", uploadedDocument: document }
                : item,
            ),
          );
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : "Le document n'a pas pu etre importe.";
          setFileDrafts((current) =>
            current.map((item) =>
              item.id === draft.id
                ? { ...item, status: "error", error: message }
                : item,
            ),
          );
          failedItems.push({ draftId: draft.id, message });
        }
      }

      if (uploadedItems.length === 0 && failedItems.length > 0) {
        throw new Error(failedItems[0]?.message ?? "Import impossible.");
      }

      return { uploadedItems, failedItems };
    },
    onSuccess: async ({ uploadedItems, failedItems }) => {
      const uploadedDocuments = uploadedItems.map((item) => item.document);
      if (failedItems.length > 0) {
        toast.warning(
          `${uploadedDocuments.length} document(s) importe(s), ${failedItems.length} en erreur`,
        );
      } else {
        toast.success(`${uploadedDocuments.length} document(s) importe(s)`);
      }
      await onCreated?.();

      const uploadedByDraftId = new Map(
        uploadedItems.map((item) => [item.draftId, item.document]),
      );
      const analyzeDocuments = fileDrafts
        .filter((draft) => draft.analyse)
        .map((draft) => uploadedByDraftId.get(draft.id) ?? draft.uploadedDocument)
        .filter((document): document is UploadedDocument => Boolean(document));

      if (analyzeDocuments.length === 0 || uploadedDocuments.length === 0) {
        return;
      }

      setVerificationError(null);
      try {
        const result = await analysisMutation.mutateAsync(analyzeDocuments);
        setAnalysisResult(result);
        fillGeneratedDraftDescriptions(uploadedItems, result.document_summaries ?? []);
        await syncGeneratedDescriptions(
          uploadedDocuments,
          result.document_summaries ?? [],
        );
        await onCreated?.();
        toast.success("Analyse des documents terminee");
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Analyse des documents indisponible.";
        setVerificationError(message);
        toast.error(message);
      }
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const applySuggestionMutation = useMutation({
    mutationFn: async (action: ProposedAction) => {
      await applyProposedAction(action);
      return action;
    },
    onSuccess: async (action) => {
      action.suggestion_ids.forEach((suggestionId) => {
        setSuggestionDecisions((current) => ({
          ...current,
          [suggestionId]: "accepted",
        }));
      });
      await invalidatePatientData(patientId);
      toast.success("Suggestion acceptee");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const isBusy = uploadMutation.isPending || analysisMutation.isPending;
  const isApplyingSuggestion = applySuggestionMutation.isPending;

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isBusy) {
        onOpenChange(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isBusy, open, onOpenChange]);

  const analyzedUploadedDocuments = useMemo(
    () => fileDrafts.flatMap((draft) => (draft.uploadedDocument ? [draft.uploadedDocument] : [])),
    [fileDrafts],
  );

  const suggestions = analysisResult?.suggestions ?? [];
  const proposedActionsBySuggestionId = useMemo(() => {
    const map = new Map<string, ProposedAction>();
    for (const action of analysisResult?.proposed_actions ?? []) {
      if (!isSupportedProposedAction(action)) continue;
      for (const suggestionId of action.suggestion_ids) {
        map.set(suggestionId, action);
      }
    }
    return map;
  }, [analysisResult?.proposed_actions]);

  const addFiles = (files: FileList | File[]) => {
    const nextFiles = Array.from(files);
    if (nextFiles.length === 0) return;

    const validDrafts: FileDraft[] = [];
    for (const file of nextFiles) {
      const validationError = validateDocumentFile(file);
      if (validationError) {
        toast.error(`${file.name}: ${validationError}`);
        continue;
      }

      validDrafts.push({
        id: crypto.randomUUID(),
        file,
        nom_document: getDocumentNameFromFile(file),
        description: "",
        analyse: true,
        status: "ready",
      });
    }

    if (validDrafts.length === 0) return;

    setAnalysisResult(null);
    setVerificationError(null);
    setSuggestionDecisions({});
    setFileDrafts((current) => {
      const existingKeys = new Set(
        current.map((draft) => `${draft.file.name}-${draft.file.size}`),
      );
      return [
        ...current,
        ...validDrafts.filter(
          (draft) => !existingKeys.has(`${draft.file.name}-${draft.file.size}`),
        ),
      ];
    });
  };

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      addFiles(event.target.files);
    }
    event.target.value = "";
  };

  const onFileDragOver = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    if (!isBusy) {
      setIsDraggingFile(true);
    }
  };

  const onFileDragLeave = (event: DragEvent<HTMLLabelElement>) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
      return;
    }
    setIsDraggingFile(false);
  };

  const onFileDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDraggingFile(false);
    if (isBusy) return;
    addFiles(event.dataTransfer.files);
  };

  const toggleAnalyse = (draftId: string) => {
    setFileDrafts((current) =>
      current.map((draft) =>
        draft.id === draftId ? { ...draft, analyse: !draft.analyse } : draft,
      ),
    );
  };

  const removeDraft = (draftId: string) => {
    setFileDrafts((current) => current.filter((draft) => draft.id !== draftId));
  };

  const updateDraft = (
    draftId: string,
    changes: Partial<Pick<FileDraft, "nom_document" | "description">>,
  ) => {
    setFileDrafts((current) =>
      current.map((draft) =>
        draft.id === draftId ? { ...draft, ...changes } : draft,
      ),
    );
  };

  const fillGeneratedDraftDescriptions = (
    uploadedItems: { draftId: string; document: UploadedDocument }[],
    summaries: DocumentSummary[],
  ) => {
    if (summaries.length === 0) return;

    const descriptionByDraftId = new Map<string, string>();
    for (const item of uploadedItems) {
      const summary = summaries.find((candidate) =>
        matchesStorageKey(item.document.chemin_fichier, candidate.document_key),
      );
      if (!summary?.description.trim()) continue;
      descriptionByDraftId.set(item.draftId, summary.description.trim());
    }

    if (descriptionByDraftId.size === 0) return;

    setFileDrafts((current) =>
      current.map((draft) => {
        const generatedDescription = descriptionByDraftId.get(draft.id);
        if (!generatedDescription || draft.description.trim()) {
          return draft;
        }

        return {
          ...draft,
          description: generatedDescription,
          uploadedDocument: draft.uploadedDocument
            ? { ...draft.uploadedDocument, description: generatedDescription }
            : draft.uploadedDocument,
        };
      }),
    );
  };

  const rejectSuggestion = (suggestionId: string) => {
    setSuggestionDecisions((current) => ({
      ...current,
      [suggestionId]: "rejected",
    }));
  };

  if (!open) return null;

  const canSubmit =
    fileDrafts.some((draft) => draft.status !== "uploaded") && !isBusy;

  return (
    <DialogShell
      footer={
        <div className="flex w-full items-center justify-between gap-4">
          <p className="font-['Inter'] text-[12px] text-[#64748b]">
            {fileDrafts.length > 0
              ? `${fileDrafts.length} fichier(s) pret(s)`
              : "Aucun fichier selectionne"}
          </p>
          <div className="flex items-center gap-3">
            <button
              className="h-[40px] cursor-pointer rounded-[10px] border border-[#c2e0ef] bg-white px-4 font-['Plus_Jakarta_Sans'] text-[14px] font-semibold text-[#0f3460] transition-colors hover:bg-[#f8fafc] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isBusy}
              onClick={() => onOpenChange(false)}
              type="button"
            >
              Fermer
            </button>
            <button
              className="inline-flex h-[40px] cursor-pointer items-center justify-center gap-2 rounded-[10px] bg-[#052ca0] px-5 font-['Plus_Jakarta_Sans'] text-[14px] font-semibold text-white shadow-[0px_4px_12px_0px_rgba(5,44,160,0.32)] transition-colors hover:bg-[#0a3ac7] disabled:cursor-not-allowed disabled:bg-[#c2e0ef] disabled:text-[#6b819d] disabled:shadow-none"
              disabled={!canSubmit}
              onClick={() => uploadMutation.mutate()}
              type="button"
            >
              {isBusy ? <Loader2 className="size-4 animate-spin" /> : null}
              {analysisMutation.isPending
                ? "Analyse..."
                : uploadMutation.isPending
                  ? "Import..."
                  : "Valider l'import"}
            </button>
          </div>
        </div>
      }
      icon={<FileCheck2 className="size-5" />}
      maxWidth="max-w-[920px]"
      open={open}
      title="Nouveaux documents"
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !isBusy) {
          onOpenChange(false);
        }
      }}
    >
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex flex-col gap-4">
            <label
              className={cn(
                "flex min-h-[178px] cursor-pointer flex-col items-center justify-center gap-3 rounded-[14px] border-[1.4px] border-dashed px-5 py-6 text-center transition-colors",
                isDraggingFile
                  ? "border-[#052ca0] bg-[#eaf3fb]"
                  : "border-[#76bbdd] bg-[#f8fbff] hover:bg-[#f0f6ff]",
                isBusy ? "cursor-not-allowed opacity-70" : "",
              )}
              onDragLeave={onFileDragLeave}
              onDragOver={onFileDragOver}
              onDrop={onFileDrop}
            >
              <UploadCloud
                className={cn(
                  "size-8",
                  isDraggingFile ? "text-[#052ca0]" : "text-[#265284]",
                )}
              />
              <div>
                <p className="font-['Plus_Jakarta_Sans'] text-[15px] font-semibold text-[#0f3460]">
                  {isDraggingFile
                    ? "Deposez les documents ici"
                    : "Glissez plusieurs documents ici ou cliquez pour importer"}
                </p>
                <p className="mt-1 font-['Inter'] text-[12px] text-[#64748b]">
                  PDF, PNG, JPG ou WebP. 10 Mo maximum par fichier.
                </p>
              </div>
              <input
                accept=".pdf,image/png,image/jpeg,image/webp"
                className="hidden"
                disabled={isBusy}
                multiple
                onChange={onFileChange}
                type="file"
              />
            </label>

            <div className="flex flex-col gap-2">
              {fileDrafts.length === 0 ? (
                <div className="rounded-[12px] border-[0.8px] border-dashed border-[#c2e0ef] bg-[#f8fafc] px-4 py-5 text-center font-['Inter'] text-[13px] text-[#64748b]">
                  Aucun document selectionne.
                </div>
              ) : (
                fileDrafts.map((draft) => (
                  <FileDraftRow
                    draft={draft}
                    key={draft.id}
                    onRemove={() => removeDraft(draft.id)}
                    onUpdate={(changes) => updateDraft(draft.id, changes)}
                    onToggleAnalyse={() => toggleAnalyse(draft.id)}
                    disabled={isBusy}
                  />
                ))
              )}
            </div>

            {verificationError ? (
              <StatusBlock
                icon={<AlertTriangle className="size-4" />}
                tone="warning"
                title="Analyse indisponible"
                text={verificationError}
              />
            ) : null}

            {analysisResult ? (
              <AnalysisReview
                acceptedOrRejected={suggestionDecisions}
                analysisResult={analysisResult}
                documents={analyzedUploadedDocuments}
                isApplying={isApplyingSuggestion}
                proposedActionsBySuggestionId={proposedActionsBySuggestionId}
                onAccept={(suggestion) => {
                  const action = proposedActionsBySuggestionId.get(
                    suggestion.suggestion_id,
                  );
                  if (!action) {
                    toast.info("Cette suggestion n'a pas d'action automatique.");
                    return;
                  }
                  applySuggestionMutation.mutate(action);
                }}
                onReject={(suggestion) => rejectSuggestion(suggestion.suggestion_id)}
                suggestions={suggestions}
              />
            ) : null}
          </div>

          <aside className="flex flex-col gap-3 rounded-[14px] border-[0.8px] border-[#c2e0ef] bg-[#f8fafc] p-4">
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-[#c2e0ef] text-[#265284]">
                <ShieldAlert className="size-5" />
              </div>
              <div>
                <p className="font-['Plus_Jakarta_Sans'] text-[14px] font-semibold text-[#0f3460]">
                  Analyse apres import
                </p>
                <p className="mt-1 font-['Inter'] text-[12px] leading-5 text-[#64748b]">
                  Les documents coches sont analyses apres validation de
                  l'import. L'IA genere une description, detecte les anomalies,
                  puis propose les modifications du dossier patient.
                </p>
              </div>
            </div>

            {analysisMutation.isPending ? (
              <div className="rounded-[12px] border-[0.8px] border-[#c2e0ef] bg-white p-3">
                <div className="flex items-center gap-2 text-[#265284]">
                  <Loader2 className="size-4 animate-spin" />
                  <p className="font-['Inter'] text-[12px] font-semibold">
                    Analyse des documents en cours
                  </p>
                </div>
              </div>
            ) : null}

            {analysisResult ? (
              <StatusBlock
                icon={<CheckCircle2 className="size-4" />}
                tone={
                  analysisResult.identity_flag === "mismatch"
                    ? "warning"
                    : "neutral"
                }
                title={getIdentityLabel(analysisResult.identity_flag)}
                text={analysisResult.identity.details}
              />
            ) : null}
          </aside>
        </div>
    </DialogShell>
  );
}

function FileDraftRow({
  draft,
  disabled,
  onRemove,
  onUpdate,
  onToggleAnalyse,
}: {
  draft: FileDraft;
  disabled: boolean;
  onRemove: () => void;
  onUpdate: (changes: Partial<Pick<FileDraft, "nom_document" | "description">>) => void;
  onToggleAnalyse: () => void;
}) {
  return (
    <div className="rounded-[12px] border-[0.8px] border-[#c2e0ef] bg-white p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-[#eaf3fb] text-[#265284]">
            <FileText className="size-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-['Inter'] text-[13px] font-semibold text-[#0f3460]">
              {draft.file.name}
            </p>
            <p className="mt-0.5 font-['Inter'] text-[11px] text-[#64748b]">
              {formatFileSize(draft.file.size)} · {getDraftStatusLabel(draft)}
            </p>
            {draft.error ? (
              <p className="mt-1 font-['Inter'] text-[11px] text-[#dc2626]">
                {draft.error}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <label className="flex cursor-pointer items-center gap-2 rounded-[10px] border-[0.8px] border-[#c2e0ef] bg-[#f8fafc] px-3 py-2 font-['Inter'] text-[12px] font-medium text-[#0f3460]">
            <input
              checked={draft.analyse}
              className="size-4 accent-[#052ca0]"
              disabled={disabled}
              onChange={onToggleAnalyse}
              type="checkbox"
            />
            Analyse
          </label>
          <button
            aria-label="Retirer"
            className="flex size-8 cursor-pointer items-center justify-center rounded-[8px] text-[#64748b] transition-colors hover:bg-[#f1f5f9] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={disabled}
            onClick={onRemove}
            type="button"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <label className="flex flex-col gap-1">
          <span className="font-['Inter'] text-[11px] font-medium uppercase text-[#64748b]">
            Nom du fichier
          </span>
          <input
            className="h-[38px] rounded-[10px] border-[0.8px] border-[#c2e0ef] bg-[#f8fafc] px-3 font-['Inter'] text-[13px] text-[#0f3460] outline-none focus:border-[#76bbdd]"
            disabled={disabled}
            onChange={(event) => onUpdate({ nom_document: event.target.value })}
            value={draft.nom_document}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-['Inter'] text-[11px] font-medium uppercase text-[#64748b]">
            Description
          </span>
          <input
            className="h-[38px] rounded-[10px] border-[0.8px] border-[#c2e0ef] bg-[#f8fafc] px-3 font-['Inter'] text-[13px] text-[#0f3460] outline-none placeholder:text-[#94a3b8] focus:border-[#76bbdd]"
            disabled={disabled}
            onChange={(event) => onUpdate({ description: event.target.value })}
            placeholder="Description manuelle optionnelle"
            value={draft.description}
          />
        </label>
      </div>
    </div>
  );
}

function AnalysisReview({
  acceptedOrRejected,
  analysisResult,
  documents,
  isApplying,
  proposedActionsBySuggestionId,
  onAccept,
  onReject,
  suggestions,
}: {
  acceptedOrRejected: Record<string, SuggestionDecision>;
  analysisResult: DocumentAnalysisResult;
  documents: UploadedDocument[];
  isApplying: boolean;
  proposedActionsBySuggestionId: Map<string, ProposedAction>;
  onAccept: (suggestion: DocumentSuggestion) => void;
  onReject: (suggestion: DocumentSuggestion) => void;
  suggestions: DocumentSuggestion[];
}) {
  return (
    <div className="flex flex-col gap-3">
      <section className="rounded-[14px] border-[0.8px] border-[#c2e0ef] bg-white p-4">
        <h4 className="font-['Plus_Jakarta_Sans'] text-[15px] font-semibold text-[#0f3460]">
          Descriptions generees
        </h4>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {(analysisResult.document_summaries ?? []).length === 0 ? (
            <p className="rounded-[10px] bg-[#f8fafc] px-3 py-2 font-['Inter'] text-[12px] text-[#64748b]">
              Aucune description n'a ete retournee par l'analyse.
            </p>
          ) : (
            (analysisResult.document_summaries ?? []).map((summary) => (
              <DocumentSummaryCard
                documents={documents}
                key={summary.document_key}
                summary={summary}
              />
            ))
          )}
        </div>
      </section>

      <section className="rounded-[14px] border-[0.8px] border-[#c2e0ef] bg-white p-4">
        <h4 className="font-['Plus_Jakarta_Sans'] text-[15px] font-semibold text-[#0f3460]">
          Suggestions de modification
        </h4>
        {suggestions.length === 0 ? (
          <p className="mt-3 rounded-[10px] bg-[#f8fafc] px-3 py-2 font-['Inter'] text-[12px] text-[#64748b]">
            Aucune modification du dossier patient n'est suggeree.
          </p>
        ) : (
          <div className="mt-3 flex flex-col gap-3">
            {suggestions.map((suggestion) => {
              const decision = acceptedOrRejected[suggestion.suggestion_id];
              const proposedAction = proposedActionsBySuggestionId.get(
                suggestion.suggestion_id,
              );
              return (
                <SuggestionCard
                  decision={decision}
                  disabled={isApplying || Boolean(decision)}
                  key={suggestion.suggestion_id}
                  onAccept={() => onAccept(suggestion)}
                  onReject={() => onReject(suggestion)}
                  proposedAction={proposedAction}
                  suggestion={suggestion}
                />
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function DocumentSummaryCard({
  documents,
  summary,
}: {
  documents: UploadedDocument[];
  summary: DocumentSummary;
}) {
  const document = documents.find((item) =>
    matchesStorageKey(item.chemin_fichier, summary.document_key),
  );

  return (
    <article className="rounded-[12px] border-[0.8px] border-[#c2e0ef] bg-[#f8fafc] p-3">
      <p className="font-['Inter'] text-[13px] font-semibold text-[#0f3460]">
        {summary.title || document?.nom_document || "Document"}
      </p>
      <p className="mt-1 font-['Inter'] text-[12px] leading-5 text-[#4b6787]">
        {summary.description}
      </p>
      {summary.anomalies.length > 0 ? (
        <div className="mt-3 flex flex-col gap-2">
          {summary.anomalies.map((anomaly, index) => (
            <div
              className={cn(
                "rounded-[10px] border px-3 py-2 font-['Inter'] text-[11px]",
                getAnomalyClasses(anomaly.severity),
              )}
              key={`${anomaly.label}-${index}`}
            >
              <span className="font-semibold">{anomaly.label}</span>
              {anomaly.details ? <span> · {anomaly.details}</span> : null}
            </div>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function SuggestionCard({
  decision,
  disabled,
  onAccept,
  onReject,
  proposedAction,
  suggestion,
}: {
  decision?: SuggestionDecision;
  disabled: boolean;
  onAccept: () => void;
  onReject: () => void;
  proposedAction?: ProposedAction;
  suggestion: DocumentSuggestion;
}) {
  return (
    <article className="rounded-[12px] border-[0.8px] border-[#c2e0ef] bg-[#f8fafc] p-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[#eaf3fb] px-2 py-1 font-['Inter'] text-[11px] font-semibold text-[#265284]">
              {getCategoryLabel(suggestion.category)}
            </span>
            <span className="font-['Inter'] text-[11px] text-[#64748b]">
              {Math.round(suggestion.confidence * 100)}% confiance
            </span>
          </div>
          <p className="mt-2 font-['Inter'] text-[13px] font-semibold text-[#0f3460]">
            {formatSuggestionValue(suggestion.field)}: {formatSuggestionValue(suggestion.suggested_value)}
          </p>
          {suggestion.current_value ? (
            <p className="mt-1 font-['Inter'] text-[12px] text-[#64748b]">
              Actuel: {formatSuggestionValue(suggestion.current_value)}
            </p>
          ) : null}
          <p className="mt-2 font-['Inter'] text-[12px] leading-5 text-[#4b6787]">
            {suggestion.reason}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {decision ? (
            <span
              className={cn(
                "inline-flex h-[34px] items-center rounded-[10px] px-3 font-['Inter'] text-[12px] font-semibold",
                decision === "accepted"
                  ? "bg-[#dcfce7] text-[#166534]"
                  : "bg-[#fee2e2] text-[#991b1b]",
              )}
            >
              {decision === "accepted" ? "Acceptee" : "Rejetee"}
            </span>
          ) : (
            <>
              {proposedAction ? (
                <button
                  className="inline-flex h-[34px] cursor-pointer items-center gap-2 rounded-[10px] bg-[#15803d] px-3 font-['Inter'] text-[12px] font-semibold text-white transition-colors hover:bg-[#166534] disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={disabled}
                  onClick={onAccept}
                  title={proposedAction.description}
                  type="button"
                >
                  <Check className="size-4" />
                  Accepter
                </button>
              ) : (
                <span className="inline-flex h-[34px] items-center rounded-[10px] bg-white px-3 font-['Inter'] text-[12px] font-semibold text-[#64748b]">
                  Action manuelle
                </span>
              )}
              <button
                className="inline-flex h-[34px] cursor-pointer items-center gap-2 rounded-[10px] border border-[#fecaca] bg-white px-3 font-['Inter'] text-[12px] font-semibold text-[#b91c1c] transition-colors hover:bg-[#fef2f2] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={disabled}
                onClick={onReject}
                type="button"
              >
                <XCircle className="size-4" />
                Rejeter
              </button>
            </>
          )}
        </div>
      </div>
    </article>
  );
}

function StatusBlock({
  icon,
  title,
  text,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  tone: "neutral" | "warning";
}) {
  return (
    <div
      className={cn(
        "rounded-[12px] border-[0.8px] bg-white p-3",
        tone === "warning" ? "border-[#fed7aa]" : "border-[#c2e0ef]",
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2 font-['Inter'] text-[12px] font-semibold",
          tone === "warning" ? "text-[#c2410c]" : "text-[#265284]",
        )}
      >
        {icon}
        <span>{title}</span>
      </div>
      <p className="mt-1 font-['Inter'] text-[12px] leading-5 text-[#64748b]">
        {text}
      </p>
    </div>
  );
}

async function uploadDocument(patientId: string, draft: FileDraft) {
  const formData = new FormData();
  formData.append("file", draft.file);
  formData.append(
    "json",
    JSON.stringify({
      patient_id: patientId,
      nom_document: draft.nom_document.trim() || getDocumentNameFromFile(draft.file),
      type_document: inferDocumentType(draft.file),
      description: draft.description.trim() || null,
    }),
  );

  const response = await fetch(`${getServerBaseUrl()}/api/upload/document`, {
    method: "POST",
    body: formData,
    credentials: "include",
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error ?? "Le document n'a pas pu etre importe.");
  }

  return payload as UploadedDocument;
}

async function syncGeneratedDescriptions(
  documents: UploadedDocument[],
  summaries: DocumentSummary[],
) {
  await Promise.all(
    summaries.map(async (summary) => {
      const document = documents.find((item) =>
        matchesStorageKey(item.chemin_fichier, summary.document_key),
      );
      if (!document || !summary.description.trim()) return;
      if (document.description?.trim()) return;

      await trpcClient.documents.mettreAJourDocument.mutate({
        id: document.id,
        data: {
          description: summary.description,
        },
      });
    }),
  );
}

async function applyProposedAction(action: ProposedAction) {
  switch (action.mutation) {
    case "patient.updatePatient":
      await trpcClient.patient.updatePatient.mutate(
        action.input as {
          id: string;
          data: Parameters<typeof trpcClient.patient.updatePatient.mutate>[0]["data"];
        },
      );
      return;
    case "medicalHistory.ajouterAntecedent":
      await trpcClient.medicalHistory.ajouterAntecedent.mutate(action.input as any);
      return;
    case "treatment.startTreatment":
      await trpcClient.treatment.startTreatment.mutate(action.input as any);
      return;
    case "vaccination.recordVaccination":
      await trpcClient.vaccination.recordVaccination.mutate(action.input as any);
      return;
    default:
      throw new Error("Cette suggestion ne peut pas etre appliquee automatiquement.");
  }
}

function isSupportedProposedAction(action: ProposedAction) {
  const input = action.input;

  switch (action.mutation) {
    case "patient.updatePatient":
      return typeof input.id === "string" && typeof input.data === "object" && input.data !== null;
    case "medicalHistory.ajouterAntecedent":
      return typeof input.patient_id === "string" && typeof input.description === "string";
    case "treatment.startTreatment":
      return (
        typeof input.patient_id === "string" &&
        isPositiveIntegerString(input.medicament_externe_id) &&
        typeof input.posologie === "string" &&
        input.posologie.trim().length > 0
      );
    case "vaccination.recordVaccination":
      return typeof input.patient_id === "string" && typeof input.vaccin === "string";
    default:
      return false;
  }
}

function isPositiveIntegerString(value: unknown) {
  if (typeof value !== "string") return false;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0;
}

async function invalidatePatientData(patientId: string) {
  await Promise.all([
    queryClient.invalidateQueries(
      trpc.patient.getPatientFullRecord.queryFilter({ id: patientId }),
    ),
    queryClient.invalidateQueries(
      trpc.documents.getDocumentsByPatient.queryFilter({ patientId }),
    ),
    queryClient.invalidateQueries(
      trpc.medicalHistory.getAntecedentsPatient.queryFilter({
        patient_id: patientId,
      }),
    ),
    queryClient.invalidateQueries(
      trpc.treatment.getPatientTreatments.queryFilter({ patient_id: patientId }),
    ),
    queryClient.invalidateQueries(
      trpc.treatment.getActivePatientTreatments.queryFilter({
        patient_id: patientId,
      }),
    ),
    queryClient.invalidateQueries(
      trpc.vaccination.getPatientVaccinations.queryFilter({
        patient_id: patientId,
      }),
    ),
  ]);
}

function validateDocumentFile(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const isAcceptedType =
    ACCEPTED_DOCUMENT_MIME_TYPES.has(file.type) ||
    ACCEPTED_DOCUMENT_EXTENSIONS.has(extension);

  if (!isAcceptedType) {
    return "format non supporte";
  }

  if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
    return "taille superieure a 10 Mo";
  }

  return null;
}

function getDocumentNameFromFile(file: File) {
  return file.name.replace(/\.[^.]+$/, "") || file.name;
}

function inferDocumentType(file: File) {
  if (file.type === "application/pdf") return "PDF medical";
  if (file.type.startsWith("image/")) return "Image medicale";
  return "Document medical";
}

function matchesStorageKey(urlOrKey: string, key: string) {
  return urlOrKey === key || urlOrKey.includes(key);
}

function getDraftStatusLabel(draft: FileDraft) {
  switch (draft.status) {
    case "uploading":
      return "Import en cours";
    case "uploaded":
      return "Importe";
    case "error":
      return "Erreur";
    case "ready":
    default:
      return "Pret";
  }
}

function getIdentityLabel(flag: DocumentAnalysisResult["identity_flag"]) {
  switch (flag) {
    case "match":
      return "Identite confirmee";
    case "mismatch":
      return "Identite a verifier";
    case "uncertain":
    default:
      return "Identite incertaine";
  }
}

function getCategoryLabel(category: DocumentSuggestion["category"]) {
  switch (category) {
    case "demographic":
      return "Donnees patient";
    case "lab_value":
      return "Valeur biologique";
    case "antecedent":
      return "Antecedent";
    case "treatment":
      return "Traitement";
    case "vaccination":
      return "Vaccination";
    case "other":
    default:
      return "Autre";
  }
}

function formatSuggestionValue(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    return value.map(formatSuggestionValue).filter(Boolean).join(", ");
  }
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, nestedValue]) => {
        const formatted = formatSuggestionValue(nestedValue);
        return formatted ? `${key}: ${formatted}` : "";
      })
      .filter(Boolean)
      .join(", ");
  }
  return String(value);
}

function getAnomalyClasses(severity: DocumentSummary["anomalies"][number]["severity"]) {
  switch (severity) {
    case "critical":
      return "border-[#fecaca] bg-[#fef2f2] text-[#b91c1c]";
    case "warning":
      return "border-[#fed7aa] bg-[#fff7ed] text-[#c2410c]";
    case "info":
    default:
      return "border-[#c2e0ef] bg-white text-[#265284]";
  }
}

function formatFileSize(size: number) {
  if (size < 1024) return `${size} o`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} Ko`;
  return `${(size / (1024 * 1024)).toFixed(1)} Mo`;
}
