import { useCallback, useRef, useState } from "react";

import { AlertTriangle, CheckCircle2, FileText, Loader2, Upload, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";

import { trpcClient } from "@/utils/trpc";
import { getServerBaseUrl } from "@/lib/server-url";

type IdentityFlag = "match" | "mismatch" | "uncertain";

interface AnalysisResult {
  validated: boolean;
  identity_flag: IdentityFlag;
  identity: {
    verifiable: boolean;
    patient_match: boolean;
    details: string;
    risk_level: "low" | "medium" | "high";
  };
  suggestions?: Array<{
    suggestion_id: string;
    field: string;
    suggested_value: string;
    reason: string;
    confidence: number;
    severity?: "normal" | "abnormal" | "critical";
  }>;
  document_summaries?: Array<{
    document_key: string;
    title: string;
    description: string;
    anomalies: Array<{ label: string; severity: "warning" | "info" | "critical"; details: string }>;
  }>;
  extraction_stats: {
    documents_processed: number;
    processing_time_ms: number;
  };
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  patientId: string | null;
}

type Step = "upload" | "analyzing" | "result";

const ACCEPTED_MIME = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const MAX_SIZE_MB = 10;

export function QuickDocumentVerifyPopup({ isOpen, onClose, patientId }: Props) {
  const [step, setStep] = useState<Step>("upload");
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setStep("upload");
    setSelectedFile(null);
    setResult(null);
    setDragOver(false);
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [onClose, reset]);

  const validateFile = (file: File): string | null => {
    if (!ACCEPTED_MIME.includes(file.type)) {
      return "Format non supporté. Utilisez PDF, JPG, PNG ou WebP.";
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      return `Fichier trop volumineux (max ${MAX_SIZE_MB} Mo).`;
    }
    return null;
  };

  const runAnalysis = useCallback(
    async (file: File) => {
      if (!patientId) {
        toast.error("Ouvrez un dossier patient pour utiliser cette fonctionnalité.");
        return;
      }

      const error = validateFile(file);
      if (error) {
        toast.error(error);
        return;
      }

      setSelectedFile(file);
      setStep("analyzing");

      try {
        // 1. Upload to temp storage
        const formData = new FormData();
        formData.append("file", file);

        const uploadRes = await fetch(
          `${getServerBaseUrl()}/api/upload/document-quick-verify`,
          { method: "POST", body: formData, credentials: "include" },
        );
        const uploadPayload = await uploadRes.json().catch(() => null);
        if (!uploadRes.ok) {
          throw new Error(uploadPayload?.error ?? "Erreur lors de l'import du fichier.");
        }

        const documentKey: string = uploadPayload.document_key;

        // 2. Run AI analysis
        const analysisResult = await trpcClient.ai.documentAnomaly.analyzeDocuments.mutate({
          patient_id: patientId,
          document_keys: [documentKey],
        });

        setResult(analysisResult as AnalysisResult);
        setStep("result");
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Analyse impossible. Réessayez.";
        toast.error(message);
        setStep("upload");
        setSelectedFile(null);
      }
    },
    [patientId],
  );

  const onFileSelect = (file: File) => {
    void runAnalysis(file);
  };

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) onFileSelect(file);
    },
    [onFileSelect],
  );

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileSelect(file);
    e.target.value = "";
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-[2px]"
            onClick={handleClose}
          />

          {/* Panel */}
          <motion.div
            key="panel"
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            transition={{ type: "spring", stiffness: 420, damping: 30, mass: 0.8 }}
            className="fixed inset-x-4 top-[10vh] z-[201] mx-auto max-w-[520px] rounded-[20px] bg-white shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#e8f1f8] px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex size-8 items-center justify-center rounded-[10px] bg-[#eaf3fa]">
                  <FileText className="size-4 text-[#0f3460]" />
                </div>
                <div>
                  <p className="font-['Inter'] text-[14px] font-semibold text-[#0f3460]">
                    Vérification rapide de document
                  </p>
                  {patientId ? (
                    <p className="font-['Inter'] text-[11px] text-[#64748b]">
                      Analyse par IA selon le dossier patient ouvert
                    </p>
                  ) : (
                    <p className="font-['Inter'] text-[11px] text-[#dc2626]">
                      Aucun dossier patient ouvert
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={handleClose}
                className="flex size-7 items-center justify-center rounded-full text-[#94a3b8] transition hover:bg-[#f1f5f9] hover:text-[#0f3460]"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5">
              {step === "upload" && (
                <UploadZone
                  dragOver={dragOver}
                  disabled={!patientId}
                  inputRef={inputRef}
                  onDrop={onDrop}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onInputChange={onInputChange}
                  onClick={() => patientId && inputRef.current?.click()}
                />
              )}

              {step === "analyzing" && (
                <AnalyzingState fileName={selectedFile?.name ?? ""} />
              )}

              {step === "result" && result && (
                <ResultView
                  result={result}
                  fileName={selectedFile?.name ?? ""}
                  onReset={reset}
                />
              )}
            </div>

            {/* Disclaimer */}
            <div className="border-t border-[#e8f1f8] px-6 py-3">
              <p className="font-['Inter'] text-[10.5px] leading-4 text-[#94a3b8]">
                Vérification par IA à titre indicatif uniquement. Le médecin reste responsable de la validation clinique finale.
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function UploadZone({
  dragOver,
  disabled,
  inputRef,
  onDrop,
  onDragOver,
  onDragLeave,
  onInputChange,
  onClick,
}: {
  dragOver: boolean;
  disabled: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onDrop: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClick: () => void;
}) {
  return (
    <div
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onClick={onClick}
      className={[
        "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-[14px] border-2 border-dashed px-6 py-10 transition-all select-none",
        disabled
          ? "cursor-not-allowed border-[#e2e8f0] bg-[#f8fafc] opacity-50"
          : dragOver
            ? "border-[#3b82f6] bg-[#eff6ff]"
            : "border-[#c2ddef] bg-[#f8fbff] hover:border-[#6baed6] hover:bg-[#f0f7ff]",
      ].join(" ")}
    >
      <div className="flex size-12 items-center justify-center rounded-full bg-[#eaf3fa]">
        <Upload className="size-6 text-[#3b82f6]" />
      </div>
      <div className="text-center">
        <p className="font-['Inter'] text-[13px] font-semibold text-[#0f3460]">
          Glissez un document ou cliquez pour importer
        </p>
        <p className="mt-1 font-['Inter'] text-[11.5px] text-[#64748b]">
          PDF, JPG, PNG, WebP · max 10 Mo
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.webp"
        className="hidden"
        onChange={onInputChange}
      />
    </div>
  );
}

function AnalyzingState({ fileName }: { fileName: string }) {
  return (
    <div className="flex flex-col items-center gap-4 py-8">
      <div className="relative flex size-14 items-center justify-center">
        <div className="absolute inset-0 animate-ping rounded-full bg-[#3b82f6]/20" />
        <div className="flex size-14 items-center justify-center rounded-full bg-[#eaf3fa]">
          <Loader2 className="size-6 animate-spin text-[#3b82f6]" />
        </div>
      </div>
      <div className="text-center">
        <p className="font-['Inter'] text-[14px] font-semibold text-[#0f3460]">
          Analyse en cours…
        </p>
        {fileName && (
          <p className="mt-1 max-w-[280px] truncate font-['Inter'] text-[11.5px] text-[#64748b]">
            {fileName}
          </p>
        )}
        <p className="mt-2 font-['Inter'] text-[11.5px] text-[#94a3b8]">
          Vérification de l'identité, extraction des données et détection d'anomalies…
        </p>
      </div>
    </div>
  );
}

function ResultView({
  result,
  fileName,
  onReset,
}: {
  result: AnalysisResult;
  fileName: string;
  onReset: () => void;
}) {
  const isMismatch = result.identity_flag === "mismatch";
  const isUncertain = result.identity_flag === "uncertain";
  const summaries = result.document_summaries ?? [];
  const suggestions = result.suggestions ?? [];
  const allAnomalies = summaries.flatMap((s) => s.anomalies ?? []).slice(0, 6);


  const identityColor = isMismatch
    ? { bg: "bg-[#fff7ed]", border: "border-[#fed7aa]", text: "text-[#c2410c]", icon: <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[#c2410c]" /> }
    : isUncertain
      ? { bg: "bg-[#fefce8]", border: "border-[#fef08a]", text: "text-[#854d0e]", icon: <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[#ca8a04]" /> }
      : { bg: "bg-[#f0fdf4]", border: "border-[#bbf7d0]", text: "text-[#166534]", icon: <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#15803d]" /> };

  const identityLabel =
    isMismatch ? "Identité à vérifier" : isUncertain ? "Identité incertaine" : "Identité confirmée";

  return (
    <div className="flex flex-col gap-3 max-h-[55vh] overflow-y-auto pr-1">
      {/* File name */}
      {fileName && (
        <div className="flex items-center gap-2 rounded-[10px] bg-[#f1f5f9] px-3 py-2">
          <FileText className="size-4 shrink-0 text-[#64748b]" />
          <p className="truncate font-['Inter'] text-[11.5px] text-[#475569]">{fileName}</p>
        </div>
      )}

      {/* Identity card */}
      <div className={`rounded-[12px] border px-4 py-3 ${identityColor.bg} ${identityColor.border}`}>
        <div className="flex items-start gap-2">
          {identityColor.icon}
          <div>
            <p className={`font-['Inter'] text-[13px] font-semibold ${identityColor.text}`}>
              {identityLabel}
            </p>
            {result.identity.details && (
              <p className="mt-1 font-['Inter'] text-[11.5px] leading-5 text-[#4b6787]">
                {result.identity.details}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Document summaries */}
      {summaries.length > 0 && (
        <div className="flex flex-col gap-2">
          {summaries.map((s) => (
            <div key={s.document_key} className="rounded-[12px] border border-[#c2e0ef] bg-[#f8fbff] px-4 py-3">
              <p className="font-['Inter'] text-[12px] font-semibold text-[#0f3460]">{s.title || "Document"}</p>
              {s.description && (
                <p className="mt-1 font-['Inter'] text-[11.5px] leading-5 text-[#475569]">{s.description}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Anomalies */}
      {allAnomalies.length > 0 && (
        <div className="rounded-[12px] border border-[#fed7aa] bg-[#fff7ed] px-4 py-3">
          <p className="font-['Inter'] text-[12px] font-semibold text-[#9a3412]">
            Anomalies détectées ({allAnomalies.length})
          </p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {allAnomalies.map((anomaly, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <span
                  className={[
                    "mt-1.5 size-1.5 shrink-0 rounded-full",
                    anomaly.severity === "critical"
                      ? "bg-[#dc2626]"
                      : anomaly.severity === "warning"
                        ? "bg-[#f97316]"
                        : "bg-[#64748b]",
                  ].join(" ")}
                />
                <div>
                  <p className="font-['Inter'] text-[11.5px] leading-5 text-[#7c3614]">
                    {anomaly.label}
                  </p>
                  {anomaly.details && (
                    <p className="font-['Inter'] text-[11px] leading-4 text-[#9a3412]/70">
                      {anomaly.details}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="font-['Inter'] text-[11.5px] font-semibold uppercase tracking-wide text-[#64748b]">
            Données extraites ({suggestions.length})
          </p>
          {suggestions.slice(0, 4).map((s) => (
            <div key={s.suggestion_id} className="rounded-[10px] border border-[#c2e0ef] bg-white px-3 py-2">
              <p className="font-['Inter'] text-[12px] font-semibold text-[#0f3460]">
                {s.field} : {s.suggested_value}
              </p>
              {s.reason && (
                <p className="mt-0.5 font-['Inter'] text-[11px] leading-4 text-[#64748b]">{s.reason}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* No anomalies case */}
      {allAnomalies.length === 0 && suggestions.length === 0 && (
        <div className="flex items-center gap-2 rounded-[12px] border border-[#bbf7d0] bg-[#f0fdf4] px-4 py-3">
          <CheckCircle2 className="size-4 shrink-0 text-[#15803d]" />
          <p className="font-['Inter'] text-[12px] text-[#166534]">
            Aucune anomalie détectée dans ce document.
          </p>
        </div>
      )}

      {/* Stats + re-analyze */}
      <div className="flex items-center justify-between pt-1">
        <p className="font-['Inter'] text-[10.5px] text-[#94a3b8]">
          Traité en {(result.extraction_stats.processing_time_ms / 1000).toFixed(1)}s
        </p>
        <button
          onClick={onReset}
          className="font-['Inter'] text-[11.5px] font-medium text-[#3b82f6] transition hover:underline"
        >
          Vérifier un autre document
        </button>
      </div>
    </div>
  );
}
