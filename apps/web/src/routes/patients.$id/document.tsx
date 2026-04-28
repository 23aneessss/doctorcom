import { env } from "@doctor.com/env/web";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Download,
  Eye,
  FileArchive,
  FileText,
  FolderOpen,
  Loader2,
  Mail,
  Plus,
  Printer,
  Search,
  ShieldAlert,
  Stethoscope,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { openBase64Pdf } from "@/lib/pdf-client";
import { queryClient, trpc, trpcClient } from "@/utils/trpc";

type DocumentTab = "ordonnances" | "lettres" | "certificats" | "documents";

type OrdonnanceRow = {
  id: string;
  patient_id: string;
  rendez_vous_id: string;
  pre_rempli_origine_id: string | null;
  remarques: string | null;
  date_prescription: string;
  medicaments: Array<{
    id: string;
    ordonnance_id: string;
    medicament_externe_id: string;
    nom_medicament: string;
    dci: string | null;
    dosage: string | null;
    posologie: string;
    duree_traitement: string | null;
    instructions: string | null;
  }>;
};

type DocumentRow = {
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

type DocumentAnalysisResult = {
  validated: boolean;
  confidence: number;
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
  suggestions?: Array<{
    suggestion_id: string;
    table: string;
    field: string;
    category: string;
    current_value: string | null;
    suggested_value: string;
    reason: string;
    confidence: number;
    severity?: "normal" | "abnormal" | "critical";
  }>;
  extraction_stats: {
    documents_total: number;
    documents_processed: number;
    low_confidence_fields: number;
    processing_time_ms: number;
    cache_hit: boolean;
  };
};

type LettreRow = {
  id: string;
  documents_patient_id: string;
  utilisateur_id: string;
  suivi_id: string;
  type_exploration: string | null;
  examen_demande: string | null;
  raison: string | null;
  destinataire: string | null;
  urgence: "normale" | "urgente" | "tres_urgente";
  contenu_lettre: string | null;
  date_creation: string;
  date_modification: string;
};

type CertificatRow = {
  id: string;
  documents_patient_id: string;
  utilisateur_id: string;
  suivi_id: string;
  type_certificat: "arret_travail" | "aptitude" | "scolaire" | "grossesse" | "deces";
  date_emission: string;
  date_debut: string | null;
  date_fin: string | null;
  diagnostic: string | null;
  destinataire: string | null;
  notes: string | null;
  statut: "brouillon" | "emis" | "annule";
  date_creation: string;
  date_modification: string;
};

type PopupEventDetail = {
  type: "ordonnance" | "document";
};

type RendezVousLite = {
  id: string;
  suivi_id: string | null;
};

type SuiviLite = {
  id: string;
  motif: string;
};

export const Route = createFileRoute("/patients/$id/document")({
  component: RouteComponent,
  pendingComponent: DocumentSkeleton,
  errorComponent: DocumentError,
  pendingMs: 0,
});

function RouteComponent() {
  const { id } = Route.useParams();
  const [activeTab, setActiveTab] = useState<DocumentTab>("ordonnances");
  const [expandedOrdonnanceId, setExpandedOrdonnanceId] = useState<string | null>(null);
  const [documentSearch, setDocumentSearch] = useState("");
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
  const [documentAnalysisResult, setDocumentAnalysisResult] =
    useState<DocumentAnalysisResult | null>(null);

  const ordonnancesQuery = useQuery({
    ...trpc.ordonnance.getOrdonnancesByPatient.queryOptions({ patientId: id }),
    throwOnError: false,
  });
  const documentsQuery = useQuery({
    ...trpc.documents.getDocumentsByPatient.queryOptions({ patientId: id }),
    throwOnError: false,
  });
  const lettresQuery = useQuery({
    ...trpc.documents.getLettresByPatient.queryOptions({ patientId: id }),
    throwOnError: false,
  });
  const certificatsQuery = useQuery({
    ...trpc.documents.getCertificatsByPatient.queryOptions({ patientId: id }),
    throwOnError: false,
  });
  const patientFullRecordQuery = useQuery({
    ...trpc.patient.getPatientFullRecord.queryOptions({ id }),
    throwOnError: false,
  });

  const routeQueries = [
    ordonnancesQuery,
    documentsQuery,
    lettresQuery,
    certificatsQuery,
    patientFullRecordQuery,
  ];

  const failedQueries = routeQueries.filter((query) => query.isError);
  const isInitialLoading =
    routeQueries.some((query) => query.isLoading) &&
    routeQueries.every((query) => query.data === undefined);

  const ordonnances = (ordonnancesQuery.data ?? []) as OrdonnanceRow[];
  const documents = (documentsQuery.data ?? []) as DocumentRow[];
  const lettres = (lettresQuery.data ?? []) as LettreRow[];
  const certificats = (certificatsQuery.data ?? []) as CertificatRow[];
  const patientFullRecord = patientFullRecordQuery.data;

  const documentsById = useMemo(() => {
    return new Map(documents.map((item) => [item.id, item]));
  }, [documents]);

  const sortedOrdonnances = useMemo(() => {
    return [...ordonnances].sort((left, right) =>
      right.date_prescription.localeCompare(left.date_prescription),
    );
  }, [ordonnances]);

  const sortedDocuments = useMemo(() => {
    return [...documents]
      .filter((item) => !item.est_archive)
      .sort((left, right) => right.date_upload.localeCompare(left.date_upload));
  }, [documents]);

  const visibleDocuments = useMemo(() => {
    const normalizedSearch = documentSearch.trim().toLowerCase();
    return sortedDocuments.filter((document) => {
      if (!normalizedSearch) return true;

      return [
        document.nom_document,
        document.description ?? "",
        document.type_fichier,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch);
    });
  }, [documentSearch, sortedDocuments]);

  const selectedDocuments = useMemo(() => {
    const selectedSet = new Set(selectedDocumentIds);
    return sortedDocuments.filter((document) => selectedSet.has(document.id));
  }, [selectedDocumentIds, sortedDocuments]);

  const documentsForVerification =
    selectedDocuments.length > 0 ? selectedDocuments : visibleDocuments;

  const sortedLettres = useMemo(() => {
    return [...lettres].sort((left, right) => right.date_creation.localeCompare(left.date_creation));
  }, [lettres]);

  const sortedCertificats = useMemo(() => {
    return [...certificats].sort((left, right) => right.date_creation.localeCompare(left.date_creation));
  }, [certificats]);

  const rendezVousById = useMemo(() => {
    const rendezVous = (patientFullRecord?.rendez_vous ?? []) as RendezVousLite[];
    return new Map(rendezVous.map((item) => [item.id, item]));
  }, [patientFullRecord?.rendez_vous]);

  const suivisById = useMemo(() => {
    const suivis = (patientFullRecord?.suivi ?? []) as SuiviLite[];
    return new Map(suivis.map((item) => [item.id, item]));
  }, [patientFullRecord?.suivi]);

  const exportMutation = useMutation({
    mutationFn: async (ordonnanceId: string) => {
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

  const deleteMutation = useMutation({
    mutationFn: async (ordonnanceId: string) => {
      return trpcClient.ordonnance.supprimerOrdonnance.mutate({ id: ordonnanceId });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries(
          trpc.ordonnance.getOrdonnancesByPatient.queryFilter({ patientId: id }),
        ),
        queryClient.invalidateQueries(trpc.patient.getPatientFullRecord.queryFilter({ id })),
        queryClient.invalidateQueries(
          trpc.treatment.getActivePatientTreatments.queryFilter({ patient_id: id }),
        ),
        queryClient.invalidateQueries(
          trpc.treatment.getPatientTreatments.queryFilter({ patient_id: id }),
        ),
      ]);
      toast.success("Ordonnance supprimée");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteDocumentMutation = useMutation({
    mutationFn: async (documentIds: string[]) => {
      await Promise.all(
        documentIds.map((documentId) =>
          trpcClient.documents.supprimerDocument.mutate({ id: documentId }),
        ),
      );
      return documentIds;
    },
    onSuccess: async (documentIds) => {
      const deletedIds = new Set(documentIds);
      setSelectedDocumentIds((current) => current.filter((id) => !deletedIds.has(id)));
      await Promise.all([
        queryClient.invalidateQueries(
          trpc.documents.getDocumentsByPatient.queryFilter({ patientId: id }),
        ),
        queryClient.invalidateQueries(trpc.patient.getPatientFullRecord.queryFilter({ id })),
      ]);
      toast.success(
        documentIds.length > 1
          ? "Documents selectionnes supprimes"
          : "Document supprime",
      );
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const documentAnalysisMutation = useMutation({
    mutationFn: async (documentKeys: string[]) => {
      return (await trpcClient.ai.documentAnomaly.analyzeDocuments.mutate({
        patient_id: id,
        document_keys: documentKeys,
      })) as DocumentAnalysisResult;
    },
    onSuccess: (result) => {
      setDocumentAnalysisResult(result);
      if (result.identity_flag === "mismatch") {
        toast.warning("Au moins un document ne semble pas correspondre au patient.");
        return;
      }
      toast.success("Verification des documents terminee");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const openOrdonnancePopup = () => {
    const detail: PopupEventDetail = { type: "ordonnance" };
    window.dispatchEvent(new CustomEvent("patient-popup-open", { detail }));
  };

  const openDocumentPopup = () => {
    window.dispatchEvent(
      new CustomEvent("patient-popup-open", { detail: { type: "document" } }),
    );
  };

  const toggleDocumentSelection = (documentId: string) => {
    setSelectedDocumentIds((current) =>
      current.includes(documentId)
        ? current.filter((id) => id !== documentId)
        : [...current, documentId],
    );
  };

  const toggleVisibleDocuments = () => {
    const visibleIds = visibleDocuments.map((document) => document.id);
    const allVisibleSelected =
      visibleIds.length > 0 &&
      visibleIds.every((documentId) => selectedDocumentIds.includes(documentId));

    setSelectedDocumentIds((current) => {
      if (allVisibleSelected) {
        return current.filter((documentId) => !visibleIds.includes(documentId));
      }

      return Array.from(new Set([...current, ...visibleIds]));
    });
  };

  const deleteSelectedDocuments = () => {
    if (selectedDocumentIds.length === 0) {
      toast.info("Aucun document selectionne.");
      return;
    }

    const confirmed = window.confirm(
      `Supprimer ${selectedDocumentIds.length} document(s) selectionne(s) ? Cette action est irreversible.`,
    );
    if (!confirmed) return;

    deleteDocumentMutation.mutate(selectedDocumentIds);
  };

  const runDocumentVerification = () => {
    if (documentsForVerification.length === 0) {
      toast.info("Aucun document a verifier.");
      return;
    }

    documentAnalysisMutation.mutate(
      documentsForVerification
        .slice(0, 10)
        .map((document) => document.chemin_fichier),
    );
  };

  const formatDate = (value: string | null | undefined) => {
    if (!value) return "—";
    const date = new Date(value);
    return date.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const getSuiviMotif = (ordonnance: OrdonnanceRow) => {
    const rendezVous = rendezVousById.get(ordonnance.rendez_vous_id);
    if (!rendezVous?.suivi_id) {
      return "—";
    }

    return suivisById.get(rendezVous.suivi_id)?.motif ?? "—";
  };

  const retryFailedQueries = async () => {
    await Promise.all(failedQueries.map((query) => query.refetch()));
  };

  if (isInitialLoading) {
    return <DocumentSkeleton />;
  }

  return (
    <div className="flex flex-col gap-6 pb-4">
      {failedQueries.length > 0 ? (
        <div className="flex items-center justify-between rounded-[10px] border border-[#f97316] bg-[#fff7ed] px-3 py-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-[#f97316]" />
            <p className="font-['Inter'] text-[12px] text-[#b45309]">
              Certaines données n&apos;ont pas pu être chargées.
            </p>
          </div>
          <button
            className="cursor-pointer rounded-[8px] border border-[#f97316] px-3 py-1 font-['Inter'] text-[12px] text-[#f97316] transition-colors hover:bg-[#ffedd5]"
            onClick={() => void retryFailedQueries()}
            type="button"
          >
            Réessayer
          </button>
        </div>
      ) : null}

      <div className="border-b-[0.8px] border-[#c2e0ef] pb-[0.8px]">
        <div className="flex flex-wrap items-center gap-2">
          <DocumentTabButton
            active={activeTab === "ordonnances"}
            count={sortedOrdonnances.length}
            icon={<FileText className="size-4" />}
            label="Ordonnances"
            onClick={() => setActiveTab("ordonnances")}
          />
          <DocumentTabButton
            active={activeTab === "lettres"}
            count={sortedLettres.length}
            icon={<Mail className="size-4" />}
            label="Lettres d'orientation"
            onClick={() => setActiveTab("lettres")}
          />
          <DocumentTabButton
            active={activeTab === "certificats"}
            count={sortedCertificats.length}
            icon={<FileArchive className="size-4" />}
            label="Certificats médicaux"
            onClick={() => setActiveTab("certificats")}
          />
          <DocumentTabButton
            active={activeTab === "documents"}
            count={sortedDocuments.length}
            icon={<FolderOpen className="size-4" />}
            label="Documents patient"
            onClick={() => setActiveTab("documents")}
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-['Plus_Jakarta_Sans'] text-[18px] font-medium text-[#0f3460]">
          <FileText className="size-4" />
          {activeTab === "ordonnances" ? "Ordonnances" : null}
          {activeTab === "lettres" ? "Lettres d'orientation" : null}
          {activeTab === "certificats" ? "Certificats médicaux" : null}
          {activeTab === "documents" ? "Documents patient" : null}
          <span className="text-[#64748b]">
            (
            {activeTab === "ordonnances" ? sortedOrdonnances.length : null}
            {activeTab === "lettres" ? sortedLettres.length : null}
            {activeTab === "certificats" ? sortedCertificats.length : null}
            {activeTab === "documents" ? sortedDocuments.length : null})
          </span>
        </h2>

        {activeTab === "ordonnances" ? (
          <button
            className="inline-flex h-[42px] w-[288px] cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-[14px] bg-[#052ca0] px-[24px] py-3 font-['Plus_Jakarta_Sans'] text-[16px] font-semibold text-white shadow-[0px_4px_12px_0px_rgba(5,44,160,0.4)] transition-colors hover:bg-[#0a3ac7]"
            onClick={openOrdonnancePopup}
            type="button"
          >
            <Plus className="size-4" />
            Nouvelle ordonnance
          </button>
        ) : null}
        {activeTab === "documents" ? (
          <button
            className="inline-flex h-[42px] w-[220px] cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-[14px] bg-[#052ca0] px-[20px] py-3 font-['Plus_Jakarta_Sans'] text-[16px] font-semibold text-white shadow-[0px_4px_12px_0px_rgba(5,44,160,0.4)] transition-colors hover:bg-[#0a3ac7]"
            onClick={openDocumentPopup}
            type="button"
          >
            <Plus className="size-4" />
            Nouveau document
          </button>
        ) : null}
      </div>

      {activeTab === "ordonnances" ? (
        <div className="flex flex-col gap-3">
          {sortedOrdonnances.length === 0 ? (
            <EmptyState text="Aucune ordonnance disponible" />
          ) : (
            sortedOrdonnances.map((ordonnance) => {
              const isExpanded = expandedOrdonnanceId === ordonnance.id;
              return (
                <article
                  key={ordonnance.id}
                  className="rounded-[14px] border-[0.8px] border-[#c2e0ef] bg-white"
                >
                  <div className="flex items-center justify-between px-4 py-4 transition-colors hover:bg-[#f8fbff]">
                    <button
                      className="flex flex-1 cursor-pointer items-center justify-between text-left"
                      onClick={() => {
                        setExpandedOrdonnanceId((prev) =>
                          prev === ordonnance.id ? null : ordonnance.id,
                        );
                      }}
                      type="button"
                    >
                      <div className="text-left">
                        <p className="font-['Poppins'] text-[14px] font-medium text-[#0f3460]">
                          Ordonnance du {formatDate(ordonnance.date_prescription)}
                        </p>
                        <p className="font-['Inter'] text-[12px] text-[rgba(100,116,139,0.9)]">
                          • {ordonnance.medicaments.length} médicament
                          {ordonnance.medicaments.length > 1 ? "s" : ""}
                        </p>
                        <div className="mt-2 inline-flex items-center gap-1 font-['Inter'] text-[12px] font-medium text-[rgba(100,116,139,0.9)]">
                          <Stethoscope className="size-[14px] text-[#265284]" />
                          <span>Suivi de :</span>
                          <span className="text-[#f97316]">{getSuiviMotif(ordonnance)}</span>
                        </div>
                      </div>
                    </button>

                    <div className="ml-3 flex items-center gap-2">
                      <button
                        className="inline-flex h-[36px] cursor-pointer items-center gap-[6px] rounded-[10px] border-[1.6px] border-[#c2e0ef] bg-white px-3 font-['Inter'] text-[12px] font-medium leading-4 text-[#265284] transition-colors hover:bg-[#f0f6ff]"
                        disabled={exportMutation.isPending}
                        onClick={(event) => {
                          event.stopPropagation();
                          exportMutation.mutate(ordonnance.id);
                        }}
                        type="button"
                      >
                        <span className="whitespace-nowrap">imprimer</span>
                        <Printer className="size-4" />
                      </button>
                      <button
                        className="inline-flex h-[36px] cursor-pointer items-center gap-[6px] rounded-[10px] border-[1.6px] border-[#c2e0ef] bg-white px-3 font-['Inter'] text-[12px] font-medium leading-4 text-[#265284] transition-colors hover:bg-[#f0f6ff]"
                        disabled={exportMutation.isPending}
                        onClick={(event) => {
                          event.stopPropagation();
                          exportMutation.mutate(ordonnance.id);
                        }}
                        type="button"
                      >
                        <span className="whitespace-nowrap">voir</span>
                        <Eye className="size-4" />
                      </button>
                      <button
                        className="inline-flex h-[36px] cursor-pointer items-center gap-[6px] rounded-[10px] border-[1.6px] border-[#fecaca] bg-white px-3 font-['Inter'] text-[12px] font-medium leading-4 text-[#dc2626] transition-colors hover:border-[#fca5a5] hover:bg-[#fef2f2]"
                        disabled={deleteMutation.isPending}
                        onClick={(event) => {
                          event.stopPropagation();
                          const confirmed = window.confirm(
                            "Supprimer cette ordonnance ? Cette action est irréversible.",
                          );
                          if (!confirmed) return;
                          deleteMutation.mutate(ordonnance.id);
                        }}
                        type="button"
                      >
                        <span className="whitespace-nowrap">supprimer</span>
                        <Trash2 className="size-4" />
                      </button>
                      <button
                        aria-expanded={isExpanded}
                        className="inline-flex size-8 cursor-pointer items-center justify-center rounded-[8px] text-[#64748b] transition-colors hover:bg-[#eaf3fb]"
                        onClick={(event) => {
                          event.stopPropagation();
                          setExpandedOrdonnanceId((prev) =>
                            prev === ordonnance.id ? null : ordonnance.id,
                          );
                        }}
                        type="button"
                      >
                        {isExpanded ? (
                          <ChevronDown className="size-4 text-[#64748b]" />
                        ) : (
                          <ChevronRight className="size-4 text-[#64748b]" />
                        )}
                      </button>
                    </div>
                  </div>

                  {isExpanded ? (
                    <div className="border-t-[0.8px] border-[#c2e0ef] px-4 py-3">
                      <div className="space-y-2">
                        {ordonnance.medicaments.map((medicament) => (
                          <div
                            key={medicament.id}
                            className="rounded-[10px] border-[0.8px] border-[#76bbdd] bg-[#f8fafc] p-3"
                          >
                            <p className="font-['Inter'] text-[14px] font-semibold text-[#0f3460]">
                              {medicament.nom_medicament}
                            </p>
                            <div className="mt-2 grid grid-cols-3 gap-3">
                              <InfoLine label="Posologie" value={medicament.posologie} />
                              <InfoLine label="Durée" value={medicament.duree_traitement ?? "—"} />
                              <InfoLine label="Instructions" value={medicament.instructions ?? "—"} />
                            </div>
                          </div>
                        ))}
                      </div>

                      {ordonnance.remarques ? (
                        <p className="mt-3 rounded-[10px] border-[0.8px] border-[#c2e0ef] bg-[#f8fafc] px-3 py-2 font-['Inter'] text-[12px] text-[#4b6787]">
                          Remarques : {ordonnance.remarques}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </article>
              );
            })
          )}
        </div>
      ) : null}

      {activeTab === "lettres" ? (
        <div className="flex flex-col gap-3">
          {sortedLettres.length === 0 ? (
            <EmptyState text="Aucune lettre d'orientation" />
          ) : (
            sortedLettres.map((lettre) => {
              const linkedDocument = documentsById.get(lettre.documents_patient_id);
              return (
                <article
                  key={lettre.id}
                  className="rounded-[10px] border-[0.8px] border-[#c2e0ef] bg-white p-4"
                >
                  <p className="font-['Poppins'] text-[14px] font-medium text-[#0f3460]">
                    {linkedDocument?.nom_document ?? "Lettre d'orientation"}
                  </p>
                  <p className="mt-1 font-['Inter'] text-[12px] text-[rgba(100,116,139,0.9)]">
                    Date : {formatDate(lettre.date_creation)}
                  </p>
                  <p className="mt-1 font-['Inter'] text-[12px] text-[rgba(100,116,139,0.9)]">
                    Urgence : {lettre.urgence}
                  </p>
                  {lettre.raison ? (
                    <p className="mt-2 font-['Inter'] text-[13px] text-[#4b6787]">{lettre.raison}</p>
                  ) : null}
                </article>
              );
            })
          )}
        </div>
      ) : null}

      {activeTab === "certificats" ? (
        <div className="flex flex-col gap-3">
          {sortedCertificats.length === 0 ? (
            <EmptyState text="Aucun certificat médical" />
          ) : (
            sortedCertificats.map((certificat) => {
              const linkedDocument = documentsById.get(certificat.documents_patient_id);
              return (
                <article
                  key={certificat.id}
                  className="rounded-[10px] border-[0.8px] border-[#c2e0ef] bg-white p-4"
                >
                  <p className="font-['Poppins'] text-[14px] font-medium text-[#0f3460]">
                    {linkedDocument?.nom_document ?? "Certificat médical"}
                  </p>
                  <p className="mt-1 font-['Inter'] text-[12px] text-[rgba(100,116,139,0.9)]">
                    Type : {certificat.type_certificat}
                  </p>
                  <p className="mt-1 font-['Inter'] text-[12px] text-[rgba(100,116,139,0.9)]">
                    Statut : {certificat.statut}
                  </p>
                  <p className="mt-1 font-['Inter'] text-[12px] text-[rgba(100,116,139,0.9)]">
                    Émis le : {formatDate(certificat.date_emission)}
                  </p>
                </article>
              );
            })
          )}
        </div>
      ) : null}

      {activeTab === "documents" ? (
        <div className="flex flex-col gap-4">
          <div className="rounded-[14px] border-[0.8px] border-[#c2e0ef] bg-white p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-1 flex-col gap-3 md:flex-row">
                <label className="relative flex h-[40px] flex-1 items-center">
                  <Search className="pointer-events-none absolute left-3 size-4 text-[#64748b]" />
                  <input
                    className="h-full w-full rounded-[10px] border-[0.8px] border-[#c2e0ef] bg-[#f8fafc] pl-9 pr-3 font-['Inter'] text-[13px] text-[#0f3460] outline-none placeholder:text-[#94a3b8] focus:border-[#76bbdd]"
                    onChange={(event) => setDocumentSearch(event.target.value)}
                    placeholder="Rechercher un document"
                    value={documentSearch}
                  />
                </label>
              </div>

              <div className="flex items-center gap-2">
                <button
                  className="h-[40px] cursor-pointer rounded-[10px] border-[1.2px] border-[#c2e0ef] bg-white px-3 font-['Inter'] text-[12px] font-medium text-[#265284] transition-colors hover:bg-[#f0f6ff]"
                  onClick={toggleVisibleDocuments}
                  type="button"
                >
                  {visibleDocuments.length > 0 &&
                  visibleDocuments.every((document) =>
                    selectedDocumentIds.includes(document.id),
                  )
                    ? "Deselectionner"
                    : "Tout selectionner"}
                </button>
                {selectedDocumentIds.length > 0 ? (
                  <button
                    className="inline-flex h-[40px] cursor-pointer items-center justify-center gap-2 rounded-[10px] border border-[#fecaca] bg-white px-3 font-['Inter'] text-[12px] font-semibold text-[#dc2626] transition-colors hover:border-[#fca5a5] hover:bg-[#fef2f2] disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={deleteDocumentMutation.isPending}
                    onClick={deleteSelectedDocuments}
                    type="button"
                  >
                    {deleteDocumentMutation.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Trash2 className="size-4" />
                    )}
                    Supprimer la selection
                  </button>
                ) : null}
                <button
                  className="inline-flex h-[40px] cursor-pointer items-center justify-center gap-2 rounded-[10px] bg-[#f97316] px-4 font-['Inter'] text-[12px] font-semibold text-white transition-colors hover:bg-[#ea6a13] disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={
                    documentAnalysisMutation.isPending ||
                    documentsForVerification.length === 0
                  }
                  onClick={runDocumentVerification}
                  type="button"
                >
                  {documentAnalysisMutation.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <ShieldAlert className="size-4" />
                  )}
                  Verifier
                </button>
              </div>
            </div>

            <DocumentAnalysisBanner
              isLoading={documentAnalysisMutation.isPending}
              result={documentAnalysisResult}
            />
          </div>

          {sortedDocuments.length === 0 ? (
            <EmptyState text="Aucun document patient" />
          ) : (
            <div className="flex flex-col gap-3">
              {visibleDocuments.length === 0 ? (
                <EmptyState text="Aucun document ne correspond aux filtres" />
              ) : (
                visibleDocuments.map((document) => {
                  const isSelected = selectedDocumentIds.includes(document.id);
                  const viewUrl = getDocumentFileUrl(document.id);
                  const downloadUrl = getDocumentFileUrl(document.id, true);
                  return (
                    <article
                      key={document.id}
                      className={cn(
                        "rounded-[14px] border-[0.8px] bg-white p-4 transition-colors",
                        isSelected ? "border-[#76bbdd] bg-[#f8fbff]" : "border-[#c2e0ef]",
                      )}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex min-w-0 items-start gap-3">
                          <button
                            aria-label={`Selectionner ${document.nom_document}`}
                            aria-pressed={isSelected}
                            className={cn(
                              "mt-0.5 flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-[9px] border-[1.4px] transition-colors focus:outline-none focus:ring-2 focus:ring-[#76bbdd] focus:ring-offset-2",
                              isSelected
                                ? "border-[#052ca0] bg-[#052ca0] text-white shadow-[0px_3px_8px_rgba(5,44,160,0.22)]"
                                : "border-[#c2e0ef] bg-white text-transparent hover:border-[#76bbdd] hover:bg-[#f0f6ff]",
                            )}
                            onClick={() => toggleDocumentSelection(document.id)}
                            type="button"
                          >
                            <CheckCircle2 className="size-4" />
                          </button>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-['Poppins'] text-[14px] font-medium text-[#0f3460]">
                                {document.nom_document}
                              </p>
                              <span className="rounded-full bg-[#eaf3fb] px-2 py-1 font-['Inter'] text-[11px] font-medium text-[#265284]">
                                {document.type_document}
                              </span>
                            </div>
                            <div className="mt-2 grid gap-2 font-['Inter'] text-[12px] text-[rgba(100,116,139,0.9)] md:grid-cols-3">
                              <span>Upload : {formatDate(document.date_upload)}</span>
                              <span>Format : {document.type_fichier}</span>
                              <span>Taille : {formatFileSize(document.taille_fichier)}</span>
                            </div>
                            {document.description ? (
                              <p className="mt-2 font-['Inter'] text-[13px] leading-5 text-[#4b6787]">
                                {document.description}
                              </p>
                            ) : null}
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          <a
                            className="inline-flex size-9 items-center justify-center rounded-[10px] border-[1.2px] border-[#c2e0ef] bg-white text-[#265284] transition-colors hover:bg-[#f0f6ff]"
                            href={viewUrl}
                            rel="noreferrer"
                            target="_blank"
                            title="Voir"
                          >
                            <Eye className="size-4" />
                          </a>
                          <a
                            className="inline-flex size-9 items-center justify-center rounded-[10px] border-[1.2px] border-[#c2e0ef] bg-white text-[#265284] transition-colors hover:bg-[#f0f6ff]"
                            download
                            href={downloadUrl}
                            title="Telecharger"
                          >
                            <Download className="size-4" />
                          </a>
                          <button
                            className="inline-flex size-9 cursor-pointer items-center justify-center rounded-[10px] border-[1.2px] border-[#fecaca] bg-white text-[#dc2626] transition-colors hover:border-[#fca5a5] hover:bg-[#fef2f2] disabled:cursor-not-allowed disabled:opacity-60"
                            disabled={deleteDocumentMutation.isPending}
                            onClick={() => {
                              const confirmed = window.confirm(
                                "Supprimer ce document ? Cette action est irreversible.",
                              );
                              if (!confirmed) return;
                              deleteDocumentMutation.mutate([document.id]);
                            }}
                            title="Supprimer"
                            type="button"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function DocumentTabButton({
  label,
  count,
  icon,
  active,
  onClick,
}: {
  label: string;
  count: number;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        "flex h-[41.6px] cursor-pointer items-center gap-2 rounded-tl-[10px] rounded-tr-[10px] border-b-[1.6px] px-4 font-['Plus_Jakarta_Sans'] text-[14px] font-medium transition-colors",
        active
          ? "border-[#265284] bg-[#c2e0ef] text-[#265284]"
          : "border-[rgba(100,116,139,0.9)] text-[rgba(100,116,139,0.9)] hover:bg-[#f8fafc]",
      )}
      onClick={onClick}
      type="button"
    >
      {icon}
      <span>{label}</span>
      <span
        className={cn(
          "rounded-full px-[6px] py-[2px] font-['Inter'] text-[12px] font-medium",
          active ? "bg-[#265284] text-white" : "bg-[#e2e8f0] text-[rgba(100,116,139,0.9)]",
        )}
      >
        {count}
      </span>
    </button>
  );
}

function DocumentAnalysisBanner({
  isLoading,
  result,
}: {
  isLoading: boolean;
  result: DocumentAnalysisResult | null;
}) {
  if (isLoading) {
    return (
      <div className="mt-4 flex items-center gap-2 rounded-[12px] border-[0.8px] border-[#c2e0ef] bg-[#f8fbff] px-3 py-2 font-['Inter'] text-[12px] font-medium text-[#265284]">
        <Loader2 className="size-4 animate-spin" />
        Verification des documents en cours
      </div>
    );
  }

  if (!result) return null;

  const isMismatch = result.identity_flag === "mismatch";

  return (
    <div
      className={cn(
        "mt-4 rounded-[12px] border-[0.8px] px-3 py-3",
        isMismatch ? "border-[#fed7aa] bg-[#fff7ed]" : "border-[#bbf7d0] bg-[#f0fdf4]",
      )}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-2">
          {isMismatch ? (
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[#c2410c]" />
          ) : (
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#15803d]" />
          )}
          <div>
            <p
              className={cn(
                "font-['Inter'] text-[13px] font-semibold",
                isMismatch ? "text-[#c2410c]" : "text-[#166534]",
              )}
            >
              {getIdentityLabel(result.identity_flag)}
            </p>
            <p className="mt-1 font-['Inter'] text-[12px] leading-5 text-[#4b6787]">
              {result.identity.details}
            </p>
          </div>
        </div>
      </div>

      {(result.suggestions ?? []).length > 0 ? (
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {(result.suggestions ?? []).slice(0, 4).map((suggestion) => (
            <div
              key={suggestion.suggestion_id}
              className="rounded-[10px] border-[0.8px] border-[#c2e0ef] bg-white px-3 py-2"
            >
              <p className="font-['Inter'] text-[12px] font-semibold text-[#0f3460]">
                {formatSuggestionValue(suggestion.field)} : {formatSuggestionValue(suggestion.suggested_value)}
              </p>
              <p className="mt-1 font-['Inter'] text-[11px] leading-4 text-[#64748b]">
                {suggestion.reason}
              </p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
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

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-['Inter'] text-[11px] text-[rgba(100,116,139,0.9)]">{label}</p>
      <p className="mt-1 font-['Inter'] text-[12px] font-semibold text-[#265284]">{value}</p>
    </div>
  );
}

function formatFileSize(size: number) {
  if (size < 1024) return `${size} o`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} Ko`;
  return `${(size / (1024 * 1024)).toFixed(1)} Mo`;
}

function getDocumentFileUrl(documentId: string, download = false) {
  const query = download ? "?download=1" : "";
  return `${env.VITE_SERVER_URL}/api/upload/document/${documentId}/file${query}`;
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex h-[154px] items-center justify-center rounded-[10px] border-[0.8px] border-dashed border-[#c2e0ef] bg-[#f9fafb]">
      <span className="font-['Inter'] text-[14px] text-[#64748b]">{text}</span>
    </div>
  );
}

function DocumentSkeleton() {
  return (
    <div className="flex w-full flex-col gap-6 pb-4">
      <Skeleton className="h-[52px] rounded-[12px]" />
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-44 rounded-[8px]" />
        <Skeleton className="h-[42px] w-[288px] rounded-[14px]" />
      </div>
      <Skeleton className="h-[92px] rounded-[14px]" />
      <Skeleton className="h-[92px] rounded-[14px]" />
      <Skeleton className="h-[92px] rounded-[14px]" />
    </div>
  );
}

function DocumentError() {
  return (
    <div className="flex h-[220px] items-center justify-center">
      <div className="flex flex-col items-center gap-3 rounded-[12px] border border-[#f97316] bg-[#fff7ed] px-6 py-5">
        <p className="font-['Inter'] text-[14px] text-[#b45309]">
          Impossible de charger cette vue pour le moment.
        </p>
        <button
          className="cursor-pointer rounded-[8px] border border-[#f97316] px-3 py-1 font-['Inter'] text-[12px] text-[#f97316] transition-colors hover:bg-[#ffedd5]"
          onClick={() => window.location.reload()}
          type="button"
        >
          Réessayer
        </button>
      </div>
    </div>
  );
}
