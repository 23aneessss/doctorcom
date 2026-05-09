import type { AppRouter } from "@doctor.com/api/routers/index";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import type { inferRouterOutputs } from "@trpc/server";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  CalendarDays,
  CircleX,
  Clock3,
  FileText,
  Pill,
  Plus,
  RefreshCw,
  Sparkles,
  TrendingUp,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";

import headerTexture from "@/assets/figma/patients/fc145d0d9403ead31e8bc198dd8335751de59305.svg";
import type { AgendaEvent, AgendaSlotStatus } from "@/components/agenda/types";
import Sidebar from "@/components/sidebar";
import patientsStyles from "@/components/patients/patients-page.module.css";
import { authClient } from "@/lib/auth-client";
import { requireSession } from "@/lib/require-session";
import { AjouterRdvDialog } from "./agenda/popups/ajouter-rdv";
import { ModifierRdvDialog } from "./agenda/popups/modifier-rdv";
import {
  getInitialsFromName,
  type RdvFormValues,
  type RdvPatientOption,
} from "./agenda/popups/rdv-dialog-shared";
import { VoirRdvDialog } from "./agenda/popups/voir-rdv";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type PatientRecord = RouterOutputs["patient"]["searchPatients"][number];
type MobileAgendaSlot = RouterOutputs["agenda"]["getSlots"][number];

export const Route = createFileRoute("/dashboard")({
  component: RouteComponent,
  beforeLoad: async () => {
    const session = await requireSession();
    return { session };
  },
});

type DashboardOverview = {
  metrics: {
    todayAppointments: number;
    totalPatients: number;
    newPatients: number;
    cancelledAppointments: number;
  };
  patientTrend: Array<{ label: string; value: number; isoDate?: string }>;
  topMedications: Array<{ name: string; count: number }>;
  rdvTypes: Array<{ label: string; value: number }>;
  upcomingAppointments: Array<{
    id: string;
    patientLabel: string;
    time: string;
    date: string;
    status: string;
    type: string;
    patientInitials: string;
  }>;
  calendarDays: Array<{
    day: string;
    weekday: string;
    isoDate: string;
    isActive: boolean;
  }>;
};

const EMPTY_OVERVIEW: DashboardOverview = {
  metrics: {
    todayAppointments: 0,
    totalPatients: 0,
    newPatients: 0,
    cancelledAppointments: 0,
  },
  patientTrend: [],
  topMedications: [],
  rdvTypes: [],
  upcomingAppointments: [],
  calendarDays: [],
};

function RouteComponent() {
  const { session, trpc } = Route.useRouteContext();
  const { data: liveSession } = authClient.useSession();
  const sessionUser = liveSession?.user ?? session?.data?.user;
  const sidebarUser =
    sessionUser && typeof sessionUser.email === "string"
      ? {
          name: sessionUser.name?.trim() || sessionUser.email,
          email: sessionUser.email,
          avatarUrl: sessionUser.image ?? undefined,
        }
      : undefined;
  const displayName = sessionUser?.name?.trim() || "";

  const overviewQuery = useQuery(
    trpc.dashboard.getOverview.queryOptions(undefined, {
      staleTime: 60_000,
      retry: false,
    }),
  );
  const patientsQuery = useQuery(trpc.patient.searchPatients.queryOptions({}));
  const createSlotMutation = useMutation(trpc.agenda.createSlot.mutationOptions());
  const updateSlotMutation = useMutation(trpc.agenda.updateSlot.mutationOptions());
  const deleteSlotMutation = useMutation(trpc.agenda.deleteSlot.mutationOptions());
  const createPatientMutation = useMutation(trpc.patient.createPatient.mutationOptions());
  const overview = (overviewQuery.data ?? EMPTY_OVERVIEW) as DashboardOverview;
  const isLoading = overviewQuery.isLoading;
  const isError = overviewQuery.isError;
  const fallbackSelectedDate =
    overview.calendarDays.find((day) => day.isActive)?.isoDate ??
    overview.calendarDays[0]?.isoDate ??
    formatDateForApi(new Date());
  const [selectedAppointmentDate, setSelectedAppointmentDate] = useState<string | null>(null);
  const [isAddRdvOpen, setIsAddRdvOpen] = useState(false);
  const [selectedDashboardAppointment, setSelectedDashboardAppointment] =
    useState<AgendaEvent | null>(null);
  const [activeRdvDialog, setActiveRdvDialog] = useState<"view" | "edit" | null>(null);
  const activeAppointmentDate = selectedAppointmentDate ?? fallbackSelectedDate;
  const filteredAppointments = useMemo(
    () =>
      overview.upcomingAppointments
        .filter((appointment) => appointment.date === activeAppointmentDate)
        .sort((first, second) => first.time.localeCompare(second.time)),
    [activeAppointmentDate, overview.upcomingAppointments],
  );
  const patientOptions = useMemo(
    () => (patientsQuery.data ?? []).map((patient) => mapPatientToOption(patient)),
    [patientsQuery.data],
  );

  const handleCreateRdv = async (values: RdvFormValues) => {
    try {
      let nextValues = values;

      if (!values.patientId) {
        const patientName = values.patientName.trim();
        const existingPatient = patientOptions.find(
          (patient) => patient.label.toLowerCase() === patientName.toLowerCase(),
        );

        if (existingPatient) {
          nextValues = {
            ...values,
            patientId: existingPatient.id,
            patientName: existingPatient.label,
            patientInitials: existingPatient.initials,
          };
        } else {
          const { nom, prenom } = splitPatientName(patientName);
          const createdPatient = await createPatientMutation.mutateAsync({
            patient: {
              nom,
              prenom,
              matricule: buildPatientMatricule(patientName, (patientsQuery.data?.length ?? 0) + 1),
              date_naissance: "1970-01-01",
            },
          });

          nextValues = {
            ...values,
            patientId: createdPatient.id,
            patientName: getPatientLabel(createdPatient),
            patientInitials: getPatientInitials(createdPatient),
          };

          await patientsQuery.refetch();
        }
      }

      await createSlotMutation.mutateAsync(toSlotPayload(nextValues));
      setSelectedAppointmentDate(nextValues.date);
      await overviewQuery.refetch();
      toast.success("Rendez-vous ajouté avec succès.");
      return true;
    } catch (error) {
      toast.error(getErrorMessage(error, "Impossible d'ajouter le rendez-vous."));
      return false;
    }
  };

  const handleOpenDashboardAppointment = (
    appointment: DashboardOverview["upcomingAppointments"][number],
  ) => {
    setSelectedDashboardAppointment(mapDashboardAppointmentToAgendaEvent(appointment));
    setActiveRdvDialog("view");
  };

  const handleEditDashboardAppointment = (appointment: AgendaEvent) => {
    setSelectedDashboardAppointment(appointment);
    setActiveRdvDialog("edit");
  };

  const handleUpdateDashboardAppointment = async (
    appointmentId: string,
    values: RdvFormValues,
  ) => {
    try {
      const updatedSlot = await updateSlotMutation.mutateAsync({
        id: appointmentId,
        ...toSlotPayload(values),
      });
      const updatedEvent = mapAgendaSlotToEvent(updatedSlot);

      setSelectedDashboardAppointment(updatedEvent);
      setSelectedAppointmentDate(updatedEvent.date);
      await overviewQuery.refetch();
      toast.success("Rendez-vous modifié avec succès.");
      return true;
    } catch (error) {
      toast.error(getErrorMessage(error, "Impossible de modifier le rendez-vous."));
      return false;
    }
  };

  const handleDeleteDashboardAppointment = async (appointment: AgendaEvent) => {
    try {
      await deleteSlotMutation.mutateAsync({ id: appointment.id });
      setSelectedDashboardAppointment(null);
      await overviewQuery.refetch();
      toast.success("Rendez-vous supprimé avec succès.");
      return true;
    } catch (error) {
      toast.error(getErrorMessage(error, "Impossible de supprimer le rendez-vous."));
      return false;
    }
  };

  return (
    <div className={patientsStyles.pageShell}>
      <Sidebar currentUser={sidebarUser} />

      <main className={patientsStyles.pageMain}>
        <div className={patientsStyles.pageContent}>
          <DashboardHero
            displayName={displayName}
            onCreateAppointment={() => setIsAddRdvOpen(true)}
          />

          {isError ? (
            <DashboardErrorPanel
              message={getErrorMessage(
                overviewQuery.error,
                "Impossible de charger les données du tableau de bord.",
              )}
              onRetry={() => {
                void overviewQuery.refetch();
              }}
            />
          ) : null}

          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              icon={CalendarDays}
              label="Rendez-vous aujourd'hui"
              loading={isLoading}
              value={overview.metrics.todayAppointments}
            />
            <KpiCard
              icon={Users}
              label="Patients suivis"
              loading={isLoading}
              value={overview.metrics.totalPatients}
            />
            <KpiCard
              icon={UserPlus}
              label="Nouveaux patients"
              loading={isLoading}
              value={overview.metrics.newPatients}
            />
            <KpiCard
              icon={CircleX}
              label="RDV annulés"
              loading={isLoading}
              value={overview.metrics.cancelledAppointments}
            />
          </section>

          <section className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(22rem,0.85fr)]">
            <DashboardPanel className="min-h-[24rem]">
              <PanelHeader
                eyebrow="Vue d'ensemble"
                icon={TrendingUp}
                title="Évolution des patients"
              />
              <PatientTrendChart bars={overview.patientTrend} loading={isLoading} />
            </DashboardPanel>

            <DashboardPanel className="min-h-[24rem]">
              <PanelHeader
                eyebrow={formatMonthLabel(new Date())}
                icon={Clock3}
                title="Rendez-vous à venir"
              />
              <UpcomingAppointments
                appointments={filteredAppointments}
                calendarDays={overview.calendarDays}
                selectedDate={activeAppointmentDate}
                onSelectDate={setSelectedAppointmentDate}
                onOpenAppointment={handleOpenDashboardAppointment}
                loading={isLoading}
              />
            </DashboardPanel>
          </section>

          <section className="grid gap-4 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
            <DashboardPanel>
              <PanelHeader
                eyebrow="Prescription"
                icon={Pill}
                title="Médicaments les plus prescrits"
              />
              <MedicationRanking
                loading={isLoading}
                medications={overview.topMedications}
              />
            </DashboardPanel>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
              <DashboardPanel>
                <PanelHeader
                  eyebrow="Consultations"
                  icon={Activity}
                  title="Répartition des RDV"
                />
                <RdvTypeBreakdown data={overview.rdvTypes} loading={isLoading} />
              </DashboardPanel>

              <DashboardPanel>
                <PanelHeader eyebrow="Accès rapide" icon={Sparkles} title="Actions du jour" />
                <QuickActions onAddAppointment={() => setIsAddRdvOpen(true)} />
              </DashboardPanel>
            </div>
          </section>
        </div>
      </main>

      <AjouterRdvDialog
        open={isAddRdvOpen}
        onOpenChange={setIsAddRdvOpen}
        defaultDate={activeAppointmentDate}
        onCreate={handleCreateRdv}
        patientOptions={patientOptions}
        isSubmitting={createSlotMutation.isPending || createPatientMutation.isPending}
      />

      <VoirRdvDialog
        open={activeRdvDialog === "view"}
        onOpenChange={(open) => {
          setActiveRdvDialog(open ? "view" : null);
          if (!open) {
            setSelectedDashboardAppointment(null);
          }
        }}
        appointment={selectedDashboardAppointment}
        onEdit={handleEditDashboardAppointment}
        onDelete={handleDeleteDashboardAppointment}
        isDeleting={deleteSlotMutation.isPending}
      />

      <ModifierRdvDialog
        open={activeRdvDialog === "edit"}
        onOpenChange={(open) => {
          setActiveRdvDialog(open ? "edit" : null);
          if (!open) {
            setSelectedDashboardAppointment(null);
          }
        }}
        appointment={selectedDashboardAppointment}
        onUpdate={handleUpdateDashboardAppointment}
        isSubmitting={updateSlotMutation.isPending}
      />
    </div>
  );
}

function DashboardHero({
  displayName,
  onCreateAppointment,
}: {
  displayName: string;
  onCreateAppointment: () => void;
}) {
  const heroStyle = {
    "--patients-hero-texture": `url(${headerTexture})`,
  } as React.CSSProperties;

  return (
    <section
      aria-labelledby="dashboard-page-title"
      className={patientsStyles.hero}
      style={heroStyle}
    >
      <div className={patientsStyles.heroInner}>
        <div className={patientsStyles.heroText}>
          <h1 className={patientsStyles.heroTitle} id="dashboard-page-title">
            Tableau de bord
          </h1>
          <p className={patientsStyles.heroSubtitle}>
            Bonjour {formatDoctorName(displayName)}, pilotez votre journée clinique en un coup d'oeil
          </p>
        </div>

        <button
          className="inline-flex h-[2.625rem] min-w-[13.5rem] items-center justify-center gap-2 rounded-[0.875rem] bg-[#052ca0] px-6 font-['Plus_Jakarta_Sans'] text-[1rem] font-semibold tracking-[-0.01em] text-white shadow-[0px_4px_12px_rgba(5,44,160,0.38)] transition hover:-translate-y-px hover:bg-[#0a3ac7] hover:shadow-[0px_8px_20px_rgba(5,44,160,0.44)]"
          onClick={onCreateAppointment}
          type="button"
        >
          <Plus className="size-5" />
          Nouveau rendez-vous
        </button>
      </div>
    </section>
  );
}

function KpiCard({
  icon: Icon,
  label,
  loading,
  value,
}: {
  icon: LucideIcon;
  label: string;
  loading: boolean;
  value: number;
}) {
  return (
    <article className="group rounded-[18px] border border-[#c2e0ef] bg-white p-4 shadow-[0_10px_28px_-24px_rgba(15,52,96,0.45)] transition hover:-translate-y-0.5 hover:border-[#76bbdd] hover:shadow-[0_18px_34px_-24px_rgba(15,52,96,0.5)]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-['Plus_Jakarta_Sans'] text-[13px] font-semibold text-[#5d7285]">
            {label}
          </p>
          <p className="mt-3 font-['Plus_Jakarta_Sans'] text-[32px] font-bold leading-none text-[#0f3460]">
            {loading ? "..." : formatNumber(value)}
          </p>
        </div>
        <span className="flex size-11 shrink-0 items-center justify-center rounded-[14px] border border-[#c2e0ef] bg-[#edf8fd] text-[#0f3460]">
          <Icon className="size-5" strokeWidth={2} />
        </span>
      </div>
    </article>
  );
}

function DashboardPanel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-[18px] border border-[#c2e0ef] bg-white p-5 shadow-[0_10px_30px_-26px_rgba(15,52,96,0.45)] ${className}`}
    >
      {children}
    </section>
  );
}

function PanelHeader({
  eyebrow,
  icon: Icon,
  title,
}: {
  eyebrow: string;
  icon: LucideIcon;
  title: string;
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <div>
        <p className="font-['Plus_Jakarta_Sans'] text-[11px] font-bold uppercase tracking-[0.16em] text-[#7a93af]">
          {eyebrow}
        </p>
        <h2 className="mt-1 font-['Plus_Jakarta_Sans'] text-[20px] font-bold leading-7 text-[#0f3460]">
          {title}
        </h2>
      </div>
      <span className="flex size-10 items-center justify-center rounded-[13px] bg-[#eef7fc] text-[#265284]">
        <Icon className="size-5" />
      </span>
    </div>
  );
}

const MONTH_LABELS_FR = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Aoû", "Sep", "Oct", "Nov", "Déc"];

function PatientTrendChart({
  bars,
  loading,
}: {
  bars: DashboardOverview["patientTrend"];
  loading: boolean;
}) {
  if (loading) {
    return <ChartLoadingState />;
  }

  const data = bars.slice(-18);

  if (data.length === 0) {
    return <EmptyPanel text="Aucune donnée patient disponible" />;
  }

  const max = Math.max(1, ...data.map((bar) => bar.value));
  const total = data.reduce((sum, bar) => sum + bar.value, 0);
  const allZero = total === 0;

  const rangeLabel = (() => {
    const first = data[0]?.isoDate;
    const last = data[data.length - 1]?.isoDate;
    if (!first || !last) return null;
    const fmt = (iso: string) => {
      const d = new Date(iso + "T00:00:00");
      return `${d.getDate()} ${MONTH_LABELS_FR[d.getMonth()] ?? ""}`;
    };
    return `${fmt(first)} – ${fmt(last)}`;
  })();

  return (
    <div className="relative min-h-[18rem] overflow-hidden rounded-[16px] border border-[#e3f3fb] bg-[linear-gradient(180deg,#f8fcff_0%,#ffffff_100%)] px-5 pb-5 pt-6">
      {/* Y-axis gridlines */}
      <div className="pointer-events-none absolute inset-x-5 top-8 grid h-[13rem] grid-rows-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <span key={index} className="border-t border-dashed border-[#dbeef7]" />
        ))}
      </div>

      {/* Empty state overlay */}
      {allZero && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 pb-8">
          <span className="font-['Plus_Jakarta_Sans'] text-[13px] font-semibold text-[#7a93af]">
            Aucune nouvelle admission
          </span>
          <span className="font-['Inter'] text-[11px] text-[#a8bfce]">sur les 18 derniers jours</span>
        </div>
      )}

      {/* Bars */}
      <div className="relative flex h-[13rem] items-end gap-2">
        {data.map((bar, index) => {
          const valueHeight = Math.max(
            bar.value > 0 ? 14 : 3,
            Math.round((bar.value / max) * 178),
          );

          const prevIso = index > 0 ? data[index - 1]?.isoDate : undefined;
          const currIso = bar.isoDate;
          const isMonthStart =
            currIso && prevIso
              ? new Date(currIso + "T00:00:00").getMonth() !== new Date(prevIso + "T00:00:00").getMonth()
              : false;
          const monthName = isMonthStart && currIso
            ? MONTH_LABELS_FR[new Date(currIso + "T00:00:00").getMonth()]
            : null;

          return (
            <div className="flex min-w-0 flex-1 flex-col items-center gap-2" key={`${bar.label}-${index}`}>
              <div className="relative flex h-[11.25rem] w-full flex-col items-center justify-end">
                {monthName && (
                  <span className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 font-['Inter'] text-[8px] font-bold uppercase tracking-wide text-[#052ca0] opacity-60">
                    {monthName}
                  </span>
                )}
                <span
                  className="relative z-10 w-[42%] rounded-t-full shadow-[0_8px_18px_-14px_rgba(5,44,160,0.65)]"
                  style={{
                    height: valueHeight,
                    background: bar.value > 0
                      ? "linear-gradient(180deg,#76bbdd 0%,#052ca0 100%)"
                      : "#e3f3fb",
                  }}
                  title={bar.isoDate ? `${bar.isoDate}: ${bar.value} patient${bar.value > 1 ? "s" : ""}` : `${bar.value}`}
                />
              </div>
              <span className="font-['Inter'] text-[10px] font-medium text-[#7a93af]">
                {bar.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#edf6fb] pt-4 font-['Inter'] text-[12px] text-[#5d7285]">
        <LegendDot color="#052ca0" label={`${total} nouveau${total > 1 ? "x" : ""} patient${total > 1 ? "s" : ""}`} />
        {rangeLabel && (
          <span className="text-[11px] text-[#a8bfce]">{rangeLabel}</span>
        )}
      </div>
    </div>
  );
}

function ChartLoadingState() {
  return (
    <div className="relative min-h-[18rem] overflow-hidden rounded-[16px] border border-[#e3f3fb] bg-[linear-gradient(180deg,#f8fcff_0%,#ffffff_100%)] px-5 pb-5 pt-6">
      <div className="pointer-events-none absolute inset-x-5 top-8 grid h-[13rem] grid-rows-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <span key={index} className="border-t border-dashed border-[#dbeef7]" />
        ))}
      </div>
      <div className="relative flex h-[13rem] items-end gap-2">
        {Array.from({ length: 18 }).map((_, index) => (
          <div className="flex min-w-0 flex-1 flex-col items-center gap-2" key={index}>
            <span
              className="w-[42%] animate-pulse rounded-t-full bg-[#dceef8]"
              style={{ height: 24 + ((index * 17) % 92) }}
            />
            <span className="h-2 w-4 rounded-full bg-[#e8f4fa]" />
          </div>
        ))}
      </div>
      <div className="mt-5 flex items-center justify-between border-t border-[#edf6fb] pt-4">
        <span className="h-3 w-32 animate-pulse rounded-full bg-[#e8f4fa]" />
        <span className="h-3 w-20 animate-pulse rounded-full bg-[#e8f4fa]" />
      </div>
    </div>
  );
}

function DashboardErrorPanel({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <section className="flex flex-wrap items-center justify-between gap-3 rounded-[16px] border border-[#fed7aa] bg-[#fff7ed] px-4 py-3 text-[#9a3412]">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-[12px] bg-white text-[#f77a21]">
          <AlertCircle className="size-5" />
        </span>
        <p className="m-0 font-['Inter'] text-[13px] font-semibold leading-5">
          {message}
        </p>
      </div>
      <button
        className="inline-flex h-9 items-center justify-center gap-2 rounded-[11px] bg-[#f77a21] px-3 font-['Plus_Jakarta_Sans'] text-[12px] font-bold text-white shadow-[0_8px_18px_-14px_rgba(154,52,18,0.55)] transition hover:bg-[#ea6b13]"
        onClick={onRetry}
        type="button"
      >
        <RefreshCw className="size-3.5" />
        Réessayer
      </button>
    </section>
  );
}

function MedicationRanking({
  loading,
  medications,
}: {
  loading: boolean;
  medications: DashboardOverview["topMedications"];
}) {
  if (loading) {
    return <EmptyPanel text="Chargement des prescriptions..." />;
  }

  if (medications.length === 0) {
    return <EmptyPanel text="Aucune prescription récente" />;
  }

  const max = Math.max(1, ...medications.map((item) => item.count));

  return (
    <div className="grid gap-3">
      {medications.slice(0, 5).map((medication, index) => {
        const width = `${Math.max(12, Math.round((medication.count / max) * 100))}%`;
        return (
          <article
            className="rounded-[15px] border border-[#e1f0f8] bg-[#fbfdff] p-3"
            key={medication.name}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#e3f3fb] font-['Inter'] text-[12px] font-bold text-[#265284]">
                  {index + 1}
                </span>
                <p className="truncate font-['Plus_Jakarta_Sans'] text-[14px] font-semibold text-[#0f3460]">
                  {medication.name}
                </p>
              </div>
              <span className="font-['Inter'] text-[12px] font-semibold text-[#5d7285]">
                {medication.count} fois
              </span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#edf6fb]">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,#76bbdd_0%,#052ca0_100%)]"
                style={{ width }}
              />
            </div>
          </article>
        );
      })}
    </div>
  );
}

function RdvTypeBreakdown({
  data,
  loading,
}: {
  data: DashboardOverview["rdvTypes"];
  loading: boolean;
}) {
  if (loading) {
    return <EmptyPanel text="Analyse des rendez-vous..." />;
  }

  const colors = ["#052ca0", "#265284", "#76bbdd", "#9ed2ea"];
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const displayData =
    total > 0
      ? data.slice(0, 4)
      : [
          { label: "Consultation", value: 0 },
          { label: "Suivi", value: 0 },
          { label: "Contrôle", value: 0 },
        ];
  const displayTotal = Math.max(1, total);

  return (
    <div className="space-y-4">
      <div className="rounded-[16px] border border-[#e1f0f8] bg-[#fbfdff] p-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="font-['Inter'] text-[11px] font-bold uppercase tracking-[0.14em] text-[#7a93af]">
              Total analysé
            </p>
            <p className="mt-1 font-['Plus_Jakarta_Sans'] text-[28px] font-bold leading-none text-[#0f3460]">
              {total}
            </p>
          </div>
          <Activity className="size-9 text-[#76bbdd]" strokeWidth={1.8} />
        </div>
        <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-[#edf6fb]">
          {total > 0 ? (
            displayData.map((item, index) => (
              <span
                className="h-full"
                key={item.label}
                style={{
                  backgroundColor: colors[index] ?? "#052ca0",
                  width: `${Math.max(4, (item.value / displayTotal) * 100)}%`,
                }}
              />
            ))
          ) : (
            <span className="h-full w-full bg-[#dce9f2]" />
          )}
        </div>
      </div>

      <div className="grid gap-3">
        {displayData.map((item, index) => {
          const percent = total > 0 ? Math.round((item.value / displayTotal) * 100) : 0;
          return (
            <div className="grid gap-2" key={item.label}>
              <div className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate font-['Inter'] text-[12px] font-semibold text-[#0f3460]">
                  {item.label}
                </span>
                <span className="font-['Inter'] text-[12px] font-bold text-[#5d7285]">
                  {item.value} · {percent}%
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[#edf6fb]">
                <span
                  className="block h-full rounded-full"
                  style={{
                    backgroundColor: colors[index] ?? "#052ca0",
                    width: `${percent}%`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function UpcomingAppointments({
  appointments,
  calendarDays,
  selectedDate,
  onSelectDate,
  onOpenAppointment,
  loading,
}: {
  appointments: DashboardOverview["upcomingAppointments"];
  calendarDays: DashboardOverview["calendarDays"];
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onOpenAppointment: (appointment: DashboardOverview["upcomingAppointments"][number]) => void;
  loading: boolean;
}) {
  const days = calendarDays.length > 0 ? calendarDays : fallbackCalendarDays();

  return (
    <div className="flex h-full min-h-[17rem] flex-col">
      <div className="grid grid-cols-7 gap-2">
        {days.map((day) => {
          const isSelected = day.isoDate === selectedDate;

          return (
          <button
            type="button"
            onClick={() => onSelectDate(day.isoDate)}
            aria-pressed={isSelected}
            className={`flex h-14 flex-col items-center justify-center rounded-[14px] border font-['Inter'] transition ${
              isSelected
                ? "border-[#76bbdd] bg-[#0f3460] text-white shadow-[0_12px_20px_-18px_rgba(15,52,96,0.8)]"
                : "border-[#c2e0ef] bg-[#f8fcff] text-[#265284] hover:-translate-y-0.5 hover:border-[#76bbdd] hover:bg-[#edf8fd]"
            }`}
            key={day.isoDate}
          >
            <span className="text-[15px] font-bold leading-5">{day.day}</span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em]">
              {day.weekday}
            </span>
          </button>
          );
        })}
      </div>

      <div className="mt-4 grid gap-2">
        {loading ? (
          <EmptyPanel text="Chargement de l'agenda..." />
        ) : appointments.length > 0 ? (
          appointments.slice(0, 4).map((appointment) => (
            <AppointmentRow
              appointment={appointment}
              key={appointment.id}
              onOpen={onOpenAppointment}
            />
          ))
        ) : (
          <EmptyPanel text="Aucun rendez-vous pour cette journée" />
        )}
      </div>

    </div>
  );
}

function AppointmentRow({
  appointment,
  onOpen,
}: {
  appointment: DashboardOverview["upcomingAppointments"][number];
  onOpen: (appointment: DashboardOverview["upcomingAppointments"][number]) => void;
}) {
  return (
    <button
      className="group flex items-center gap-3 rounded-[15px] border border-[#e1f0f8] bg-[#fbfdff] p-3 transition hover:-translate-y-0.5 hover:border-[#76bbdd] hover:bg-[#f8fcff]"
      onClick={() => onOpen(appointment)}
      type="button"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#e3f3fb] font-['Inter'] text-[12px] font-bold text-[#265284]">
        {appointment.patientInitials}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-['Plus_Jakarta_Sans'] text-[13px] font-bold text-[#0f3460]">
          {appointment.patientLabel}
        </p>
        <p className="truncate font-['Inter'] text-[12px] font-medium text-[#7a93af]">
          {appointment.time} · {appointment.type}
        </p>
      </div>
      <span className="rounded-full border border-[#c2e0ef] bg-white px-2.5 py-1 font-['Inter'] text-[10px] font-bold uppercase tracking-[0.08em] text-[#265284]">
        {appointment.status}
      </span>
      <ArrowRight className="size-4 text-[#76bbdd] transition group-hover:translate-x-0.5 group-hover:text-[#052ca0]" />
    </button>
  );
}

function QuickActions({ onAddAppointment }: { onAddAppointment: () => void }) {
  return (
    <div className="grid gap-3">
      <QuickAction icon={CalendarDays} label="Ajouter un rendez-vous" onClick={onAddAppointment} />
      <QuickAction icon={Users} label="Consulter les patients" to="/patients" />
      <QuickAction icon={FileText} label="Créer une ordonnance" to="/ordonnance" />
    </div>
  );
}

function QuickAction({
  icon: Icon,
  label,
  onClick,
  to,
}: {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  to?: string;
}) {
  const className =
    "group flex min-h-[3.65rem] w-full items-center justify-between gap-3 rounded-[15px] border border-[#c2e0ef] bg-[#f8fcff] px-4 py-3 text-left transition hover:-translate-y-0.5 hover:border-[#76bbdd] hover:bg-[#edf8fd]";
  const content = (
    <>
      <span className="flex items-center gap-3">
        <span className="flex size-9 items-center justify-center rounded-[12px] bg-white text-[#265284] shadow-[0_8px_18px_-18px_rgba(15,52,96,0.5)]">
          <Icon className="size-4" />
        </span>
        <span className="font-['Plus_Jakarta_Sans'] text-[13px] font-bold text-[#0f3460]">
          {label}
        </span>
      </span>
      <ArrowRight className="size-4 text-[#76bbdd] transition group-hover:translate-x-0.5 group-hover:text-[#052ca0]" />
    </>
  );

  if (onClick) {
    return (
      <button className={className} onClick={onClick} type="button">
        {content}
      </button>
    );
  }

  return (
    <Link className={className} to={to ?? "/"}>
      {content}
    </Link>
  );
}

function EmptyPanel({ text }: { text: string }) {
  return (
    <div className="rounded-[15px] border border-dashed border-[#c2e0ef] bg-[#f8fcff] px-4 py-5 text-center font-['Inter'] text-[12px] font-medium text-[#7a93af]">
      {text}
    </div>
  );
}

function formatDateForApi(dateValue: Date) {
  const year = dateValue.getFullYear();
  const month = String(dateValue.getMonth() + 1).padStart(2, "0");
  const day = String(dateValue.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function normalizeTime(timeValue: string) {
  return timeValue.slice(0, 5);
}

function addMinutesToTime(timeValue: string, minutesToAdd: number) {
  const [hoursText = "0", minutesText = "0"] = normalizeTime(timeValue).split(":");
  const totalMinutes =
    (Number(hoursText) || 0) * 60 + (Number(minutesText) || 0) + minutesToAdd;
  const nextHours = Math.floor(totalMinutes / 60) % 24;
  const nextMinutes = totalMinutes % 60;

  return `${String(nextHours).padStart(2, "0")}:${String(nextMinutes).padStart(2, "0")}`;
}

function getDateParts(dateValue: string) {
  const [yearText = "2026", monthText = "1", dayText = "1"] = dateValue.split("-");
  const year = Number(yearText) || 2026;
  const month = Math.max(0, Math.min(11, (Number(monthText) || 1) - 1));
  const day = Math.max(1, Number(dayText) || 1);

  return { year, month, day };
}

function normalizeDashboardStatus(status: string): AgendaSlotStatus {
  const normalized = status
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (normalized.includes("annul") || normalized === "cancelled") {
    return "cancelled";
  }

  if (normalized.includes("termin") || normalized === "completed") {
    return "completed";
  }

  if (normalized.includes("plan") || normalized.includes("attente") || normalized === "pending") {
    return "pending";
  }

  if (normalized.includes("bloq") || normalized === "blocked") {
    return "blocked";
  }

  return "booked";
}

function mapDashboardAppointmentToAgendaEvent(
  appointment: DashboardOverview["upcomingAppointments"][number],
): AgendaEvent {
  const { year, month, day } = getDateParts(appointment.date);
  const startTime = normalizeTime(appointment.time);

  return {
    id: appointment.id,
    day,
    startTime,
    endTime: addMinutesToTime(startTime, 30),
    patientName: appointment.patientLabel.trim() || "Rendez-vous",
    patientInitials: appointment.patientInitials.trim() || getInitialsFromName(appointment.patientLabel),
    type: appointment.type.trim() || "Consultation",
    status: normalizeDashboardStatus(appointment.status),
    date: appointment.date,
    month,
    year,
  };
}

function mapAgendaSlotToEvent(slot: MobileAgendaSlot): AgendaEvent {
  const { year, month, day } = getDateParts(slot.date);
  const patientName = slot.patientLabel.trim() || "Rendez-vous";

  return {
    id: slot.id,
    day,
    startTime: normalizeTime(slot.startTime),
    endTime: normalizeTime(slot.endTime),
    patientName,
    patientInitials: slot.patientInitials.trim() || getInitialsFromName(patientName),
    type: slot.slotType.trim() || "Consultation",
    status: slot.status,
    date: slot.date,
    month,
    year,
    notes: slot.notes ?? undefined,
  };
}

function toSlotPayload(values: RdvFormValues) {
  const patientName = values.patientName.trim();

  return {
    date: values.date,
    startTime: normalizeTime(values.startTime),
    endTime: normalizeTime(values.endTime),
    status: values.status,
    slotType: values.type.trim(),
    patientLabel: patientName,
    patientInitials:
      values.patientInitials.trim() || getInitialsFromName(patientName),
    notes: values.notes.trim() || undefined,
  };
}

function getPatientInitials(patient: PatientRecord) {
  return `${patient.nom.trim().slice(0, 1)}${patient.prenom.trim().slice(0, 1)}`.toUpperCase() || "PT";
}

function getPatientLabel(patient: PatientRecord) {
  return [patient.nom, patient.prenom].filter(Boolean).join(" ").trim() || "Patient inconnu";
}

function mapPatientToOption(patient: PatientRecord): RdvPatientOption {
  return {
    id: patient.id,
    label: getPatientLabel(patient),
    initials: getPatientInitials(patient),
    matricule: patient.matricule,
  };
}

function splitPatientName(patientName: string) {
  const parts = patientName.trim().split(/\s+/).filter(Boolean);
  const [nom = "Patient", ...prenomParts] = parts;
  const prenom = prenomParts.join(" ") || "Agenda";

  return { nom, prenom };
}

function buildPatientMatricule(patientName: string, patientNumber: number) {
  const initials = getInitialsFromName(patientName)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 3)
    .toUpperCase() || "PT";
  const sequence = Math.max(1, patientNumber).toString().padStart(4, "0");

  return `${initials}-${new Date().getFullYear()}-${sequence}`;
}

function getErrorMessage(error: unknown, fallbackMessage: string) {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return fallbackMessage;
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="size-2 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

function fallbackCalendarDays() {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() + index);
    const labels = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
    return {
      day: date.getDate().toString(),
      weekday: labels[date.getDay()] ?? "",
      isoDate: date.toISOString().slice(0, 10),
      isActive: index === 0,
    };
  });
}

function formatDoctorName(value: string) {
  const clean = value.trim();
  if (/^dr\.?\s/i.test(clean)) return clean;
  return `Dr ${clean}`;
}

function formatMonthLabel(value: Date) {
  const label = value.toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("fr-FR").format(value);
}
