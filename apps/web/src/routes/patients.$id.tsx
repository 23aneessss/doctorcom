import {
  createFileRoute,
  Link,
  Outlet,
  redirect,
  useLocation,
} from "@tanstack/react-router";
import { useForm } from "@tanstack/react-form";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Briefcase,
  Calendar,
  Droplets,
  Home,
  Users,
  CalendarDays,
  HelpCircle,
  FileText,
  Settings,
  Mail,
  MapPin,
  Phone,
  Pill,
  Plus,
  ShieldCheck,
  User,
  Wallet,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { authClient } from "@/lib/auth-client";
import { NouvelleConsultationDialog } from "@/routes/patients.$id/popups/nouvelle-consultation";
import { NouveauSuiviDialog } from "@/routes/patients.$id/popups/nouveau-suivi";
import { cn } from "@/lib/utils";
import { queryClient, trpc, trpcClient } from "@/utils/trpc";

type SuiviDialogValues = {
  motif?: string;
  date_ouverture?: string;
  hypothese_diagnostic?: string;
  historique?: string;
};

type ConsultationDialogValues = {
  suivi_id?: string;
  rendez_vous_id?: string;
  date?: string;
  description_consultation?: string;
  conclusion?: string;
  taille?: string;
  poids?: string;
  spo2?: string;
  tension_arterielle?: string;
  frequence_cardiaque?: string;
  temperature?: string;
  aspect_general?: string;
  examen_respiratoire?: string;
  examen_cardiovasculaire?: string;
  examen_cutane_muqueux?: string;
  examen_ganglionnaire?: string;
  examen_endocrinien?: string;
  examen_genital?: string;
  examen_urinaire?: string;
  examen_orl?: string;
  examen_digestif?: string;
};

type PatientPopupEventDetail = {
  type: "suivi" | "consultation";
  mode?: "create" | "edit";
  suiviId?: string;
  examenId?: string;
  initialValues?: SuiviDialogValues | ConsultationDialogValues;
};

export const Route = createFileRoute("/patients/$id")({
  component: PatientLayout,
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session.data) {
      redirect({ to: "/login", throw: true });
    }
    return { session };
  },
});

const tabs = [
  { label: "Vue d'ensemble", to: "/patients/$id/general" },
  { label: "Suivis", to: "/patients/$id/suivi" },
  { label: "Antécédents", to: "/patients/$id/antecedent" },
  { label: "Traitements", to: "/patients/$id/traitement" },
  { label: "Documents", to: "/patients/$id/document" },
  { label: "Vaccinations", to: "/patients/$id/vaccination" },
  { label: "Santé Féminine", to: "/patients/$id/sante-feminine" },
  { label: "Infos Sociales", to: "/patients/$id/info-sociale" },
  { label: "Voyages", to: "/patients/$id/voyage" },
] as const;

function PatientLayout() {
  const { id } = Route.useParams();
  const location = useLocation();
  const [isEditing, setIsEditing] = useState(false);
  const [isNouveauSuiviOpen, setIsNouveauSuiviOpen] = useState(false);
  const [isNouvelleConsultationOpen, setIsNouvelleConsultationOpen] = useState(false);
  const [suiviDialogMode, setSuiviDialogMode] = useState<"create" | "edit">("create");
  const [suiviDialogId, setSuiviDialogId] = useState<string | undefined>(undefined);
  const [suiviDialogValues, setSuiviDialogValues] = useState<SuiviDialogValues | undefined>(
    undefined
  );
  const [consultationDialogMode, setConsultationDialogMode] = useState<"create" | "edit">(
    "create"
  );
  const [consultationDialogId, setConsultationDialogId] = useState<string | undefined>(
    undefined
  );
  const [consultationDialogValues, setConsultationDialogValues] = useState<
    ConsultationDialogValues | undefined
  >(undefined);

  useEffect(() => {
    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<PatientPopupEventDetail>;
      if (customEvent.detail?.type === "suivi") {
        setSuiviDialogMode(customEvent.detail.mode ?? "create");
        setSuiviDialogId(customEvent.detail.suiviId);
        setSuiviDialogValues(
          (customEvent.detail.initialValues as SuiviDialogValues | undefined) ?? undefined
        );
        setIsNouveauSuiviOpen(true);
      }
      if (customEvent.detail?.type === "consultation") {
        setConsultationDialogMode(customEvent.detail.mode ?? "create");
        setConsultationDialogId(customEvent.detail.examenId);
        const initial =
          (customEvent.detail.initialValues as ConsultationDialogValues | undefined) ?? {};
        if (
          customEvent.detail.mode !== "edit" &&
          customEvent.detail.suiviId &&
          !initial.suivi_id
        ) {
          initial.suivi_id = customEvent.detail.suiviId;
        }
        setConsultationDialogValues(
          Object.keys(initial).length > 0 ? initial : undefined
        );
        setIsNouvelleConsultationOpen(true);
      }
    };

    window.addEventListener("patient-popup-open", handler as EventListener);
    return () => window.removeEventListener("patient-popup-open", handler as EventListener);
  }, []);

  const { data: patient } = useSuspenseQuery(
    trpc.patient.getPatient.queryOptions({ id })
  );
  const { data: ageData } = useSuspenseQuery(
    trpc.patient.getPatientAge.queryOptions({ id })
  );

  const updatePatientMutation = useMutation({
    mutationFn: async (data: {
      nom?: string;
      prenom?: string;
      telephone?: string | null;
      email?: string | null;
      adresse?: string | null;
      profession?: string | null;
      nationalite?: string | null;
      situation_familiale?: string | null;
      revenu_mensuel?: string | null;
    }) => {
      return trpcClient.patient.updatePatient.mutate({ id, data });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries(trpc.patient.getPatient.queryFilter({ id })),
        queryClient.invalidateQueries(trpc.patient.getPatientAge.queryFilter({ id })),
      ]);
      setIsEditing(false);
      toast.success("Données patient mises à jour");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  if (!patient) {
    return <div className="p-6 text-muted-foreground">Patient non trouvé</div>;
  }

  const patientAge = ageData.age;
  const fullName = `${patient.prenom} ${patient.nom}`;
  const sexeLabel =
    patient.sexe === "M" ? "Homme" : patient.sexe === "F" ? "Femme" : (patient.sexe ?? "");

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    return d.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const form = useForm({
    defaultValues: {
      nom: patient.nom ?? "",
      prenom: patient.prenom ?? "",
      telephone: patient.telephone ?? "",
      email: patient.email ?? "",
      adresse: patient.adresse ?? "",
      profession: patient.profession ?? "",
      nationalite: patient.nationalite ?? "",
      situation_familiale: patient.situation_familiale ?? "",
      revenu_mensuel: patient.revenu_mensuel ?? "",
    },
    validators: {
      onSubmit: z.object({
        nom: z.string().trim().min(1, "Le nom est requis").max(255),
        prenom: z.string().trim().min(1, "Le prenom est requis").max(255),
        telephone: z.string().max(32),
        email: z.union([z.literal(""), z.string().email()]),
        adresse: z.string().max(255),
        profession: z.string().max(255),
        nationalite: z.string().max(255),
        situation_familiale: z.string().max(255),
        revenu_mensuel: z.union([
          z.literal(""),
          z.string().regex(/^\d+(\.\d+)?$/, "Le revenu doit être numérique"),
        ]),
      }),
    },
    onSubmit: async ({ value }) => {
      const nextData: {
        nom?: string;
        prenom?: string;
        telephone?: string | null;
        email?: string | null;
        adresse?: string | null;
        profession?: string | null;
        nationalite?: string | null;
        situation_familiale?: string | null;
        revenu_mensuel?: string | null;
      } = {};

      const changedValue = (next: string, current: string | null | undefined) =>
        next.trim() !== (current ?? "").trim();

      const normalizeOptionalField = (next: string, current: string | null | undefined) => {
        if (!changedValue(next, current)) return undefined;
        const trimmed = next.trim();
        return trimmed.length > 0 ? trimmed : null;
      };

      if (changedValue(value.nom, patient.nom)) {
        nextData.nom = value.nom.trim();
      }
      if (changedValue(value.prenom, patient.prenom)) {
        nextData.prenom = value.prenom.trim();
      }

      const telephone = normalizeOptionalField(value.telephone, patient.telephone);
      if (telephone !== undefined) {
        nextData.telephone = telephone;
      }

      const email = normalizeOptionalField(value.email, patient.email);
      if (email !== undefined) {
        nextData.email = email;
      }

      const adresse = normalizeOptionalField(value.adresse, patient.adresse);
      if (adresse !== undefined) {
        nextData.adresse = adresse;
      }

      const profession = normalizeOptionalField(value.profession, patient.profession);
      if (profession !== undefined) {
        nextData.profession = profession;
      }

      const nationalite = normalizeOptionalField(value.nationalite, patient.nationalite);
      if (nationalite !== undefined) {
        nextData.nationalite = nationalite;
      }

      const situationFamiliale = normalizeOptionalField(
        value.situation_familiale,
        patient.situation_familiale
      );
      if (situationFamiliale !== undefined) {
        nextData.situation_familiale = situationFamiliale;
      }

      const revenu = normalizeOptionalField(value.revenu_mensuel, patient.revenu_mensuel);
      if (revenu !== undefined) {
        nextData.revenu_mensuel = revenu;
      }

      if (Object.keys(nextData).length === 0) {
        toast.info("Aucune modification détectée");
        setIsEditing(false);
        return;
      }

      await updatePatientMutation.mutateAsync(nextData);
    },
  });

  const handleSuiviCreated = async () => {
    await Promise.all([
      queryClient.invalidateQueries(
        trpc.consultation.getPatientSuivis.queryFilter({ patient_id: id })
      ),
      queryClient.invalidateQueries(
        trpc.patient.getPatientFullRecord.queryFilter({ id })
      ),
    ]);
  };

  const handleConsultationCreated = async () => {
    await Promise.all([
      queryClient.invalidateQueries(
        trpc.patient.getPatientFullRecord.queryFilter({ id })
      ),
      queryClient.invalidateQueries(
        trpc.consultation.getPatientSuivis.queryFilter({ patient_id: id })
      ),
      queryClient.invalidateQueries(
        trpc.consultation.getExamensPatient.queryFilter({ patient_id: id })
      ),
    ]);
  };

  return (
    <div className="flex h-screen">
      {/* Sidebar Placeholder */}
      <div className="w-[260px] shrink-0 bg-gradient-to-b from-[#0f3460] from-[30%] via-[#123865] via-[65%] to-[#285487] flex flex-col items-center pt-[34px]">
        {/* Logo placeholder */}
        <div className="w-[176px] h-[71px] flex items-center justify-center">
          <span className="font-['Plus_Jakarta_Sans'] font-bold text-[22px] text-white leading-tight text-center">
            doctor<br />.com
          </span>
        </div>

        {/* Nav items placeholder */}
        <div className="mt-[60px] flex flex-col items-center gap-[2px] w-[213px]">
          <SidebarItem icon={<Home className="size-5" />} label="Accueil" active />
          <SidebarItem icon={<Users className="size-5" />} label="Patients" />
          <SidebarItem icon={<Pill className="size-5" />} label="Médicament" />
          <SidebarItem icon={<CalendarDays className="size-5" />} label="Agenda" />
          <SidebarItem icon={<FileText className="size-5" />} label="Ordonnance" />
        </div>

        {/* Divider */}
        <div className="w-full h-px bg-white/70 mt-[30px]" />

        {/* Lower nav */}
        <div className="mt-[25px] flex flex-col items-center gap-[2px] w-[203px]">
          <SidebarItem icon={<HelpCircle className="size-5" />} label="Aide" />
          <SidebarItem icon={<Settings className="size-5" />} label="Paramètres" />
        </div>

        {/* Doctor profile placeholder (bottom) */}
        <div className="mt-auto mb-[30px] bg-[#0f3460] rounded-xl p-[10px] flex items-center gap-[10px] w-[230px] shadow-[0px_4px_20px_0px_rgba(194,224,239,0.3)]">
          <div className="size-[36px] rounded-full bg-[#d9d9d9] shrink-0" />
          <div className="flex flex-col min-w-0">
            <span className="font-['Plus_Jakarta_Sans'] font-bold text-[14px] text-white truncate">
              Dr. Benmoussa Karim
            </span>
            <span className="font-['Plus_Jakarta_Sans'] text-[12px] text-white/80 truncate">
              tbib@doctorcom.com
            </span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 min-h-screen bg-[#f8fafc] p-6 overflow-auto">
        <div className="max-w-[1112px] mx-auto flex flex-col gap-[33px]">
          {/* Back Link */}
          <Link
            to="/patients"
            className="inline-flex items-center gap-2 text-[#052ca0] font-['Plus_Jakarta_Sans'] font-semibold text-[20px] leading-[21px] hover:opacity-80 transition-opacity"
          >
            <ArrowLeft className="size-5" />
            Retour aux patients
          </Link>

          {/* Patient Info Card */}
          <div className="bg-white border-[0.8px] border-[#f97316] rounded-[20px] px-12 pt-6 pb-6 shadow-[0px_4px_6px_0px_rgba(201,228,241,0.2),0px_2px_4px_0px_rgba(201,228,241,0.2)]">
            <div className="flex justify-between gap-8">
              {/* Left: Identity */}
              <div className="flex flex-col gap-[10px]">
                <h1 className="font-['Plus_Jakarta_Sans'] font-medium text-[30px] leading-[36px] text-[#0f3460]">
                  {fullName}
                </h1>
                <p className="font-['Plus_Jakarta_Sans'] text-[14px] leading-[20px] text-[rgba(100,116,139,0.9)]">
                  ID: {patient.matricule}
                </p>

                {/* Badges */}
                <div className="flex items-center gap-2 mt-1">
                  {patientAge !== undefined && (
                    <span className="bg-[#c2e0ef] border-[0.8px] border-[#0f3460] rounded-[8px] px-[9px] py-[3px] font-['Poppins'] text-[12px] leading-[16px] text-[#0f3460]">
                      {patientAge} ans
                    </span>
                  )}
                  {sexeLabel && (
                    <span className="bg-[#c2e0ef] border-[0.8px] border-[#0f3460] rounded-[8px] px-[9px] py-[3px] font-['Poppins'] text-[12px] leading-[16px] text-[#0f3460]">
                      {sexeLabel}
                    </span>
                  )}
                  {patient.groupe_sanguin && (
                    <span className="bg-[#fff7ed] border-[0.8px] border-[#f97316] rounded-[8px] px-[9px] py-[3px] font-['Poppins'] text-[12px] leading-[16px] text-[#f97316] flex items-center gap-1">
                      <Droplets className="size-3" />
                      {patient.groupe_sanguin}
                    </span>
                  )}
                </div>

                {/* Contact rows */}
              <div className="flex flex-col gap-[10px] mt-1">
                <form.Field name="nom">
                  {(field) => (
                    <div className="flex items-center gap-2">
                      <User className="size-4 text-[#265284]" />
                      {isEditing ? (
                        <div>
                          <input
                            className="h-8 rounded-md border border-[#c2e0ef] bg-white px-2 font-['Poppins'] text-[14px] leading-[20px] text-[#265284]"
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(e) => field.handleChange(e.target.value)}
                          />
                          {field.state.meta.errors[0]?.message ? (
                            <p className="text-xs text-red-600">
                              {field.state.meta.errors[0].message}
                            </p>
                          ) : null}
                        </div>
                      ) : (
                        <span className="font-['Poppins'] text-[14px] leading-[20px] text-[#265284]">
                          {patient.nom}
                        </span>
                      )}
                    </div>
                  )}
                </form.Field>

                <form.Field name="prenom">
                  {(field) => (
                    <div className="flex items-center gap-2">
                      <User className="size-4 text-[#265284]" />
                      {isEditing ? (
                        <div>
                          <input
                            className="h-8 rounded-md border border-[#c2e0ef] bg-white px-2 font-['Poppins'] text-[14px] leading-[20px] text-[#265284]"
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(e) => field.handleChange(e.target.value)}
                          />
                          {field.state.meta.errors[0]?.message ? (
                            <p className="text-xs text-red-600">
                              {field.state.meta.errors[0].message}
                            </p>
                          ) : null}
                        </div>
                      ) : (
                        <span className="font-['Poppins'] text-[14px] leading-[20px] text-[#265284]">
                          {patient.prenom}
                        </span>
                      )}
                    </div>
                  )}
                </form.Field>

                <form.Field name="telephone">
                  {(field) => (
                    <div className="flex items-center gap-2">
                      <Phone className="size-4 text-[#265284]" />
                      {isEditing ? (
                        <div>
                          <input
                            className="h-8 rounded-md border border-[#c2e0ef] bg-white px-2 font-['Poppins'] text-[14px] leading-[20px] text-[#265284]"
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(e) => field.handleChange(e.target.value)}
                          />
                          {field.state.meta.errors[0]?.message ? (
                            <p className="text-xs text-red-600">
                              {field.state.meta.errors[0].message}
                            </p>
                          ) : null}
                        </div>
                      ) : (
                        <span className="font-['Poppins'] text-[14px] leading-[20px] text-[#265284]">
                          {patient.telephone ?? "—"}
                        </span>
                      )}
                    </div>
                  )}
                </form.Field>
                <form.Field name="email">
                  {(field) => (
                    <div className="flex items-center gap-2">
                      <Mail className="size-4 text-[#265284]" />
                      {isEditing ? (
                        <div>
                          <input
                            className="h-8 rounded-md border border-[#c2e0ef] bg-white px-2 font-['Plus_Jakarta_Sans'] text-[14px] leading-[20px] text-[#265284]"
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(e) => field.handleChange(e.target.value)}
                          />
                          {field.state.meta.errors[0]?.message ? (
                            <p className="text-xs text-red-600">
                              {field.state.meta.errors[0].message}
                            </p>
                          ) : null}
                        </div>
                      ) : (
                        <span className="font-['Plus_Jakarta_Sans'] text-[14px] leading-[20px] text-[#265284]">
                          {patient.email ?? "—"}
                        </span>
                      )}
                    </div>
                  )}
                </form.Field>
                <form.Field name="adresse">
                  {(field) => (
                    <div className="flex items-center gap-2">
                      <MapPin className="size-4 text-[#265284]" />
                      {isEditing ? (
                        <div>
                          <input
                            className="h-8 w-[280px] rounded-md border border-[#c2e0ef] bg-white px-2 font-['Plus_Jakarta_Sans'] text-[14px] leading-[20px] text-[#265284]"
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(e) => field.handleChange(e.target.value)}
                          />
                          {field.state.meta.errors[0]?.message ? (
                            <p className="text-xs text-red-600">
                              {field.state.meta.errors[0].message}
                            </p>
                          ) : null}
                        </div>
                      ) : (
                        <span className="font-['Plus_Jakarta_Sans'] text-[14px] leading-[20px] text-[#265284]">
                          {patient.adresse ?? "—"}
                        </span>
                      )}
                    </div>
                  )}
                </form.Field>
              </div>

              {/* Profession */}
              <form.Field name="profession">
                {(field) => (
                  <div className="flex items-center gap-2 mt-1">
                    <Briefcase className="size-4 text-[#265284]" />
                    {isEditing ? (
                      <div>
                        <input
                          className="h-8 rounded-md border border-[#c2e0ef] bg-white px-2 font-['Plus_Jakarta_Sans'] text-[14px] leading-[20px] text-[#265284]"
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                        />
                        {field.state.meta.errors[0]?.message ? (
                          <p className="text-xs text-red-600">
                            {field.state.meta.errors[0].message}
                          </p>
                        ) : null}
                      </div>
                    ) : (
                      <span className="font-['Plus_Jakarta_Sans'] text-[14px] leading-[20px] text-[#265284]">
                        {patient.profession ?? "—"}
                      </span>
                    )}
                  </div>
                )}
              </form.Field>
              </div>

              {/* Center: Medical Info */}
              <div className="flex flex-col gap-[8px] justify-center">
                <PatientInfoRow
                  icon={<ShieldCheck className="size-4" />}
                  label="NSS :"
                  value={patient.nss ? String(patient.nss) : "—"}
                />
                <PatientInfoRow
                  icon={<Calendar className="size-4" />}
                  label="Date de naissance :"
                  value={formatDate(patient.date_naissance)}
                />
                <PatientInfoRow
                  icon={<MapPin className="size-4" />}
                  label="Lieu de naissance :"
                  value={patient.lieu_naissance ?? "—"}
                />
                <PatientInfoRow
                  icon={<User className="size-4" />}
                  label="Nationalité :"
                  value={
                    isEditing ? (
                      <form.Field name="nationalite">
                        {(field) => (
                          <div>
                            <input
                              className="h-8 rounded-md border border-[#c2e0ef] bg-white px-2 font-['Poppins'] text-[14px] leading-[20px] text-[#265284]"
                              value={field.state.value}
                              onBlur={field.handleBlur}
                              onChange={(e) => field.handleChange(e.target.value)}
                            />
                            {field.state.meta.errors[0]?.message ? (
                              <p className="text-xs text-red-600">
                                {field.state.meta.errors[0].message}
                              </p>
                            ) : null}
                          </div>
                        )}
                      </form.Field>
                    ) : (
                      patient.nationalite ?? "—"
                    )
                  }
                />
                <PatientInfoRow
                  icon={<User className="size-4" />}
                  label="Situation familiale :"
                  value={
                    isEditing ? (
                      <form.Field name="situation_familiale">
                        {(field) => (
                          <div>
                            <input
                              className="h-8 rounded-md border border-[#c2e0ef] bg-white px-2 font-['Poppins'] text-[14px] leading-[20px] text-[#265284]"
                              value={field.state.value}
                              onBlur={field.handleBlur}
                              onChange={(e) => field.handleChange(e.target.value)}
                            />
                            {field.state.meta.errors[0]?.message ? (
                              <p className="text-xs text-red-600">
                                {field.state.meta.errors[0].message}
                              </p>
                            ) : null}
                          </div>
                        )}
                      </form.Field>
                    ) : (
                      patient.situation_familiale ?? "—"
                    )
                  }
                />
                <PatientInfoRow
                  icon={<Wallet className="size-4" />}
                  label="Revenu mensuel :"
                  value={
                    isEditing ? (
                      <form.Field name="revenu_mensuel">
                        {(field) => (
                          <div>
                            <input
                              className="h-8 rounded-md border border-[#c2e0ef] bg-white px-2 font-['Poppins'] text-[14px] leading-[20px] text-[#265284]"
                              value={field.state.value}
                              onBlur={field.handleBlur}
                              onChange={(e) => field.handleChange(e.target.value)}
                            />
                            {field.state.meta.errors[0]?.message ? (
                              <p className="text-xs text-red-600">
                                {field.state.meta.errors[0].message}
                              </p>
                            ) : null}
                          </div>
                        )}
                      </form.Field>
                    ) : patient.revenu_mensuel ? (
                      `${patient.revenu_mensuel} DZD`
                    ) : (
                      "—"
                    )
                  }
                />

                {/* Divider */}
                <div className="border-t-[0.8px] border-[#c2e0ef] pt-[8px]">
                  <PatientInfoRow
                    icon={<Calendar className="size-4" />}
                    label="Date d'admission :"
                    value={formatDate(patient.date_admission)}
                  />
                </div>
              </div>

              {/* Right: Action Buttons */}
              <div className="flex flex-col gap-[8px] justify-center">
                {!isEditing ? (
                  <button
                    className="bg-white border border-[#c2e0ef] rounded-[10px] h-[40px] w-[195px] font-['Plus_Jakarta_Sans'] font-semibold text-[14px] leading-[16px] text-[#0f3460] hover:bg-[#f8fafc] transition-colors"
                    onClick={() => {
                      form.reset({
                        nom: patient.nom ?? "",
                        prenom: patient.prenom ?? "",
                        telephone: patient.telephone ?? "",
                        email: patient.email ?? "",
                        adresse: patient.adresse ?? "",
                        profession: patient.profession ?? "",
                        nationalite: patient.nationalite ?? "",
                        situation_familiale: patient.situation_familiale ?? "",
                        revenu_mensuel: patient.revenu_mensuel ?? "",
                      });
                      setIsEditing(true);
                    }}
                    type="button"
                  >
                    Modifier
                  </button>
                ) : (
                  <>
                    <button
                      className="bg-white border border-[#c2e0ef] rounded-[10px] h-[40px] w-[195px] font-['Plus_Jakarta_Sans'] font-semibold text-[14px] leading-[16px] text-[#0f3460] hover:bg-[#f8fafc] transition-colors"
                      onClick={() => setIsEditing(false)}
                      type="button"
                    >
                      Annuler
                    </button>
                    <button
                      className="bg-[#f97316] rounded-[10px] h-[40px] w-[195px] font-['Plus_Jakarta_Sans'] font-semibold text-[14px] leading-[16px] text-white hover:bg-[#ea6a13] transition-colors"
                      onClick={() => form.handleSubmit()}
                      disabled={updatePatientMutation.isPending}
                      type="button"
                    >
                      {updatePatientMutation.isPending ? "Enregistrement..." : "Enregistrer"}
                    </button>
                  </>
                )}
                <ActionButton
                  label="Ajouter suivi"
                  layout="suivi"
                  specialIcon={<SuiviIcon />}
                  onClick={() => {
                    setSuiviDialogMode("create");
                    setSuiviDialogId(undefined);
                    setSuiviDialogValues(undefined);
                    setIsNouveauSuiviOpen(true);
                  }}
                />
                <ActionButton
                  label="Ajouter consultation"
                  layout="centered"
                  specialIcon={<ConsultationIcon />}
                  onClick={() => {
                    setConsultationDialogMode("create");
                    setConsultationDialogId(undefined);
                    setConsultationDialogValues(undefined);
                    setIsNouvelleConsultationOpen(true);
                  }}
                />
                <ActionButton
                  label="Ajouter documents"
                  layout="centered"
                  specialIcon={<DocumentsIcon />}
                />
                <ActionButton
                  label="Ajouter rendez-vous"
                  layout="centered"
                  specialIcon={<RendezVousIcon />}
                />
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="bg-white border-[0.8px] border-[#c2e0ef] rounded-[14px] p-[10px]">
            <div className="flex gap-[18px] items-center px-[3px]">
              {tabs.map((tab) => {
                const tabPath = tab.to.replace("$id", id);
                const isActive = location.pathname === tabPath;
                return (
                  <Link
                    key={tab.to}
                    to={tab.to}
                    params={{ id }}
                    className={cn(
                      "flex items-center gap-[6px] px-[10px] py-[5px] rounded-[14px] font-['Plus_Jakarta_Sans'] font-medium text-[12px] leading-[16px] transition-colors whitespace-nowrap",
                      isActive
                        ? "bg-[#f97316] text-white"
                        : "text-[#0f3460] hover:bg-[#f8fafc]"
                    )}
                  >
                    {tab.label}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Child Route Content */}
          <Outlet />

          <NouveauSuiviDialog
            mode={suiviDialogMode}
            onCreated={handleSuiviCreated}
            onOpenChange={(nextOpen) => {
              setIsNouveauSuiviOpen(nextOpen);
              if (!nextOpen) {
                setSuiviDialogMode("create");
                setSuiviDialogId(undefined);
                setSuiviDialogValues(undefined);
              }
            }}
            open={isNouveauSuiviOpen}
            patientId={id}
            suiviId={suiviDialogId}
            values={suiviDialogValues}
          />

          <NouvelleConsultationDialog
            examenId={consultationDialogId}
            mode={consultationDialogMode}
            onCreated={handleConsultationCreated}
            onOpenChange={(nextOpen) => {
              setIsNouvelleConsultationOpen(nextOpen);
              if (!nextOpen) {
                setConsultationDialogMode("create");
                setConsultationDialogId(undefined);
                setConsultationDialogValues(undefined);
              }
            }}
            open={isNouvelleConsultationOpen}
            patientId={id}
            values={consultationDialogValues}
          />
        </div>
      </div>
    </div>
  );
}

function SidebarItem({
  icon,
  label,
  active = false,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-[18px] h-[48px] px-[12px] py-[11px] rounded-[15px] w-[213px] shrink-0",
        active
          ? "bg-[rgba(118,187,221,0.4)] shadow-[0px_10px_3.9px_-4px_rgba(0,0,0,0.15)]"
          : ""
      )}
    >
      <div className={cn("size-5", active ? "text-white" : "text-white/70")}>
        {icon}
      </div>
      <span
        className={cn(
          "font-['Plus_Jakarta_Sans'] text-[14px] leading-[28px]",
          active ? "text-white font-medium" : "text-white/70 font-semibold"
        )}
      >
        {label}
      </span>
    </div>
  );
}

function PatientInfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-[8px]">
      <div className="text-[#265284] shrink-0">{icon}</div>
      <span className="font-['Plus_Jakarta_Sans'] text-[14px] leading-[20px] text-[rgba(100,116,139,0.9)] whitespace-nowrap">
        {label}
      </span>
      <span className="font-['Poppins'] text-[14px] leading-[20px] text-[#265284]">
        {value}
      </span>
    </div>
  );
}

function ActionButton({
  label,
  layout,
  specialIcon,
  onClick,
}: {
  label: string;
  layout: "suivi" | "centered";
  specialIcon: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "bg-[#c2e0ef] rounded-[10px] h-[45px] w-[195px] px-[16px] font-['Plus_Jakarta_Sans'] font-semibold text-[14px] leading-[16px] text-[#0f3460] hover:bg-[#b0d4e8] transition-colors",
        layout === "suivi"
          ? "flex items-center"
          : "flex items-center justify-center gap-[10px]"
      )}
      type="button"
    >
      {layout === "suivi" ? (
        <>
          <div className="flex items-center gap-[10px]">
            <Plus className="size-[14px] shrink-0" />
            <span>{label}</span>
          </div>
          <div className="ml-auto size-[14px] shrink-0">{specialIcon}</div>
        </>
      ) : (
        <>
          <Plus className="size-[14px] shrink-0" />
          <span>{label}</span>
          <div className="size-[14px] shrink-0">{specialIcon}</div>
        </>
      )}
    </button>
  );
}

function SuiviIcon() {
  return (
    <svg viewBox="0 0 14 14" fill="none" className="size-full text-[#0f3460]">
      <path
        d="M12.8333 4.08333L7.875 9.04167L4.95833 6.125L1.16667 9.91667"
        stroke="currentColor"
        strokeWidth="1.16667"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9.33333 4.08333H12.8333V7.58333"
        stroke="currentColor"
        strokeWidth="1.16667"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ConsultationIcon() {
  return (
    <svg viewBox="0 0 14 14" fill="none" className="size-full text-[#0f3460]">
      <path
        d="M8.75 1.16667H3.5C3.19058 1.16667 2.89383 1.28958 2.67504 1.50838C2.45625 1.72717 2.33333 2.02391 2.33333 2.33333V11.6667C2.33333 11.9761 2.45625 12.2728 2.67504 12.4916C2.89383 12.7104 3.19058 12.8333 3.5 12.8333H10.5C10.8094 12.8333 11.1062 12.7104 11.325 12.4916C11.5437 12.2728 11.6667 11.9761 11.6667 11.6667V4.08333L8.75 1.16667Z"
        stroke="currentColor"
        strokeWidth="1.16667"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8.16667 1.16667V3.5C8.16667 3.80942 8.28958 4.10617 8.50838 4.32496C8.72717 4.54375 9.02391 4.66667 9.33333 4.66667H11.6667"
        stroke="currentColor"
        strokeWidth="1.16667"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5.83333 5.25H4.66667"
        stroke="currentColor"
        strokeWidth="1.16667"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9.33333 7.58333H4.66667"
        stroke="currentColor"
        strokeWidth="1.16667"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9.33333 9.91667H4.66667"
        stroke="currentColor"
        strokeWidth="1.16667"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DocumentsIcon() {
  return (
    <svg viewBox="0 0 14 14" fill="none" className="size-full text-[#0f3460]">
      <path
        d="M3.5 8.16667L4.375 6.475C4.47013 6.28608 4.61482 6.12658 4.79361 6.01355C4.97239 5.90053 5.17854 5.83823 5.39 5.83333H11.6667M11.6667 5.83333C11.8449 5.83302 12.0208 5.87355 12.181 5.9518C12.3411 6.03005 12.4812 6.14395 12.5904 6.28476C12.6997 6.42556 12.7752 6.58953 12.8113 6.76407C12.8473 6.93862 12.8429 7.1191 12.7983 7.29167L11.9 10.7917C11.835 11.0434 11.6878 11.2662 11.4817 11.4248C11.2756 11.5833 11.0225 11.6684 10.7625 11.6667H2.33333C2.02391 11.6667 1.72717 11.5437 1.50838 11.325C1.28958 11.1062 1.16667 10.8094 1.16667 10.5V2.91667C1.16667 2.60725 1.28958 2.3105 1.50838 2.09171C1.72717 1.87292 2.02391 1.75 2.33333 1.75H4.60833C4.80345 1.74809 4.99593 1.79514 5.16816 1.88686C5.34038 1.97858 5.48686 2.11203 5.59417 2.275L6.06667 2.975C6.1729 3.13631 6.31751 3.26872 6.48754 3.36035C6.65757 3.45198 6.84769 3.49997 7.04083 3.5H10.5C10.8094 3.5 11.1062 3.62292 11.325 3.84171C11.5437 4.0605 11.6667 4.35725 11.6667 4.66667V5.83333Z"
        stroke="currentColor"
        strokeWidth="1.16667"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RendezVousIcon() {
  return (
    <svg viewBox="0 0 14 14" fill="none" className="size-full text-[#0f3460]">
      <path
        d="M4.66667 1.16667V3.5"
        stroke="currentColor"
        strokeWidth="1.16667"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9.33333 1.16667V3.5"
        stroke="currentColor"
        strokeWidth="1.16667"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12.25 7.58333V3.5C12.25 3.19058 12.1271 2.89383 11.9083 2.67504C11.6895 2.45625 11.3928 2.33333 11.0833 2.33333H2.91667C2.60725 2.33333 2.3105 2.45625 2.09171 2.67504C1.87292 2.89383 1.75 3.19058 1.75 3.5V11.6667C1.75 11.9761 1.87292 12.2728 2.09171 12.4916C2.3105 12.7104 2.60725 12.8333 2.91667 12.8333H7.58333"
        stroke="currentColor"
        strokeWidth="1.16667"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M1.75 5.83333H12.25"
        stroke="currentColor"
        strokeWidth="1.16667"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9.33333 11.0833H12.8333"
        stroke="currentColor"
        strokeWidth="1.16667"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M11.0833 9.33333V12.8333"
        stroke="currentColor"
        strokeWidth="1.16667"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
