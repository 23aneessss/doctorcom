import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  ArrowRight,
  CalendarDays,
  CircleX,
  Clock3,
  FileText,
  Pill,
  Plus,
  Sparkles,
  TrendingUp,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import headerTexture from "@/assets/figma/patients/fc145d0d9403ead31e8bc198dd8335751de59305.svg";
import Sidebar from "@/components/sidebar";
import patientsStyles from "@/components/patients/patients-page.module.css";
import { requireSession } from "@/lib/require-session";

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
  patientTrend: Array<{ label: string; value: number; ghostValue: number }>;
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
  const sessionUser = session?.data?.user;
  const sidebarUser =
    sessionUser && typeof sessionUser.email === "string"
      ? {
          name: sessionUser.name?.trim() || sessionUser.email,
          email: sessionUser.email,
          avatarUrl: sessionUser.image ?? undefined,
        }
      : undefined;
  const displayName = sessionUser?.name?.trim() || "Dr Karim Benali";

  const overviewQuery = useQuery(
    trpc.dashboard.getOverview.queryOptions(undefined, {
      staleTime: 60_000,
      retry: false,
    }),
  );
  const overview = (overviewQuery.data ?? EMPTY_OVERVIEW) as DashboardOverview;
  const isLoading = overviewQuery.isLoading;

  return (
    <div className={patientsStyles.pageShell}>
      <Sidebar currentUser={sidebarUser} />

      <main className={patientsStyles.pageMain}>
        <div className={patientsStyles.pageContent}>
          <DashboardHero displayName={displayName} />

          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              accent="blue"
              icon={CalendarDays}
              label="Rendez-vous aujourd'hui"
              loading={isLoading}
              sublabel="Agenda clinique"
              value={overview.metrics.todayAppointments}
            />
            <KpiCard
              accent="sky"
              icon={Users}
              label="Patients suivis"
              loading={isLoading}
              sublabel="Dossiers actifs"
              value={overview.metrics.totalPatients}
            />
            <KpiCard
              accent="green"
              icon={UserPlus}
              label="Nouveaux patients"
              loading={isLoading}
              sublabel="Créés récemment"
              value={overview.metrics.newPatients}
            />
            <KpiCard
              accent="orange"
              icon={CircleX}
              label="RDV annulés"
              loading={isLoading}
              sublabel="À surveiller"
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
                appointments={overview.upcomingAppointments}
                calendarDays={overview.calendarDays}
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
                <PanelHeader eyebrow="Consultations" icon={Activity} title="Types de RDV" />
                <RdvTypeDonut data={overview.rdvTypes} loading={isLoading} />
              </DashboardPanel>

              <DashboardPanel>
                <PanelHeader eyebrow="Accès rapide" icon={Sparkles} title="Actions du jour" />
                <QuickActions />
              </DashboardPanel>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

function DashboardHero({ displayName }: { displayName: string }) {
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

        <Link
          className="inline-flex h-[2.625rem] min-w-[13.5rem] items-center justify-center gap-2 rounded-[0.875rem] bg-[#052ca0] px-6 font-['Plus_Jakarta_Sans'] text-[1rem] font-semibold tracking-[-0.01em] text-white shadow-[0px_4px_12px_rgba(5,44,160,0.38)] transition hover:-translate-y-px hover:bg-[#0a3ac7] hover:shadow-[0px_8px_20px_rgba(5,44,160,0.44)]"
          to="/agenda/ajouter"
        >
          <Plus className="size-5" />
          Nouveau rendez-vous
        </Link>
      </div>
    </section>
  );
}

function KpiCard({
  accent,
  icon: Icon,
  label,
  loading,
  sublabel,
  value,
}: {
  accent: "blue" | "green" | "orange" | "sky";
  icon: LucideIcon;
  label: string;
  loading: boolean;
  sublabel: string;
  value: number;
}) {
  const accentMap = {
    blue: {
      bg: "bg-[#eef6ff]",
      icon: "text-[#052ca0]",
      ring: "border-[#bfdcf5]",
    },
    green: {
      bg: "bg-[#ecfdf3]",
      icon: "text-[#16a34a]",
      ring: "border-[#bbf7d0]",
    },
    orange: {
      bg: "bg-[#fff7ed]",
      icon: "text-[#f97316]",
      ring: "border-[#fed7aa]",
    },
    sky: {
      bg: "bg-[#edf8fd]",
      icon: "text-[#2f7fa8]",
      ring: "border-[#c2e0ef]",
    },
  }[accent];

  return (
    <article className="group relative overflow-hidden rounded-[18px] border border-[#c2e0ef] bg-white p-4 shadow-[0_10px_28px_-24px_rgba(15,52,96,0.45)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_34px_-24px_rgba(15,52,96,0.5)]">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#76bbdd] via-[#052ca0] to-[#f77a21] opacity-60" />
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-['Plus_Jakarta_Sans'] text-[13px] font-semibold text-[#5d7285]">
            {label}
          </p>
          <p className="mt-2 font-['Plus_Jakarta_Sans'] text-[30px] font-bold leading-none text-[#0f3460]">
            {loading ? "..." : formatNumber(value)}
          </p>
          <p className="mt-2 font-['Inter'] text-[12px] font-medium text-[#7a93af]">
            {sublabel}
          </p>
        </div>
        <span
          className={`flex size-11 shrink-0 items-center justify-center rounded-[14px] border ${accentMap.ring} ${accentMap.bg}`}
        >
          <Icon className={`size-5 ${accentMap.icon}`} strokeWidth={2} />
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

function PatientTrendChart({
  bars,
  loading,
}: {
  bars: DashboardOverview["patientTrend"];
  loading: boolean;
}) {
  const data =
    bars.length > 0
      ? bars.slice(-18)
      : Array.from({ length: 18 }, (_, index) => ({
          label: String(index + 1).padStart(2, "0"),
          value: 0,
          ghostValue: 0,
        }));
  const max = Math.max(
    1,
    ...data.map((bar) => Math.max(bar.value, bar.ghostValue)),
  );

  return (
    <div className="relative min-h-[18rem] overflow-hidden rounded-[16px] border border-[#e3f3fb] bg-[linear-gradient(180deg,#f8fcff_0%,#ffffff_100%)] px-5 pb-5 pt-6">
      <div className="pointer-events-none absolute inset-x-5 top-8 grid h-[13rem] grid-rows-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <span key={index} className="border-t border-dashed border-[#dbeef7]" />
        ))}
      </div>
      <div className="relative flex h-[13rem] items-end gap-2">
        {data.map((bar) => {
          const ghostHeight = Math.max(10, Math.round((bar.ghostValue / max) * 178));
          const valueHeight = Math.max(bar.value > 0 ? 14 : 4, Math.round((bar.value / max) * 178));

          return (
            <div className="flex min-w-0 flex-1 flex-col items-center gap-2" key={bar.label}>
              <div className="relative flex h-[11.25rem] w-full items-end justify-center">
                <span
                  className="absolute bottom-0 w-[42%] rounded-t-full bg-[#dce9f2]"
                  style={{ height: ghostHeight }}
                />
                <span
                  className="relative z-10 w-[42%] rounded-t-full bg-[linear-gradient(180deg,#76bbdd_0%,#052ca0_100%)] shadow-[0_8px_18px_-14px_rgba(5,44,160,0.65)]"
                  style={{ height: loading ? 28 : valueHeight }}
                />
              </div>
              <span className="font-['Inter'] text-[10px] font-medium text-[#7a93af]">
                {bar.label}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-[#edf6fb] pt-4 font-['Inter'] text-[12px] text-[#5d7285]">
        <LegendDot color="#052ca0" label="Patients enregistrés" />
        <LegendDot color="#dce9f2" label="Projection / historique" />
      </div>
    </div>
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

function RdvTypeDonut({
  data,
  loading,
}: {
  data: DashboardOverview["rdvTypes"];
  loading: boolean;
}) {
  if (loading) {
    return <EmptyPanel text="Analyse des rendez-vous..." />;
  }

  const colors = ["#052ca0", "#76bbdd", "#f77a21", "#16a34a"];
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const displayData =
    total > 0
      ? data.slice(0, 4)
      : [
          { label: "Consultation", value: 0 },
          { label: "Suivi", value: 0 },
          { label: "Contrôle", value: 0 },
        ];
  const displayTotal = Math.max(
    1,
    displayData.reduce((sum, item) => sum + item.value, 0),
  );
  let cursor = 0;
  const gradient =
    total > 0
      ? displayData
          .map((item, index) => {
            const start = cursor;
            const end = cursor + (item.value / displayTotal) * 100;
            cursor = end;
            return `${colors[index] ?? "#052ca0"} ${start}% ${end}%`;
          })
          .join(", ")
      : "#e8f3fb 0% 100%";

  return (
    <div className="grid items-center gap-4 sm:grid-cols-[9rem_1fr]">
      <div
        className="relative mx-auto flex size-32 items-center justify-center rounded-full"
        style={{ backgroundImage: `conic-gradient(${gradient})` }}
      >
        <div className="flex size-20 flex-col items-center justify-center rounded-full bg-white shadow-inner">
          <span className="font-['Plus_Jakarta_Sans'] text-[22px] font-bold text-[#0f3460]">
            {total}
          </span>
          <span className="font-['Inter'] text-[10px] font-semibold uppercase tracking-[0.12em] text-[#7a93af]">
            total
          </span>
        </div>
      </div>
      <div className="grid gap-2">
        {displayData.map((item, index) => {
          const percent = total > 0 ? Math.round((item.value / displayTotal) * 100) : 0;
          return (
            <div className="flex items-center gap-3" key={item.label}>
              <span
                className="size-2.5 rounded-full"
                style={{ backgroundColor: colors[index] ?? "#052ca0" }}
              />
              <span className="min-w-0 flex-1 truncate font-['Inter'] text-[12px] font-medium text-[#0f3460]">
                {item.label}
              </span>
              <span className="font-['Inter'] text-[12px] font-semibold text-[#7a93af]">
                {percent}%
              </span>
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
  loading,
}: {
  appointments: DashboardOverview["upcomingAppointments"];
  calendarDays: DashboardOverview["calendarDays"];
  loading: boolean;
}) {
  const days = calendarDays.length > 0 ? calendarDays : fallbackCalendarDays();

  return (
    <div className="flex h-full min-h-[17rem] flex-col">
      <div className="grid grid-cols-7 gap-2">
        {days.map((day) => (
          <div
            className={`flex h-14 flex-col items-center justify-center rounded-[14px] border font-['Inter'] transition ${
              day.isActive
                ? "border-[#76bbdd] bg-[#0f3460] text-white shadow-[0_12px_20px_-18px_rgba(15,52,96,0.8)]"
                : "border-[#c2e0ef] bg-[#f8fcff] text-[#265284]"
            }`}
            key={day.isoDate}
          >
            <span className="text-[15px] font-bold leading-5">{day.day}</span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em]">
              {day.weekday}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-2">
        {loading ? (
          <EmptyPanel text="Chargement de l'agenda..." />
        ) : appointments.length > 0 ? (
          appointments.slice(0, 4).map((appointment) => (
            <AppointmentRow appointment={appointment} key={appointment.id} />
          ))
        ) : (
          <EmptyPanel text="Aucun rendez-vous à venir" />
        )}
      </div>

      <Link
        className="mt-auto inline-flex items-center justify-center gap-2 pt-4 font-['Plus_Jakarta_Sans'] text-[13px] font-bold text-[#052ca0] transition hover:text-[#0f3460]"
        to="/agenda"
      >
        Voir l'agenda complet
        <ArrowRight className="size-4" />
      </Link>
    </div>
  );
}

function AppointmentRow({
  appointment,
}: {
  appointment: DashboardOverview["upcomingAppointments"][number];
}) {
  return (
    <article className="flex items-center gap-3 rounded-[15px] border border-[#e1f0f8] bg-[#fbfdff] p-3">
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
    </article>
  );
}

function QuickActions() {
  return (
    <div className="grid gap-3">
      <QuickAction icon={CalendarDays} label="Ajouter un rendez-vous" to="/agenda/ajouter" />
      <QuickAction icon={Users} label="Consulter les patients" to="/patients" />
      <QuickAction icon={FileText} label="Créer une ordonnance" to="/ordonnance" />
    </div>
  );
}

function QuickAction({
  icon: Icon,
  label,
  to,
}: {
  icon: LucideIcon;
  label: string;
  to: string;
}) {
  return (
    <Link
      className="group flex min-h-[3.65rem] items-center justify-between gap-3 rounded-[15px] border border-[#c2e0ef] bg-[#f8fcff] px-4 py-3 transition hover:-translate-y-0.5 hover:border-[#76bbdd] hover:bg-[#edf8fd]"
      to={to}
    >
      <span className="flex items-center gap-3">
        <span className="flex size-9 items-center justify-center rounded-[12px] bg-white text-[#265284] shadow-[0_8px_18px_-18px_rgba(15,52,96,0.5)]">
          <Icon className="size-4" />
        </span>
        <span className="font-['Plus_Jakarta_Sans'] text-[13px] font-bold text-[#0f3460]">
          {label}
        </span>
      </span>
      <ArrowRight className="size-4 text-[#76bbdd] transition group-hover:translate-x-0.5 group-hover:text-[#052ca0]" />
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
