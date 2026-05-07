import { env } from "@doctor.com/env/web";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  CalendarClock,
  CalendarPlus,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Edit3,
  FileText,
  FileUp,
  Loader2,
  Play,
  Plus,
  Stethoscope,
  Trash2,
  UploadCloud,
  UserRound,
  X,
} from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { useMemo } from "react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { queryClient, trpc, trpcClient } from "@/utils/trpc";
import {
  DialogShell,
  Field,
  TimeField,
  fieldControlClassName,
} from "@/routes/agenda/popups/rdv-dialog-shared";

export const Route = createFileRoute("/patients/$id/rdv")({
  component: PatientRdvPage,
});

type RendezVousStatut =
  | "planifie"
  | "confirme"
  | "termine"
  | "annule"
  | "non_present"
  | "bloque";

type PatientRdv = {
  id: string;
  patient_id: string;
  suivi_id: string | null;
  date: string;
  heure: string;
  heure_fin: string | null;
  statut: RendezVousStatut;
  type_creneau: string | null;
  patient_label: string | null;
  patient_initials: string | null;
  couleur: string | null;
  notes: string | null;
  important: boolean;
  frequence_rappel: string | null;
  periode_rappel: string | null;
};

type RdvFormState = {
  date: string;
  heure: string;
  heureFin: string;
  statut: RendezVousStatut;
  typeCreneau: string;
  notes: string;
  important: boolean;
};

type ConsultationFields = {
  date: string;
  description_consultation: string;
  conclusion: string;
  taille: string;
  poids: string;
  spo2: string;
  tension_arterielle: string;
  frequence_cardiaque: string;
  temperature: string;
  aspect_general: string;
  examen_respiratoire: string;
  examen_cardiovasculaire: string;
  examen_cutane_muqueux: string;
  examen_ganglionnaire: string;
  examen_endocrinien: string;
  examen_genital: string;
  examen_urinaire: string;
  examen_orl: string;
  examen_digestif: string;
};

type DocFile = {
  id: string;
  file: File;
  nom: string;
  status: "ready" | "uploading" | "done" | "error";
  error?: string;
};

const STATUS_OPTIONS: Array<{ value: RendezVousStatut; label: string }> = [
  { value: "planifie", label: "Planifié" },
  { value: "confirme", label: "Confirmé" },
  { value: "termine", label: "Terminé" },
  { value: "annule", label: "Annulé" },
  { value: "non_present", label: "Non présent" },
  { value: "bloque", label: "Bloqué" },
];

const TYPE_OPTIONS = [
  "Consultation",
  "Contrôle de routine",
  "Première consultation",
  "Suivi post-traitement",
  "Urgence",
  "Créneau bloqué",
];

const STEPS_FULL = ["Rendez-vous", "Suivi", "Consultation", "Documents", "Terminer"] as const;
const STEPS_SHORT = ["Suivi", "Consultation", "Documents", "Terminer"] as const;

type WizardStep = 1 | 2 | 3 | 4 | 5;

function createDefaultForm(): RdvFormState {
  return {
    date: new Date().toISOString().slice(0, 10),
    heure: "09:00",
    heureFin: "09:30",
    statut: "planifie",
    typeCreneau: "Consultation",
    notes: "",
    important: false,
  };
}

function createDefaultConsultation(date?: string): ConsultationFields {
  return {
    date: date ?? new Date().toISOString().slice(0, 10),
    description_consultation: "",
    conclusion: "",
    taille: "",
    poids: "",
    spo2: "",
    tension_arterielle: "",
    frequence_cardiaque: "",
    temperature: "",
    aspect_general: "",
    examen_respiratoire: "",
    examen_cardiovasculaire: "",
    examen_cutane_muqueux: "",
    examen_ganglionnaire: "",
    examen_endocrinien: "",
    examen_genital: "",
    examen_urinaire: "",
    examen_orl: "",
    examen_digestif: "",
  };
}

function PatientRdvPage() {
  const { id } = Route.useParams();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingRdv, setEditingRdv] = useState<PatientRdv | null>(null);
  const [rdvForm, setRdvForm] = useState<RdvFormState>(createDefaultForm);

  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardSkipsRdv, setWizardSkipsRdv] = useState(false);
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [wizardRdvForm, setWizardRdvForm] = useState<RdvFormState>(createDefaultForm);
  const [isWizardRdvCreateOpen, setIsWizardRdvCreateOpen] = useState(false);
  const [selectedRdvId, setSelectedRdvId] = useState("");
  const [selectedSuiviId, setSelectedSuiviId] = useState("");
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [symptomDraft, setSymptomDraft] = useState("");

  const [consultationFields, setConsultationFields] = useState<ConsultationFields>(createDefaultConsultation);
  const [docFiles, setDocFiles] = useState<DocFile[]>([]);

  const rdvQuery = useQuery(trpc.agenda.getRDVParPatient.queryOptions({ patient_id: id }));
  const suivisQuery = useQuery(trpc.consultation.getActiveSuivis.queryOptions({ patient_id: id }));
  const fullRecordQuery = useQuery(trpc.patient.getPatientFullRecord.queryOptions({ id }));

  const patient = fullRecordQuery.data?.patient;
  const patientLabel = patient ? `${patient.prenom} ${patient.nom}`.trim() : "Patient";
  const patientInitials = getInitials(patientLabel);

  const rdvs = useMemo(
    () =>
      ([...(rdvQuery.data ?? [])] as PatientRdv[]).sort((a, b) =>
        `${b.date} ${b.heure}`.localeCompare(`${a.date} ${a.heure}`),
      ),
    [rdvQuery.data],
  );

  const activeSuivis = (suivisQuery.data ?? []) as Array<{
    id: string;
    motif?: string | null;
    symptoms?: string[] | null;
  }>;
  const selectedRdv = rdvs.find((r) => r.id === selectedRdvId) ?? null;

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries(trpc.agenda.getRDVParPatient.queryFilter({ patient_id: id })),
      queryClient.invalidateQueries(trpc.patient.getPatientFullRecord.queryFilter({ id })),
      queryClient.invalidateQueries(trpc.agenda.getRDVAujourdhui.queryFilter()),
      queryClient.invalidateQueries(trpc.agenda.getProchainsRDV.queryFilter({ jours: 7 })),
    ]);
  };

  const createMutation = useMutation({
    mutationFn: (form: RdvFormState) =>
      trpcClient.agenda.planifierRDV.mutate({
        patient_id: id,
        date: form.date,
        heure: form.heure,
        heure_fin: form.heureFin || null,
        statut: form.statut,
        type_creneau: form.typeCreneau.trim() || null,
        patient_label: patientLabel,
        patient_initials: patientInitials,
        notes: form.notes.trim() || null,
        important: form.important,
        frequence_rappel: null,
        periode_rappel: null,
      }),
    onSuccess: async () => {
      toast.success("Rendez-vous créé");
      setIsCreateOpen(false);
      setRdvForm(createDefaultForm());
      await invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const createWorkflowRdvMutation = useMutation({
    mutationFn: (form: RdvFormState) =>
      trpcClient.agenda.planifierRDV.mutate({
        patient_id: id,
        date: form.date,
        heure: form.heure,
        heure_fin: form.heureFin || null,
        statut: form.statut,
        type_creneau: form.typeCreneau.trim() || null,
        patient_label: patientLabel,
        patient_initials: patientInitials,
        notes: form.notes.trim() || null,
        important: form.important,
        frequence_rappel: null,
        periode_rappel: null,
      }),
    onSuccess: async (rdv) => {
      toast.success("Rendez-vous créé");
      setSelectedRdvId(rdv.id);
      setConsultationFields((current) => ({ ...current, date: rdv.date }));
      setWizardRdvForm(createDefaultForm());
      await invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: { rdvId: string; form: RdvFormState }) =>
      trpcClient.agenda.modifierRDV.mutate({
        rdv_id: payload.rdvId,
        donnees: {
          date: payload.form.date,
          heure: payload.form.heure,
          heure_fin: payload.form.heureFin || null,
          statut: payload.form.statut,
          type_creneau: payload.form.typeCreneau.trim() || null,
          notes: payload.form.notes.trim() || null,
          important: payload.form.important,
        },
      }),
    onSuccess: async () => {
      toast.success("Rendez-vous modifié");
      setEditingRdv(null);
      await invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (rdvId: string) => trpcClient.agenda.deleteSlot.mutate({ id: rdvId }),
    onSuccess: async () => {
      toast.success("Rendez-vous supprimé");
      await invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const workflowUpdateMutation = useMutation({
    mutationFn: (payload: { rdvId: string; suiviId?: string; status?: "termine" }) =>
      trpcClient.agenda.modifierRDV.mutate({
        rdv_id: payload.rdvId,
        donnees: {
          suivi_id: payload.suiviId,
          statut: payload.status,
        },
      }),
    onSuccess: invalidate,
    onError: (error) => toast.error(error.message),
  });

  const createSuiviMutation = useMutation({
    mutationFn: () =>
      trpcClient.consultation.createSuivi.mutate({
        patient_id: id,
        symptoms,
        date_ouverture: new Date().toISOString().slice(0, 10),
      }),
    onSuccess: async (suivi) => {
      setSelectedSuiviId(suivi.id);
      setSymptoms([]);
      setSymptomDraft("");
      await queryClient.invalidateQueries(
        trpc.consultation.getActiveSuivis.queryFilter({ patient_id: id }),
      );
      toast.success("Suivi créé");
    },
    onError: (error) => toast.error(error.message),
  });

  const createExamenMutation = useMutation({
    mutationFn: (fields: ConsultationFields) =>
      trpcClient.consultation.createExamen.mutate({
        suivi_id: selectedSuiviId,
        rendez_vous_id: selectedRdvId,
        date: fields.date,
        description_consultation: fields.description_consultation.trim() || null,
        conclusion: fields.conclusion.trim() || null,
        taille: fields.taille.trim() || null,
        poids: fields.poids.trim() || null,
        spo2: fields.spo2.trim() ? Number(fields.spo2) : null,
        tension_arterielle: fields.tension_arterielle.trim() || null,
        frequence_cardiaque: fields.frequence_cardiaque.trim() ? Number(fields.frequence_cardiaque) : null,
        temperature: fields.temperature.trim() ? Number(fields.temperature) : null,
        aspect_general: fields.aspect_general.trim() || null,
        examen_respiratoire: fields.examen_respiratoire.trim() || null,
        examen_cardiovasculaire: fields.examen_cardiovasculaire.trim() || null,
        examen_cutane_muqueux: fields.examen_cutane_muqueux.trim() || null,
        examen_ganglionnaire: fields.examen_ganglionnaire.trim() || null,
        examen_endocrinien: fields.examen_endocrinien.trim() || null,
        examen_genital: fields.examen_genital.trim() || null,
        examen_urinaire: fields.examen_urinaire.trim() || null,
        examen_orl: fields.examen_orl.trim() || null,
        examen_digestif: fields.examen_digestif.trim() || null,
      }),
    onSuccess: () => toast.success("Consultation enregistrée"),
    onError: (error) => toast.error(error.message),
  });

  const openCreate = () => {
    setRdvForm(createDefaultForm());
    setIsCreateOpen(true);
  };

  const openEdit = (rdv: PatientRdv) => {
    setEditingRdv(rdv);
    setRdvForm({
      date: rdv.date,
      heure: rdv.heure.slice(0, 5),
      heureFin: (rdv.heure_fin ?? "").slice(0, 5),
      statut: rdv.statut,
      typeCreneau: rdv.type_creneau ?? "Consultation",
      notes: rdv.notes ?? "",
      important: rdv.important,
    });
  };

  const submitForm = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!rdvForm.date || !rdvForm.heure) {
      toast.error("La date et l'heure de début sont obligatoires.");
      return;
    }
    if (rdvForm.heureFin && rdvForm.heureFin <= rdvForm.heure) {
      toast.error("L'heure de fin doit être après l'heure de début.");
      return;
    }
    if (editingRdv) {
      await updateMutation.mutateAsync({ rdvId: editingRdv.id, form: rdvForm });
    } else {
      await createMutation.mutateAsync(rdvForm);
    }
  };

  const deleteRdv = async (rdv: PatientRdv) => {
    if (!window.confirm("Supprimer ce rendez-vous ?")) return;
    await deleteMutation.mutateAsync(rdv.id);
  };

  const openWizard = (rdv?: PatientRdv) => {
    if (rdv) {
      setWizardSkipsRdv(true);
      setSelectedRdvId(rdv.id);
      setSelectedSuiviId(rdv.suivi_id ?? activeSuivis[0]?.id ?? "");
      setConsultationFields(createDefaultConsultation(rdv.date));
    } else {
      setWizardSkipsRdv(false);
      const firstActive = rdvs.find((r) => r.statut !== "termine" && r.statut !== "annule");
      setSelectedRdvId(firstActive?.id ?? "");
      setSelectedSuiviId(firstActive?.suivi_id ?? activeSuivis[0]?.id ?? "");
      setConsultationFields(createDefaultConsultation(firstActive?.date));
    }
    setWizardRdvForm(createDefaultForm());
    setIsWizardRdvCreateOpen(false);
    setCurrentStep(1);
    setSymptoms([]);
    setSymptomDraft("");
    setDocFiles([]);
    setIsWizardOpen(true);
  };

  const closeWizard = () => {
    setIsWizardOpen(false);
    setCurrentStep(1);
    setWizardRdvForm(createDefaultForm());
    setIsWizardRdvCreateOpen(false);
    setSelectedRdvId("");
    setSelectedSuiviId("");
    setSymptoms([]);
    setSymptomDraft("");
    setConsultationFields(createDefaultConsultation());
    setDocFiles([]);
  };

  const goNext = async () => {
    const backendStep = wizardSkipsRdv ? currentStep + 1 : currentStep;

    if (backendStep === 1 && !selectedRdv) {
      toast.error("Sélectionnez un rendez-vous.");
      return;
    }

    if (backendStep === 2) {
      if (!selectedRdv) return;
      if (!selectedSuiviId) {
        toast.error("Sélectionnez ou créez un suivi.");
        return;
      }
      await workflowUpdateMutation.mutateAsync({
        rdvId: selectedRdv.id,
        suiviId: selectedSuiviId,
      });
    }

    if (backendStep === 3) {
      if (!selectedSuiviId || !selectedRdvId) {
        toast.error("Suivi ou rendez-vous manquant.");
        return;
      }
      await createExamenMutation.mutateAsync(consultationFields);
    }

    if (backendStep === 4) {
      const ready = docFiles.filter((f) => f.status === "ready");
      if (ready.length > 0) {
        for (const df of ready) {
          setDocFiles((cur) => cur.map((f) => f.id === df.id ? { ...f, status: "uploading" } : f));
          try {
            const formData = new FormData();
            formData.append("file", df.file);
            formData.append("json", JSON.stringify({
              patient_id: id,
              nom_document: df.nom.trim() || df.file.name,
              type_document: "autre",
              description: null,
            }));
            const res = await fetch(`${env.VITE_SERVER_URL}/api/upload/document`, {
              method: "POST",
              body: formData,
              credentials: "include",
            });
            if (!res.ok) throw new Error("Échec de l'import");
            setDocFiles((cur) => cur.map((f) => f.id === df.id ? { ...f, status: "done" } : f));
          } catch {
            setDocFiles((cur) => cur.map((f) => f.id === df.id ? { ...f, status: "error", error: "Échec" } : f));
          }
        }
        await queryClient.invalidateQueries(
          trpc.patient.getPatientFullRecord.queryFilter({ id }),
        );
      }
    }

    const maxStep = wizardSkipsRdv ? 4 : 5;
    setCurrentStep((s) => Math.min(maxStep, s + 1) as WizardStep);
  };

  const goPrev = () => {
    setCurrentStep((s) => Math.max(1, s - 1) as WizardStep);
  };

  const finishRdv = async () => {
    if (!selectedRdv) return;
    await workflowUpdateMutation.mutateAsync({
      rdvId: selectedRdv.id,
      suiviId: selectedSuiviId || selectedRdv.suivi_id || undefined,
      status: "termine",
    });
    toast.success("Consultation terminée");
    closeWizard();
  };

  const addDocFile = (file: File) => {
    setDocFiles((cur) => [
      ...cur,
      { id: `${Date.now()}-${Math.random()}`, file, nom: file.name.replace(/\.[^.]+$/, ""), status: "ready" },
    ]);
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const isWizardUpdating =
    workflowUpdateMutation.isPending ||
    createSuiviMutation.isPending ||
    createExamenMutation.isPending ||
    createWorkflowRdvMutation.isPending;
  const wizardSteps = wizardSkipsRdv ? STEPS_SHORT : STEPS_FULL;
  const maxStep = wizardSkipsRdv ? 4 : 5;

  return (
    <div className="flex flex-col gap-6 pb-6">
      <section className="rounded-[14px] border-[0.8px] border-[#c2e0ef] bg-white px-4 py-5 shadow-[0px_4px_6px_0px_rgba(118,187,221,0.2),0px_2px_4px_0px_rgba(118,187,221,0.2)] sm:px-[24.8px] sm:pt-[24.8px]">
        <div className="mb-6 flex flex-col gap-4 sm:mb-8 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-center gap-[8px]">
            <CalendarClock className="size-5 shrink-0 text-[#052ca0]" />
            <div className="min-w-0">
              <h2 className="font-['Inter'] text-[20px] font-medium leading-7 text-[#052ca0]">
                Rendez-vous
              </h2>
              <p className="font-['Inter'] text-[13px] leading-5 text-[#6b819d]">
                {rdvs.length > 0
                  ? `${rdvs.length} rendez-vous enregistré${rdvs.length > 1 ? "s" : ""}`
                  : "Aucun rendez-vous enregistré pour ce patient."}
              </p>
            </div>
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <button
              className="flex h-[42px] w-full cursor-pointer items-center justify-center gap-2 rounded-[14px] border-[1.4px] border-[#c2e0ef] bg-white px-5 font-['Plus_Jakarta_Sans'] text-[14px] font-semibold text-[#265284] transition-colors hover:bg-[#f0f6ff] sm:w-auto"
              onClick={openCreate}
              type="button"
            >
              <CalendarPlus className="size-4 shrink-0" />
              Nouveau rendez-vous
            </button>
            <button
              className="flex h-[42px] w-full cursor-pointer items-center justify-center gap-2 rounded-[14px] bg-[#052ca0] px-5 font-['Plus_Jakarta_Sans'] text-[14px] font-semibold text-white shadow-[0px_4px_12px_0px_rgba(5,44,160,0.4)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-[#082f9e] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              disabled={rdvs.length === 0}
              onClick={() => openWizard()}
              type="button"
            >
              <Play className="size-4 shrink-0" />
              Démarrer la consultation
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {rdvQuery.isLoading ? (
            <div className="flex h-[154px] items-center justify-center rounded-[10px] border-[0.8px] border-dashed border-[#c2e0ef] bg-[#f9fafb]">
              <Loader2 className="size-5 animate-spin text-[#76bbdd]" />
            </div>
          ) : rdvs.length === 0 ? (
            <div className="flex h-[154px] items-center justify-center rounded-[10px] border-[0.8px] border-dashed border-[#c2e0ef] bg-[#f9fafb] px-4 text-center">
              <span className="font-['Inter'] text-[14px] leading-5 text-[#64748b]">
                Aucun rendez-vous pour ce patient.
              </span>
            </div>
          ) : (
            rdvs.map((rdv) => {
              const isActionable = rdv.statut !== "termine" && rdv.statut !== "annule";
              return (
                <article
                  key={rdv.id}
                  className="rounded-[10px] border-[0.8px] border-[#76bbdd] bg-[#f8fafc] p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-['Inter'] text-[14px] font-medium text-[#0f3460]">
                          {formatDate(rdv.date)} à {rdv.heure.slice(0, 5)}
                          {rdv.heure_fin ? ` – ${rdv.heure_fin.slice(0, 5)}` : ""}
                        </p>
                        <RdvStatusBadge status={rdv.statut} />
                        {rdv.important ? (
                          <span className="rounded-full border border-[#f97316] bg-[#fff7ed] px-2 py-0.5 font-['Inter'] text-[11px] font-semibold text-[#f97316]">
                            Important
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 font-['Inter'] text-[12px] text-[#64748b]">
                        {rdv.type_creneau ?? "Consultation"}
                        {rdv.suivi_id ? " · suivi lié" : ""}
                      </p>
                      {rdv.notes ? (
                        <p className="mt-2 line-clamp-2 font-['Inter'] text-[12px] leading-5 text-[#4b6787]">
                          {rdv.notes}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        aria-label="Modifier"
                        className="flex size-[35.2px] cursor-pointer items-center justify-center rounded-[10px] border-[1.6px] border-[#c2e0ef] bg-white text-[#0f3460] transition-colors hover:bg-[#f8fbff]"
                        onClick={() => openEdit(rdv)}
                        type="button"
                      >
                        <Edit3 className="size-4" />
                      </button>
                      <button
                        aria-label="Supprimer"
                        className="flex size-[35.2px] cursor-pointer items-center justify-center rounded-[10px] border-[1.6px] border-[#fecaca] bg-white text-[#e11d48] transition-colors hover:bg-[#fff1f2] disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={deleteMutation.isPending}
                        onClick={() => void deleteRdv(rdv)}
                        type="button"
                      >
                        <Trash2 className="size-4" />
                      </button>
                      {isActionable ? (
                        <button
                          className="flex h-[35px] cursor-pointer items-center gap-1.5 rounded-[10px] bg-[#052ca0] px-3 font-['Inter'] text-[12px] font-semibold text-white shadow-[0px_3px_8px_rgba(5,44,160,0.3)] transition-all hover:-translate-y-0.5 hover:bg-[#082f9e]"
                          onClick={() => openWizard(rdv)}
                          type="button"
                        >
                          <Play className="size-3.5" />
                          Démarrer
                        </button>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>

      <NouveauRdvDialog
        editingRdv={editingRdv}
        form={rdvForm}
        isOpen={isCreateOpen || editingRdv !== null}
        isSaving={isSaving}
        patientInitials={patientInitials}
        patientLabel={patientLabel}
        onChange={setRdvForm}
        onClose={() => {
          setIsCreateOpen(false);
          setEditingRdv(null);
        }}
        onSubmit={submitForm}
      />

      {isWizardOpen ? (
        <WorkflowDialog
          activeSuivis={activeSuivis}
          consultationFields={consultationFields}
          currentStep={currentStep}
          docFiles={docFiles}
          finishRdv={finishRdv}
          goNext={goNext}
          goPrev={goPrev}
          isUpdating={isWizardUpdating}
          isRdvCreateOpen={isWizardRdvCreateOpen}
          maxStep={maxStep}
          rdvs={rdvs}
          rdvForm={wizardRdvForm}
          selectedRdvId={selectedRdvId}
          selectedSuiviId={selectedSuiviId}
          skipsRdv={wizardSkipsRdv}
          steps={wizardSteps}
          symptomDraft={symptomDraft}
          symptoms={symptoms}
          onAddDocFile={addDocFile}
          onAddSymptom={() => {
            const v = symptomDraft.trim();
            if (!v) return;
            setSymptoms((cur) => normalizeSymptoms([...cur, v]));
            setSymptomDraft("");
          }}
          onClose={closeWizard}
          onConsultationChange={(patch) => setConsultationFields((c) => ({ ...c, ...patch }))}
          onCreateRdv={async () => {
            if (!wizardRdvForm.date || !wizardRdvForm.heure) {
              toast.error("La date et l'heure de début sont obligatoires.");
              return;
            }
            if (wizardRdvForm.heureFin && wizardRdvForm.heureFin <= wizardRdvForm.heure) {
              toast.error("L'heure de fin doit être après l'heure de début.");
              return;
            }
            await createWorkflowRdvMutation.mutateAsync(wizardRdvForm);
          }}
          onCreateSuivi={() => createSuiviMutation.mutate()}
          onRemoveDocFile={(fileId) => setDocFiles((cur) => cur.filter((f) => f.id !== fileId))}
          onRemoveSymptom={(sym) => setSymptoms((cur) => cur.filter((s) => s !== sym))}
          onSelectRdv={(rdvId) => {
            setSelectedRdvId(rdvId);
            const rdv = rdvs.find((r) => r.id === rdvId);
            if (rdv?.suivi_id) setSelectedSuiviId(rdv.suivi_id);
            if (rdv?.date) setConsultationFields((c) => ({ ...c, date: rdv.date }));
          }}
          onSelectSuivi={setSelectedSuiviId}
          onRdvFormChange={setWizardRdvForm}
          onToggleRdvCreate={() => setIsWizardRdvCreateOpen((open) => !open)}
          onSetSymptomDraft={setSymptomDraft}
          onUpdateDocName={(fileId, nom) =>
            setDocFiles((cur) => cur.map((f) => f.id === fileId ? { ...f, nom } : f))
          }
        />
      ) : null}
    </div>
  );
}

// ─── Nouveau RDV Dialog ─────────────────────────────────────────────────────

function NouveauRdvDialog({
  editingRdv,
  form,
  isOpen,
  isSaving,
  patientInitials,
  patientLabel,
  onChange,
  onClose,
  onSubmit,
}: {
  editingRdv: PatientRdv | null;
  form: RdvFormState;
  isOpen: boolean;
  isSaving: boolean;
  patientInitials: string;
  patientLabel: string;
  onChange: (v: RdvFormState | ((c: RdvFormState) => RdvFormState)) => void;
  onClose: () => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}) {
  const set = <K extends keyof RdvFormState>(k: K, v: RdvFormState[K]) =>
    onChange((c) => ({ ...c, [k]: v }));

  const isEdit = editingRdv !== null;

  return (
    <DialogShell
      footer={
        <>
          <button
            className="h-[38px] cursor-pointer rounded-[12px] border border-[#f77a21] px-4 font-['Plus_Jakarta_Sans'] text-[14px] font-medium text-[#f77a21] transition-colors hover:bg-[#fff7ed] disabled:opacity-60"
            disabled={isSaving}
            onClick={onClose}
            type="button"
          >
            Annuler
          </button>
          <button
            className="inline-flex h-[38px] cursor-pointer items-center justify-center gap-2 rounded-[12px] bg-[#052ca0] px-5 font-['Inter'] text-[14px] font-medium text-white shadow-[0px_4px_12px_rgba(5,44,160,0.4)] transition-colors hover:bg-[#082f9e] disabled:opacity-60"
            disabled={isSaving}
            form="patient-rdv-form"
            type="submit"
          >
            {isSaving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Check className="size-4" />
            )}
            {isEdit ? "Enregistrer" : "Créer le rendez-vous"}
          </button>
        </>
      }
      icon={<CalendarPlus className="size-5" />}
      maxWidth="max-w-[620px]"
      open={isOpen}
      subtitle="Planification du rendez-vous patient"
      title={isEdit ? "Modifier le rendez-vous" : "Nouveau rendez-vous"}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <form className="space-y-5" id="patient-rdv-form" onSubmit={onSubmit}>
        <div className="rounded-[18px] border border-[#c2e0ef] bg-gradient-to-br from-[rgba(194,224,239,0.42)] to-white p-4 shadow-[0_10px_30px_rgba(15,52,96,0.08)]">
          <div className="flex items-center gap-3">
            <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-[#052ca0] bg-white font-['Inter'] text-[14px] font-bold text-[#052ca0]">
              {patientInitials}
            </span>
            <div className="min-w-0">
              <p className="truncate font-['Plus_Jakarta_Sans'] text-[16px] font-bold text-[#0f3460]">
                {patientLabel}
              </p>
              <p className="mt-0.5 font-['Inter'] text-[12px] text-[#64748b]">
                {form.typeCreneau} · {form.heure}{form.heureFin ? ` – ${form.heureFin}` : ""}
              </p>
            </div>
            <span className={cn(
              "ml-auto shrink-0 inline-flex h-7 items-center rounded-full border px-3 font-['Inter'] text-[12px] font-semibold",
              statusBadgeClass(form.statut),
            )}>
              {STATUS_OPTIONS.find((o) => o.value === form.statut)?.label ?? form.statut}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Type" required>
            <div className="relative">
              <select
                className={cn(fieldControlClassName, "appearance-none pr-9")}
                onChange={(e) => set("typeCreneau", e.target.value)}
                value={form.typeCreneau}
              >
                {TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-[#94a3b8]" />
            </div>
          </Field>

          <Field label="Statut" required>
            <div className="relative">
              <select
                className={cn(fieldControlClassName, "appearance-none pr-9")}
                onChange={(e) => set("statut", e.target.value as RendezVousStatut)}
                value={form.statut}
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-[#94a3b8]" />
            </div>
          </Field>

          <Field label="Date" required>
            <div className="relative">
              <CalendarPlus className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#94a3b8]" />
              <input
                className={cn(fieldControlClassName, "pl-10")}
                onChange={(e) => set("date", e.target.value)}
                type="date"
                value={form.date}
              />
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Début" required>
              <div className="relative">
                <Clock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#94a3b8]" />
                <TimeField
                  ariaLabel="Heure de début"
                  className="pl-10"
                  value={form.heure}
                  onChange={(v) => set("heure", v)}
                />
              </div>
            </Field>
            <Field label="Fin">
              <TimeField
                ariaLabel="Heure de fin"
                value={form.heureFin}
                onChange={(v) => set("heureFin", v)}
              />
            </Field>
          </div>

          <div className="sm:col-span-2">
            <Field label="Important">
              <label className={cn(
                fieldControlClassName,
                "inline-flex cursor-pointer items-center gap-3",
              )}>
                <input
                  checked={form.important}
                  className="peer sr-only"
                  onChange={(e) => set("important", e.target.checked)}
                  type="checkbox"
                />
                <span className="relative h-5 w-9 rounded-full bg-[#dbeaf3] transition peer-checked:bg-[#052ca0] peer-checked:[&>span]:translate-x-4">
                  <span className="absolute left-0.5 top-0.5 size-4 rounded-full bg-white shadow-[0_1px_3px_rgba(15,52,96,0.18)] transition" />
                </span>
                <span className="font-['Inter'] text-[13px] text-[#0f3460]">
                  {form.important ? "Marquer comme important" : "Normal"}
                </span>
              </label>
            </Field>
          </div>
        </div>

        <Field label="Notes">
          <div className="relative">
            <FileText className="pointer-events-none absolute left-3 top-3 size-4 text-[#94a3b8]" />
            <textarea
              className={cn(
                fieldControlClassName,
                "min-h-[88px] resize-none pl-10 pt-2.5",
              )}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Notes internes, préparation, documents à demander..."
              value={form.notes}
            />
          </div>
        </Field>
      </form>
    </DialogShell>
  );
}

// ─── Workflow Dialog ─────────────────────────────────────────────────────────

function WorkflowDialog({
  activeSuivis,
  consultationFields,
  currentStep,
  docFiles,
  finishRdv,
  goNext,
  goPrev,
  isUpdating,
  isRdvCreateOpen,
  maxStep,
  rdvs,
  rdvForm,
  selectedRdvId,
  selectedSuiviId,
  skipsRdv,
  steps,
  symptomDraft,
  symptoms,
  onAddDocFile,
  onAddSymptom,
  onClose,
  onConsultationChange,
  onCreateRdv,
  onCreateSuivi,
  onRemoveDocFile,
  onRemoveSymptom,
  onSelectRdv,
  onSelectSuivi,
  onRdvFormChange,
  onSetSymptomDraft,
  onToggleRdvCreate,
  onUpdateDocName,
}: {
  activeSuivis: Array<{ id: string; motif?: string | null; symptoms?: string[] | null }>;
  consultationFields: ConsultationFields;
  currentStep: WizardStep;
  docFiles: DocFile[];
  finishRdv: () => Promise<void>;
  goNext: () => Promise<void>;
  goPrev: () => void;
  isUpdating: boolean;
  isRdvCreateOpen: boolean;
  maxStep: number;
  rdvs: PatientRdv[];
  rdvForm: RdvFormState;
  selectedRdvId: string;
  selectedSuiviId: string;
  skipsRdv: boolean;
  steps: readonly string[];
  symptomDraft: string;
  symptoms: string[];
  onAddDocFile: (file: File) => void;
  onAddSymptom: () => void;
  onClose: () => void;
  onConsultationChange: (patch: Partial<ConsultationFields>) => void;
  onCreateRdv: () => Promise<void>;
  onCreateSuivi: () => void;
  onRemoveDocFile: (id: string) => void;
  onRemoveSymptom: (sym: string) => void;
  onSelectRdv: (id: string) => void;
  onSelectSuivi: (id: string) => void;
  onRdvFormChange: (v: RdvFormState | ((c: RdvFormState) => RdvFormState)) => void;
  onSetSymptomDraft: (v: string) => void;
  onToggleRdvCreate: () => void;
  onUpdateDocName: (id: string, nom: string) => void;
}) {
  const backendStep = skipsRdv ? currentStep + 1 : currentStep;
  const selectedRdv = rdvs.find((r) => r.id === selectedRdvId) ?? null;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const setRdvFormValue = <K extends keyof RdvFormState>(
    key: K,
    value: RdvFormState[K],
  ) => onRdvFormChange((current) => ({ ...current, [key]: value }));
  const canCreateRdv =
    rdvForm.date.trim().length > 0 &&
    rdvForm.heure.trim().length > 0 &&
    (!rdvForm.heureFin || rdvForm.heureFin > rdvForm.heure);
  const stepBlockReason =
    backendStep === 1 && !selectedRdv
      ? "Sélectionnez ou créez un rendez-vous pour continuer."
      : backendStep === 2 && !selectedSuiviId
        ? "Sélectionnez ou créez un suivi pour continuer."
        : backendStep === 3 && !consultationFields.date
          ? "Renseignez la date de consultation pour continuer."
          : "";
  const canContinue = !stepBlockReason;

  return (
    <DialogShell
      footer={
        <div className="flex w-full flex-col gap-2">
          {stepBlockReason ? (
            <p className="m-0 text-right font-['Inter'] text-[12px] font-medium text-[#f97316]">
              {stepBlockReason}
            </p>
          ) : null}
          <div className="flex w-full items-center justify-between">
          <button
            className="flex h-[38px] cursor-pointer items-center gap-1.5 rounded-[12px] border border-[#c2e0ef] bg-white px-4 font-['Inter'] text-[13px] font-medium text-[#0f3460] transition-colors hover:bg-[#f8fbff] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={currentStep === 1 || isUpdating}
            onClick={goPrev}
            type="button"
          >
            <ChevronLeft className="size-4" />
            Précédent
          </button>

          {currentStep < maxStep ? (
            <button
              className="flex h-[38px] cursor-pointer items-center gap-1.5 rounded-[12px] bg-[#052ca0] px-5 font-['Inter'] text-[13px] font-semibold text-white shadow-[0px_4px_12px_rgba(5,44,160,0.4)] transition-colors hover:bg-[#082f9e] disabled:cursor-not-allowed disabled:bg-[#c2e0ef] disabled:text-[#6b819d] disabled:shadow-none"
              disabled={isUpdating || !canContinue}
              onClick={() => void goNext()}
              type="button"
            >
              {isUpdating ? <Loader2 className="size-4 animate-spin" /> : null}
              {backendStep === 3 ? "Enregistrer & continuer" : backendStep === 4 ? (docFiles.some((f) => f.status === "ready") ? "Importer & continuer" : "Passer cette étape") : "Continuer"}
              <ChevronRight className="size-4" />
            </button>
          ) : (
            <button
              className="flex h-[38px] cursor-pointer items-center gap-2 rounded-[12px] bg-[#008236] px-5 font-['Inter'] text-[13px] font-semibold text-white shadow-[0px_4px_12px_rgba(0,130,54,0.35)] transition-colors hover:bg-[#006b2d] disabled:cursor-not-allowed disabled:bg-[#d0f1e7] disabled:text-[#4b7a55] disabled:shadow-none"
              disabled={isUpdating || !selectedRdv}
              onClick={() => void finishRdv()}
              type="button"
            >
              {isUpdating ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <CheckCircle2 className="size-4" />
              )}
              Terminer la consultation
            </button>
          )}
          </div>
        </div>
      }
      icon={<CalendarClock className="size-5" />}
      maxWidth={backendStep === 3 ? "max-w-[720px]" : "max-w-[600px]"}
      open
      subtitle={`Étape ${currentStep} sur ${maxStep}`}
      title="Session de consultation"
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      {/* Step indicator */}
      <div className="mb-5">
        <div className="mb-3 flex items-center justify-between gap-1">
          {steps.map((label, index) => {
            const step = (index + 1) as WizardStep;
            const isActive = step === currentStep;
            const isDone = step < currentStep;
            return (
              <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5" key={label}>
                <span
                  className={cn(
                    "flex size-7 items-center justify-center rounded-full font-['Inter'] text-[12px] font-semibold transition-colors",
                    isDone
                      ? "bg-[#008236] text-white"
                      : isActive
                        ? "bg-[#052ca0] text-white"
                        : "bg-[#e2e8f0] text-[#94a3b8]",
                  )}
                >
                  {isDone ? <Check className="size-3.5" /> : step}
                </span>
                <span
                  className={cn(
                    "hidden text-center font-['Inter'] text-[11px] leading-4 sm:block",
                    isActive ? "font-semibold text-[#052ca0]" : "text-[#94a3b8]",
                  )}
                >
                  {label}
                </span>
              </div>
            );
          })}
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-[#e2e8f0]">
          <div
            className="h-full rounded-full bg-[#052ca0] transition-all duration-300"
            style={{ width: `${((currentStep - 1) / (maxStep - 1)) * 100}%` }}
          />
        </div>
      </div>

      {/* Step content */}
      <div className={cn(
        "overflow-y-auto",
        backendStep === 3 ? "max-h-[52vh]" : "min-h-[200px]",
      )}>

        {/* Step 1: select RDV */}
        {backendStep === 1 ? (
          <div className="space-y-4">
            <div className="rounded-[12px] border-[0.8px] border-[#c2e0ef] bg-[#f8fafc]">
              <button
                aria-expanded={isRdvCreateOpen}
                className="flex w-full items-start justify-between gap-3 px-4 py-4 text-left"
                onClick={onToggleRdvCreate}
                type="button"
              >
                <div>
                  <p className="font-['Inter'] text-[13px] font-semibold text-[#0f3460]">
                    Créer un rendez-vous pour cette session
                  </p>
                  <p className="mt-1 font-['Inter'] text-[12px] leading-5 text-[#64748b]">
                    Le rendez-vous créé sera sélectionné automatiquement.
                  </p>
                </div>
                <span className="flex items-center gap-2 text-[#76bbdd]">
                  <CalendarPlus className="size-5 shrink-0" />
                  <ChevronDown
                    className={cn(
                      "size-4 shrink-0 transition-transform",
                      isRdvCreateOpen ? "rotate-180" : "",
                    )}
                  />
                </span>
              </button>
              {isRdvCreateOpen ? (
                <div className="border-t border-[#c2e0ef] px-4 pb-4 pt-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <InlineField label="Type" required>
                      <div className="relative">
                        <select
                          className={cn(fieldControlClassName, "appearance-none pr-9")}
                          onChange={(event) => setRdvFormValue("typeCreneau", event.target.value)}
                          value={rdvForm.typeCreneau}
                        >
                          {TYPE_OPTIONS.map((type) => (
                            <option key={type} value={type}>
                              {type}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-[#94a3b8]" />
                      </div>
                    </InlineField>
                    <InlineField label="Date" required>
                      <input
                        className={fieldControlClassName}
                        onChange={(event) => setRdvFormValue("date", event.target.value)}
                        type="date"
                        value={rdvForm.date}
                      />
                    </InlineField>
                    <InlineField label="Début" required>
                      <TimeField
                        ariaLabel="Heure de début du nouveau rendez-vous"
                        value={rdvForm.heure}
                        onChange={(value) => setRdvFormValue("heure", value)}
                      />
                    </InlineField>
                    <InlineField label="Fin">
                      <TimeField
                        ariaLabel="Heure de fin du nouveau rendez-vous"
                        value={rdvForm.heureFin}
                        onChange={(value) => setRdvFormValue("heureFin", value)}
                      />
                    </InlineField>
                    <div className="sm:col-span-2">
                      <InlineField label="Notes">
                        <textarea
                          className={cn(fieldControlClassName, "min-h-[70px] resize-none py-2")}
                          onChange={(event) => setRdvFormValue("notes", event.target.value)}
                          placeholder="Notes internes, préparation, documents à demander..."
                          value={rdvForm.notes}
                        />
                      </InlineField>
                    </div>
                  </div>
                  {!canCreateRdv ? (
                    <p className="mb-0 mt-2 font-['Inter'] text-[12px] font-medium text-[#f97316]">
                      Date et heure de début obligatoires. L'heure de fin doit rester après le début.
                    </p>
                  ) : null}
                  <button
                    className="mt-3 inline-flex h-9 cursor-pointer items-center gap-2 rounded-[10px] bg-[#052ca0] px-4 font-['Inter'] text-[12px] font-semibold text-white shadow-[0px_4px_12px_rgba(5,44,160,0.28)] transition-colors hover:bg-[#082f9e] disabled:cursor-not-allowed disabled:bg-[#c2e0ef] disabled:text-[#6b819d] disabled:shadow-none"
                    disabled={isUpdating || !canCreateRdv}
                    onClick={() => void onCreateRdv()}
                    type="button"
                  >
                    {isUpdating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                    Créer et sélectionner
                  </button>
                </div>
              ) : null}
            </div>

            <p className="font-['Inter'] text-[13px] text-[#64748b]">
              Ou sélectionnez un rendez-vous existant.
            </p>
            {rdvs.filter((r) => r.statut !== "termine" && r.statut !== "annule").length === 0 ? (
              <div className="flex h-[120px] items-center justify-center rounded-[10px] border-[0.8px] border-dashed border-[#c2e0ef] bg-[#f9fafb]">
                <span className="font-['Inter'] text-[13px] text-[#64748b]">
                  Aucun rendez-vous actif disponible.
                </span>
              </div>
            ) : (
              rdvs
                .filter((r) => r.statut !== "termine" && r.statut !== "annule")
                .map((rdv) => (
                  <button
                    className={cn(
                      "w-full rounded-[10px] border-[0.8px] bg-white p-4 text-left transition-colors",
                      selectedRdvId === rdv.id
                        ? "border-[#052ca0] bg-[#f0f6ff]"
                        : "border-[#c2e0ef] hover:bg-[#f8fbff]",
                    )}
                    key={rdv.id}
                    onClick={() => onSelectRdv(rdv.id)}
                    type="button"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-['Inter'] text-[14px] font-medium text-[#0f3460]">
                          {formatDate(rdv.date)} à {rdv.heure.slice(0, 5)}
                        </p>
                        <p className="mt-0.5 font-['Inter'] text-[12px] text-[#64748b]">
                          {rdv.type_creneau ?? "Consultation"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <RdvStatusBadge status={rdv.statut} />
                        {selectedRdvId === rdv.id ? (
                          <Check className="size-4 text-[#052ca0]" />
                        ) : null}
                      </div>
                    </div>
                  </button>
                ))
            )}
          </div>
        ) : null}

        {/* Step 2: link suivi */}
        {backendStep === 2 ? (
          <div className="space-y-4">
            {selectedRdv ? (
              <div className="rounded-[10px] border-[0.8px] border-[#76bbdd] bg-[#f0f6ff] px-4 py-3">
                <p className="font-['Inter'] text-[12px] font-semibold text-[#052ca0]">
                  Rendez-vous sélectionné
                </p>
                <p className="mt-0.5 font-['Inter'] text-[13px] text-[#0f3460]">
                  {formatDate(selectedRdv.date)} à {selectedRdv.heure.slice(0, 5)}
                  {" · "}{selectedRdv.type_creneau ?? "Consultation"}
                </p>
              </div>
            ) : null}

            <Field label="Suivi actif existant">
              <div className="relative">
                <select
                  className={cn(fieldControlClassName, "appearance-none pr-9")}
                  onChange={(e) => onSelectSuivi(e.target.value)}
                  value={selectedSuiviId}
                >
                  <option value="">Sélectionner un suivi</option>
                  {activeSuivis.map((s) => (
                    <option key={s.id} value={s.id}>
                      {formatSuiviLabel(s)}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-[#94a3b8]" />
              </div>
            </Field>

            <div className="rounded-[10px] border-[0.8px] border-[#c2e0ef] bg-white p-4">
              <p className="font-['Inter'] text-[13px] font-semibold text-[#0f3460]">
                Ou créer un nouveau suivi
              </p>
              <div className="mt-3 rounded-[10px] border-[1.4px] border-[#c2e0ef] bg-[#f8fafc] px-3 py-2.5">
                {symptoms.length > 0 ? (
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {symptoms.map((sym) => (
                      <span
                        className="inline-flex items-center gap-1 rounded-full border border-[#c2e0ef] bg-white px-2.5 py-0.5 font-['Inter'] text-[12px] text-[#0f3460]"
                        key={sym}
                      >
                        {sym}
                        <button
                          className="ml-0.5 cursor-pointer text-[#94a3b8] hover:text-[#e11d48]"
                          onClick={() => onRemoveSymptom(sym)}
                          type="button"
                        >
                          <X className="size-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}
                <div className="flex gap-2">
                  <input
                    className="h-9 min-w-0 flex-1 bg-transparent font-['Inter'] text-[13px] text-[#0f3460] outline-none placeholder:text-[#94a3b8]"
                    onChange={(e) => onSetSymptomDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        onAddSymptom();
                      }
                    }}
                    placeholder="Ajouter un symptôme puis Entrée"
                    value={symptomDraft}
                  />
                  <button
                    className="flex h-9 cursor-pointer items-center gap-1 rounded-[8px] bg-[#eaf3fb] px-3 font-['Inter'] text-[12px] font-semibold text-[#0f3460] disabled:opacity-50"
                    disabled={!symptomDraft.trim()}
                    onClick={onAddSymptom}
                    type="button"
                  >
                    <Plus className="size-3" />
                    Ajouter
                  </button>
                </div>
              </div>
              <button
                className="mt-3 flex h-9 cursor-pointer items-center gap-2 rounded-[10px] border-[1.4px] border-[#052ca0] px-3 font-['Inter'] text-[12px] font-semibold text-[#052ca0] transition-colors hover:bg-[#f0f6ff] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isUpdating || symptoms.length === 0}
                onClick={onCreateSuivi}
                type="button"
              >
                {isUpdating ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Plus className="size-4" />
                )}
                Créer ce suivi
              </button>
            </div>
          </div>
        ) : null}

        {/* Step 3: inline consultation form */}
        {backendStep === 3 ? (
          <div className="space-y-4 pr-1">
            <div className="flex items-center gap-2 rounded-[10px] border-[0.8px] border-[#76bbdd] bg-[#f0f6ff] px-4 py-3">
              <Stethoscope className="size-4 shrink-0 text-[#052ca0]" />
              <p className="font-['Inter'] text-[13px] text-[#0f3460]">
                <span className="font-semibold text-[#052ca0]">Consultation</span>
                {selectedRdv ? ` · ${formatDate(selectedRdv.date)} à ${selectedRdv.heure.slice(0, 5)}` : ""}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <InlineField label="Date" required>
                <input
                  className={fieldControlClassName}
                  onChange={(e) => onConsultationChange({ date: e.target.value })}
                  type="date"
                  value={consultationFields.date}
                />
              </InlineField>
            </div>

            <InlineField label="Description de la consultation">
              <textarea
                className={cn(fieldControlClassName, "min-h-[72px] resize-none py-2")}
                onChange={(e) => onConsultationChange({ description_consultation: e.target.value })}
                placeholder="Motif, plaintes principales, contexte de la consultation…"
                value={consultationFields.description_consultation}
              />
            </InlineField>

            <div className="rounded-[10px] border-[0.8px] border-[#c2e0ef] bg-[#f8fafc]">
              <div className="border-b border-[#c2e0ef] px-4 py-2">
                <p className="font-['Plus_Jakarta_Sans'] text-[11px] font-bold uppercase tracking-wide text-[#0f3460]">
                  Constantes vitales
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3 p-4">
                {(
                  [
                    ["taille", "Taille (cm)"],
                    ["poids", "Poids (kg)"],
                    ["spo2", "SpO2 (%)"],
                    ["tension_arterielle", "Tension art."],
                    ["frequence_cardiaque", "FC (bpm)"],
                    ["temperature", "Temp. (°C)"],
                  ] as [keyof ConsultationFields, string][]
                ).map(([key, label]) => (
                  <div className="space-y-1" key={key}>
                    <p className="font-['Inter'] text-[11px] font-semibold uppercase tracking-wide text-[#052ca0]">
                      {label}
                    </p>
                    <input
                      className="h-[36px] w-full rounded-[10px] border-[0.8px] border-[#c2e0ef] bg-white px-3 font-['Inter'] text-[13px] text-[#0f3460] outline-none transition hover:border-[#9ecae0] focus:border-[#76bbdd] focus:ring-2 focus:ring-[#76bbdd]/20"
                      onChange={(e) => onConsultationChange({ [key]: e.target.value })}
                      placeholder="—"
                      value={consultationFields[key] as string}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[10px] border-[0.8px] border-[#c2e0ef] bg-[#f8fafc]">
              <div className="border-b border-[#c2e0ef] px-4 py-2">
                <p className="font-['Plus_Jakarta_Sans'] text-[11px] font-bold uppercase tracking-wide text-[#0f3460]">
                  Examen clinique
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 p-4">
                {(
                  [
                    ["aspect_general", "Aspect général"],
                    ["examen_respiratoire", "Respiratoire"],
                    ["examen_cardiovasculaire", "Cardiovasculaire"],
                    ["examen_cutane_muqueux", "Cutané / muqueux"],
                    ["examen_ganglionnaire", "Ganglionnaire"],
                    ["examen_endocrinien", "Endocrinien"],
                    ["examen_genital", "Génital"],
                    ["examen_urinaire", "Urinaire"],
                    ["examen_orl", "ORL"],
                    ["examen_digestif", "Digestif"],
                  ] as [keyof ConsultationFields, string][]
                ).map(([key, label]) => (
                  <div className="space-y-1" key={key}>
                    <p className="font-['Inter'] text-[11px] font-semibold uppercase tracking-wide text-[#052ca0]">
                      {label}
                    </p>
                    <input
                      className="h-[36px] w-full rounded-[10px] border-[0.8px] border-[#c2e0ef] bg-white px-3 font-['Inter'] text-[13px] text-[#0f3460] outline-none transition hover:border-[#9ecae0] focus:border-[#76bbdd] focus:ring-2 focus:ring-[#76bbdd]/20"
                      onChange={(e) => onConsultationChange({ [key]: e.target.value })}
                      placeholder="—"
                      value={consultationFields[key] as string}
                    />
                  </div>
                ))}
              </div>
            </div>

            <InlineField label="Diagnostic / Conclusion">
              <textarea
                className={cn(fieldControlClassName, "min-h-[72px] resize-none py-2")}
                onChange={(e) => onConsultationChange({ conclusion: e.target.value })}
                placeholder="Diagnostic retenu, plan de traitement, observations…"
                value={consultationFields.conclusion}
              />
            </InlineField>
          </div>
        ) : null}

        {/* Step 4: inline document upload */}
        {backendStep === 4 ? (
          <div className="space-y-4">
            <div className="flex items-start gap-2 rounded-[10px] border-[0.8px] border-[#c2e0ef] bg-[#f0f6ff] px-4 py-3">
              <FileUp className="mt-0.5 size-4 shrink-0 text-[#052ca0]" />
              <p className="font-['Inter'] text-[13px] text-[#0f3460]">
                <span className="font-semibold text-[#052ca0]">Documents</span>
                {" — "}
                <span className="text-[#64748b]">Étape optionnelle. Importez les documents reçus lors de la visite.</span>
              </p>
            </div>

            <input
              accept=".pdf,.png,.jpg,.jpeg,.webp"
              className="hidden"
              multiple
              onChange={(e) => {
                for (const file of Array.from(e.target.files ?? [])) {
                  onAddDocFile(file);
                }
                e.target.value = "";
              }}
              ref={fileInputRef}
              type="file"
            />

            {docFiles.length === 0 ? (
              <button
                className="flex h-[110px] w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-[10px] border-[1.4px] border-dashed border-[#c2e0ef] bg-[#f9fafb] transition-colors hover:border-[#76bbdd] hover:bg-[#f0f6ff]"
                onClick={() => fileInputRef.current?.click()}
                type="button"
              >
                <UploadCloud className="size-6 text-[#76bbdd]" />
                <span className="font-['Inter'] text-[13px] text-[#64748b]">
                  Cliquez pour sélectionner des fichiers
                </span>
                <span className="font-['Inter'] text-[11px] text-[#94a3b8]">PDF, PNG, JPG, WEBP · max 10 Mo</span>
              </button>
            ) : (
              <div className="space-y-2">
                {docFiles.map((df) => (
                  <div
                    className={cn(
                      "flex items-center gap-3 rounded-[10px] border-[0.8px] bg-white p-3",
                      df.status === "done"
                        ? "border-[#bbf7d0] bg-[#f0fdf4]"
                        : df.status === "error"
                          ? "border-[#fecaca] bg-[#fff1f2]"
                          : "border-[#c2e0ef]",
                    )}
                    key={df.id}
                  >
                    <FileText className={cn(
                      "size-4 shrink-0",
                      df.status === "done" ? "text-[#008236]" : df.status === "error" ? "text-[#e11d48]" : "text-[#76bbdd]",
                    )} />
                    <input
                      className="min-w-0 flex-1 bg-transparent font-['Inter'] text-[13px] text-[#0f3460] outline-none placeholder:text-[#94a3b8]"
                      disabled={df.status !== "ready"}
                      onChange={(e) => onUpdateDocName(df.id, e.target.value)}
                      placeholder="Nom du document"
                      value={df.nom}
                    />
                    {df.status === "uploading" ? (
                      <Loader2 className="size-4 shrink-0 animate-spin text-[#76bbdd]" />
                    ) : df.status === "done" ? (
                      <Check className="size-4 shrink-0 text-[#008236]" />
                    ) : df.status === "error" ? (
                      <span className="font-['Inter'] text-[11px] text-[#e11d48]">Échec</span>
                    ) : (
                      <button
                        className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-[8px] border border-[#fecaca] bg-white text-[#e11d48] hover:bg-[#fff1f2]"
                        onClick={() => onRemoveDocFile(df.id)}
                        type="button"
                      >
                        <X className="size-3.5" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  className="flex h-9 w-full cursor-pointer items-center justify-center gap-2 rounded-[10px] border-[1.4px] border-dashed border-[#c2e0ef] font-['Inter'] text-[13px] text-[#64748b] transition-colors hover:border-[#76bbdd] hover:bg-[#f0f6ff] hover:text-[#052ca0]"
                  onClick={() => fileInputRef.current?.click()}
                  type="button"
                >
                  <Plus className="size-4" />
                  Ajouter un autre fichier
                </button>
              </div>
            )}
          </div>
        ) : null}

        {/* Step 5: finish */}
        {backendStep === 5 ? (
          <div className="rounded-[10px] border-[0.8px] border-[#bbf7d0] bg-[#f0fdf4] p-5">
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#008236] text-white">
                <CheckCircle2 className="size-5" />
              </div>
              <div>
                <p className="font-['Inter'] text-[15px] font-semibold text-[#166534]">
                  Prêt à terminer
                </p>
                <p className="mt-1 font-['Inter'] text-[13px] leading-5 text-[#4b7a55]">
                  Le rendez-vous sera marqué comme terminé dans l'agenda. Cliquez sur "Terminer la consultation" pour valider.
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </DialogShell>
  );
}

// ─── Inline field wrapper ─────────────────────────────────────────────────────

function InlineField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <p className="font-['Plus_Jakarta_Sans'] text-[11px] font-bold uppercase tracking-wide text-[#0f3460]">
        {label}
        {required ? <span className="ml-0.5 text-[#f97316]">*</span> : null}
      </p>
      {children}
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function RdvStatusBadge({ status }: { status: RendezVousStatut }) {
  const option = STATUS_OPTIONS.find((o) => o.value === status);
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-full border px-2.5 font-['Inter'] text-[11px] font-semibold",
        statusBadgeClass(status),
      )}
    >
      {option?.label ?? status}
    </span>
  );
}

function statusBadgeClass(status: RendezVousStatut) {
  switch (status) {
    case "termine":
      return "border-[#bbf7d0] bg-[#f0fdf4] text-[#008236]";
    case "confirme":
      return "border-[#c2e0ef] bg-[#eaf3fb] text-[#265284]";
    case "annule":
    case "non_present":
      return "border-[#fecaca] bg-[#fff1f2] text-[#e11d48]";
    case "bloque":
      return "border-[#d1d5db] bg-[#f3f4f6] text-[#4b5563]";
    default:
      return "border-[#fed7aa] bg-[#fff7ed] text-[#f97316]";
  }
}

function formatSuiviLabel(suivi: { motif?: string | null; symptoms?: string[] | null }) {
  const symptoms = Array.isArray(suivi.symptoms) && suivi.symptoms.length > 0
    ? suivi.symptoms
    : (suivi.motif ?? "").split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
  return symptoms.length > 0 ? symptoms.join(", ") : "Symptômes non renseignés";
}

function normalizeSymptoms(values: string[]): string[] {
  const seen = new Set<string>();
  return values
    .map((v) => v.trim())
    .filter((v) => {
      if (!v || seen.has(v.toLowerCase())) return false;
      seen.add(v.toLowerCase());
      return true;
    });
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function getInitials(value: string) {
  return (
    value
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p.charAt(0).toUpperCase())
      .join("") || "PT"
  );
}
