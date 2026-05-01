import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Bell,
  CalendarCheck,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock3,
  FileText,
  Plus,
  Search,
  ShieldCheck,
  Stethoscope,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import Sidebar from "@/components/sidebar";
import { requireSession } from "@/lib/require-session";

export const Route = createFileRoute("/dashboard")({
  component: RouteComponent,
  beforeLoad: async () => {
    const session = await requireSession();
    return { session };
  },
});

type AppointmentLike = {
  id: string;
  date: string;
  heure: string;
  heure_fin?: string | null;
  patient_label?: string | null;
  statut: string;
  type_creneau?: string | null;
};

type PatientLike = {
  id: string;
  nom: string;
  prenom: string;
  matricule?: string | null;
  assure?: boolean | null;
};

const WEEK_DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

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

  const patientsQuery = useQuery(
    trpc.patient.searchPatients.queryOptions(
      {},
      { staleTime: 60_000, retry: false },
    ),
  );
  const todayRdvQuery = useQuery(trpc.agenda.getRDVAujourdhui.queryOptions());
  const upcomingRdvQuery = useQuery(
    trpc.agenda.getProchainsRDV.queryOptions({ jours: 7 }),
  );

  const patients = (patientsQuery.data ?? []) as PatientLike[];
  const todayRdvs = (todayRdvQuery.data ?? []) as AppointmentLike[];
  const upcomingRdvs = (upcomingRdvQuery.data ?? []) as AppointmentLike[];
  const allVisibleRdvs = [...todayRdvs, ...upcomingRdvs];
  const confirmedToday = todayRdvs.filter((rdv) => rdv.statut === "confirme").length;
  const completedToday = todayRdvs.filter((rdv) => rdv.statut === "termine").length;
  const plannedToday = todayRdvs.filter((rdv) => rdv.statut === "planifie").length;
  const insuredPatients = patients.filter((patient) => patient.assure).length;
  const insuredRatio = patients.length > 0 ? Math.round((insuredPatients / patients.length) * 100) : 0;
  const completionRatio = todayRdvs.length > 0 ? Math.round((completedToday / todayRdvs.length) * 100) : 0;
  const nextAppointment = [...allVisibleRdvs]
    .filter((rdv) => rdv.statut !== "annule" && rdv.statut !== "termine")
    .sort(compareAppointments)[0];
  const activityBars = buildActivityBars(allVisibleRdvs);
  const statusCounts = countByStatus(allVisibleRdvs);
  const displayName = sessionUser?.name?.trim() || sessionUser?.email || "Docteur";

  return (
    <div className="flex h-svh bg-[#f8fafc]">
      <Sidebar currentUser={sidebarUser} />
      <main className="min-w-0 flex-1 overflow-auto">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-5 px-6 py-5">
          <DashboardTopbar displayName={displayName} />

          <section className="grid gap-5 xl:grid-cols-[1fr_340px]">
            <WelcomeCard
              completedToday={completedToday}
              displayName={displayName}
              nextAppointment={nextAppointment}
              todayCount={todayRdvs.length}
            />
            <NextRdvCard nextAppointment={nextAppointment} />
          </section>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              detail={`${insuredPatients} assures`}
              icon={Users}
              label="Total patients"
              tone="blue"
              value={patients.length}
            />
            <MetricCard
              detail={`${confirmedToday} confirmes`}
              icon={CalendarDays}
              label="RDV aujourd'hui"
              tone="cyan"
              value={todayRdvs.length}
            />
            <MetricCard
              detail={`${completionRatio}% de progression`}
              icon={CheckCircle2}
              label="RDV termines"
              tone="green"
              value={completedToday}
            />
            <MetricCard
              detail={`${insuredRatio}% des dossiers`}
              icon={ShieldCheck}
              label={"Assur\u00e9s"}
              tone="orange"
              value={insuredPatients}
            />
          </section>

          <section className="grid gap-5 xl:grid-cols-[1fr_386px]">
            <DashboardPanel
              action={<PanelLink to="/agenda">Voir agenda</PanelLink>}
              title="Activite des rendez-vous"
            >
              <div className="grid gap-5 lg:grid-cols-[1fr_190px]">
                <ActivityChart bars={activityBars} />
                <div className="grid gap-3">
                  <ProgressCard label="Journee terminee" value={completionRatio} />
                  <MiniStatusGrid
                    confirmed={confirmedToday}
                    planned={plannedToday}
                    completed={completedToday}
                  />
                </div>
              </div>
            </DashboardPanel>

            <DashboardPanel
              action={<PanelLink to="/agenda">Ouvrir</PanelLink>}
              title="Rendez-vous du jour"
            >
              <div className="flex min-h-[330px] flex-col gap-3">
                {todayRdvQuery.isLoading ? (
                  <DashboardEmpty text="Chargement des rendez-vous..." />
                ) : todayRdvs.length === 0 ? (
                  <DashboardEmpty text="Aucun rendez-vous aujourd'hui" />
                ) : (
                  [...todayRdvs].sort(compareAppointments).map((rdv) => (
                    <AppointmentRow key={rdv.id} rdv={rdv} />
                  ))
                )}
              </div>
            </DashboardPanel>
          </section>

          <section className="grid gap-5 xl:grid-cols-[0.92fr_1.08fr_0.85fr]">
            <DashboardPanel
              action={<PanelLink to="/patients">Voir tous</PanelLink>}
              title="Patients recents"
            >
              <div className="flex flex-col gap-3">
                {patientsQuery.isLoading ? (
                  <DashboardEmpty text="Chargement des patients..." />
                ) : patients.length === 0 ? (
                  <DashboardEmpty text="Aucun patient disponible" />
                ) : (
                  patients.slice(0, 6).map((patient) => (
                    <PatientRow key={patient.id} patient={patient} />
                  ))
                )}
              </div>
            </DashboardPanel>

            <DashboardPanel
              action={<PanelLink to="/agenda">Planifier</PanelLink>}
              title="Prochains rendez-vous"
            >
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                {upcomingRdvQuery.isLoading ? (
                  <DashboardEmpty text="Chargement des prochains RDV..." />
                ) : upcomingRdvs.length === 0 ? (
                  <DashboardEmpty text="Aucun rendez-vous programme" />
                ) : (
                  [...upcomingRdvs].sort(compareAppointments).slice(0, 6).map((rdv) => (
                    <UpcomingCard key={rdv.id} rdv={rdv} />
                  ))
                )}
              </div>
            </DashboardPanel>

            <DashboardPanel title="Synthese">
              <div className="grid gap-3">
                <SummaryBand
                  detail="RDV visibles"
                  icon={ClipboardList}
                  label="Total RDV"
                  value={allVisibleRdvs.length}
                />
                <SummaryBand
                  detail="API globale non exposee"
                  icon={Stethoscope}
                  label="Consultations"
                  value="--"
                />
                <SummaryBand
                  detail="Documents importes par patient"
                  icon={FileText}
                  label="Documents"
                  value="--"
                />
              </div>
              <StatusBreakdown counts={statusCounts} />
            </DashboardPanel>
          </section>
        </div>
      </main>
    </div>
  );
}

function DashboardTopbar({ displayName }: { displayName: string }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <p className="font-['Inter'] text-[13px] font-medium capitalize text-[#64748b]">
          {formatLongDate(new Date())}
        </p>
        <h1 className="mt-1 font-['Plus_Jakarta_Sans'] text-[28px] font-bold leading-tight text-[#0f3460]">
          Dashboard
        </h1>
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <div className="relative hidden h-11 w-[280px] items-center rounded-[14px] border border-[#c2e0ef] bg-white px-3 shadow-[0_2px_10px_rgba(15,52,96,0.04)] md:flex">
          <Search className="size-4 text-[#94a3b8]" />
          <input
            className="min-w-0 flex-1 bg-transparent px-3 font-['Inter'] text-[13px] text-[#0f3460] outline-none placeholder:text-[#94a3b8]"
            placeholder="Rechercher..."
            readOnly
          />
        </div>
        <button className="flex size-11 items-center justify-center rounded-[14px] border border-[#c2e0ef] bg-white text-[#265284] shadow-[0_2px_10px_rgba(15,52,96,0.04)]" type="button">
          <Bell className="size-5" />
        </button>
        <div className="flex h-11 items-center gap-3 rounded-[14px] border border-[#c2e0ef] bg-white px-3 shadow-[0_2px_10px_rgba(15,52,96,0.04)]">
          <span className="flex size-8 items-center justify-center rounded-full bg-[#c2e0ef] font-['Inter'] text-[12px] font-bold text-[#0f3460]">
            {getInitials(displayName)}
          </span>
          <span className="max-w-[150px] truncate font-['Inter'] text-[13px] font-semibold text-[#0f3460]">
            {displayName}
          </span>
        </div>
      </div>
    </header>
  );
}

function WelcomeCard({
  completedToday,
  displayName,
  nextAppointment,
  todayCount,
}: {
  completedToday: number;
  displayName: string;
  nextAppointment?: AppointmentLike;
  todayCount: number;
}) {
  return (
    <section className="relative overflow-hidden rounded-[18px] border border-[#c2e0ef] bg-[#0f3460] p-6 text-white shadow-[0_14px_34px_rgba(15,52,96,0.18)]">
      <div className="absolute right-[-80px] top-[-90px] size-56 rounded-full border border-white/15" />
      <div className="absolute bottom-[-90px] right-[80px] size-44 rounded-full border border-white/10" />
      <div className="relative z-10 grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="font-['Inter'] text-[13px] font-medium text-white/70">Bienvenue</p>
          <h2 className="mt-2 max-w-[620px] font-['Plus_Jakarta_Sans'] text-[30px] font-bold leading-tight">
            {displayName}
          </h2>
          <p className="mt-3 max-w-[620px] font-['Inter'] text-[14px] leading-6 text-white/74">
            Suivez les rendez-vous, les patients et l'activite clinique de la journee depuis une seule vue.
          </p>
        </div>
        <div className="grid min-w-[240px] gap-3 rounded-[16px] border border-white/18 bg-white/10 p-4 backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <span className="font-['Inter'] text-[12px] text-white/70">Aujourd'hui</span>
            <CalendarCheck className="size-5 text-[#76bbdd]" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <HeroStat label="RDV" value={todayCount} />
            <HeroStat label="Termines" value={completedToday} />
          </div>
          <p className="truncate font-['Inter'] text-[12px] text-white/70">
            Prochain: {nextAppointment ? `${nextAppointment.patient_label || "Patient"} a ${formatTime(nextAppointment.heure)}` : "aucun RDV"}
          </p>
        </div>
      </div>
    </section>
  );
}

function NextRdvCard({ nextAppointment }: { nextAppointment?: AppointmentLike }) {
  return (
    <section className="rounded-[18px] border border-[#c2e0ef] bg-white p-5 shadow-[0_8px_26px_rgba(15,52,96,0.06)]">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-['Inter'] text-[12px] font-semibold uppercase tracking-[0.03em] text-[#64748b]">
            Prochain RDV
          </p>
          <h3 className="mt-1 font-['Plus_Jakarta_Sans'] text-[18px] font-bold text-[#0f3460]">
            {nextAppointment ? formatShortDate(nextAppointment.date) : "Aucun"}
          </h3>
        </div>
        <div className="flex size-12 items-center justify-center rounded-[15px] bg-[#eaf3fb] text-[#265284]">
          <Clock3 className="size-5" />
        </div>
      </div>
      {nextAppointment ? (
        <div className="mt-5 rounded-[15px] border border-[#dbeaf3] bg-[#fbfdff] p-4">
          <p className="truncate font-['Plus_Jakarta_Sans'] text-[16px] font-bold text-[#0f3460]">
            {nextAppointment.patient_label || "Patient"}
          </p>
          <p className="mt-1 font-['Inter'] text-[13px] text-[#64748b]">
            {formatTime(nextAppointment.heure)}
            {nextAppointment.heure_fin ? ` - ${formatTime(nextAppointment.heure_fin)}` : ""} ·{" "}
            {nextAppointment.type_creneau ?? "consultation"}
          </p>
          <div className="mt-4 flex items-center justify-between gap-3">
            <StatusBadge status={nextAppointment.statut} />
            <Link className="inline-flex items-center gap-1 font-['Inter'] text-[12px] font-semibold text-[#052ca0]" to="/agenda">
              Ouvrir <ChevronRight className="size-3" />
            </Link>
          </div>
        </div>
      ) : (
        <DashboardEmpty text="Aucun rendez-vous a venir." />
      )}
    </section>
  );
}

function MetricCard({
  detail,
  icon: Icon,
  label,
  tone,
  value,
}: {
  detail: string;
  icon: LucideIcon;
  label: string;
  tone: "blue" | "cyan" | "green" | "orange";
  value: number;
}) {
  const toneClass = {
    blue: "bg-[#eaf3fb] text-[#052ca0]",
    cyan: "bg-[#e5f6fb] text-[#265284]",
    green: "bg-[#ecfdf3] text-[#008236]",
    orange: "bg-[#fff7ed] text-[#f97316]",
  }[tone];

  return (
    <article className="rounded-[18px] border border-[#c2e0ef] bg-white p-4 shadow-[0_8px_24px_rgba(15,52,96,0.05)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-['Inter'] text-[12px] font-semibold text-[#64748b]">{label}</p>
          <p className="mt-2 font-['Plus_Jakarta_Sans'] text-[30px] font-bold leading-none text-[#0f3460]">{value}</p>
        </div>
        <div className={`flex size-11 items-center justify-center rounded-[15px] ${toneClass}`}>
          <Icon className="size-5" />
        </div>
      </div>
      <p className="mt-4 font-['Inter'] text-[12px] text-[#64748b]">{detail}</p>
    </article>
  );
}

function DashboardPanel({
  action,
  children,
  title,
}: {
  action?: ReactNode;
  children: ReactNode;
  title: string;
}) {
  return (
    <section className="rounded-[18px] border border-[#c2e0ef] bg-white p-5 shadow-[0_8px_24px_rgba(15,52,96,0.05)]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-['Plus_Jakarta_Sans'] text-[17px] font-bold text-[#0f3460]">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function ActivityChart({ bars }: { bars: Array<{ label: string; value: number }> }) {
  const max = Math.max(1, ...bars.map((bar) => bar.value));
  return (
    <div className="rounded-[16px] border border-[#dbeaf3] bg-[#fbfdff] p-4">
      <div className="flex h-[250px] items-end justify-between gap-3">
        {bars.map((bar) => {
          const height = Math.max(10, Math.round((bar.value / max) * 210));
          return (
            <div className="flex min-w-0 flex-1 flex-col items-center gap-2" key={bar.label}>
              <span className="font-['Inter'] text-[11px] font-semibold text-[#64748b]">{bar.value}</span>
              <div className="flex h-[210px] w-full max-w-[44px] items-end rounded-full bg-[#eaf3fb]">
                <div
                  className="w-full rounded-full bg-[#76bbdd] shadow-[0_8px_16px_rgba(118,187,221,0.28)]"
                  style={{ height }}
                />
              </div>
              <span className="font-['Inter'] text-[11px] text-[#64748b]">{bar.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ProgressCard({ label, value }: { label: string; value: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="rounded-[16px] border border-[#dbeaf3] bg-[#fbfdff] p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="font-['Inter'] text-[12px] font-semibold text-[#64748b]">{label}</p>
        <p className="font-['Plus_Jakarta_Sans'] text-[22px] font-bold text-[#0f3460]">{clamped}%</p>
      </div>
      <div className="mt-4 h-2 rounded-full bg-[#eaf3fb]">
        <div className="h-full rounded-full bg-[#00a63e]" style={{ width: `${clamped}%` }} />
      </div>
    </div>
  );
}

function MiniStatusGrid({
  completed,
  confirmed,
  planned,
}: {
  completed: number;
  confirmed: number;
  planned: number;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <TinyStat label="Planifies" value={planned} />
      <TinyStat label="Confirmes" value={confirmed} />
      <TinyStat label="Termines" value={completed} />
    </div>
  );
}

function AppointmentRow({ rdv }: { rdv: AppointmentLike }) {
  return (
    <div className="grid gap-3 rounded-[15px] border border-[#dbeaf3] bg-[#fbfdff] px-4 py-3 md:grid-cols-[78px_1fr_auto] md:items-center">
      <div className="rounded-[13px] bg-white px-3 py-2 text-center shadow-[0_1px_4px_rgba(15,52,96,0.04)]">
        <p className="font-['Plus_Jakarta_Sans'] text-[15px] font-bold text-[#0f3460]">{formatTime(rdv.heure)}</p>
        <p className="font-['Inter'] text-[10px] text-[#64748b]">
          {rdv.heure_fin ? formatTime(rdv.heure_fin) : "Fin libre"}
        </p>
      </div>
      <div className="min-w-0">
        <p className="truncate font-['Inter'] text-[14px] font-semibold text-[#0f3460]">
          {rdv.patient_label || "Patient"}
        </p>
        <p className="mt-1 font-['Inter'] text-[12px] text-[#64748b]">
          {rdv.type_creneau ?? "consultation"}
        </p>
      </div>
      <StatusBadge status={rdv.statut} />
    </div>
  );
}

function UpcomingCard({ rdv }: { rdv: AppointmentLike }) {
  return (
    <div className="rounded-[15px] border border-[#dbeaf3] bg-[#fbfdff] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-['Inter'] text-[14px] font-semibold text-[#0f3460]">
            {rdv.patient_label || "Patient"}
          </p>
          <p className="mt-1 font-['Inter'] text-[12px] text-[#64748b]">
            {formatShortDate(rdv.date)} a {formatTime(rdv.heure)}
          </p>
        </div>
        <StatusBadge status={rdv.statut} />
      </div>
      <p className="mt-3 font-['Inter'] text-[12px] text-[#64748b]">
        {rdv.type_creneau ?? "consultation"}
      </p>
    </div>
  );
}

function PatientRow({ patient }: { patient: PatientLike }) {
  const label = `${patient.prenom} ${patient.nom}`.trim();
  return (
    <Link
      className="flex items-center justify-between gap-3 rounded-[15px] border border-[#dbeaf3] bg-[#fbfdff] px-3 py-3 transition hover:bg-white"
      params={{ id: patient.id }}
      to="/patients/$id/general"
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#eaf3fb] font-['Inter'] text-[12px] font-bold text-[#265284]">
          {getInitials(label)}
        </span>
        <div className="min-w-0">
          <p className="truncate font-['Inter'] text-[13px] font-semibold text-[#0f3460]">{label}</p>
          <p className="font-['Inter'] text-[11px] text-[#64748b]">{patient.matricule ?? "Sans matricule"}</p>
        </div>
      </div>
      <span className="shrink-0 rounded-full border border-[#c2e0ef] bg-white px-2.5 py-1 font-['Inter'] text-[11px] font-semibold text-[#265284]">
        {patient.assure ? "Assure" : "Non assure"}
      </span>
    </Link>
  );
}

function SummaryBand({
  detail,
  icon: Icon,
  label,
  value,
}: {
  detail: string;
  icon: LucideIcon;
  label: string;
  value: number | string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-[15px] border border-[#dbeaf3] bg-[#fbfdff] p-3">
      <div className="flex size-10 items-center justify-center rounded-[13px] bg-white text-[#265284] shadow-[0_1px_4px_rgba(15,52,96,0.05)]">
        <Icon className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-['Inter'] text-[12px] text-[#64748b]">{label}</p>
        <p className="font-['Inter'] text-[11px] text-[#94a3b8]">{detail}</p>
      </div>
      <p className="font-['Plus_Jakarta_Sans'] text-[20px] font-bold text-[#0f3460]">{value}</p>
    </div>
  );
}

function StatusBreakdown({ counts }: { counts: Record<string, number> }) {
  const items = [
    ["planifie", "Planifies"],
    ["confirme", "Confirmes"],
    ["termine", "Termines"],
    ["annule", "Annules"],
  ] as const;

  return (
    <div className="mt-4 rounded-[15px] border border-[#dbeaf3] bg-[#fbfdff] p-4">
      <p className="font-['Inter'] text-[12px] font-semibold uppercase tracking-[0.03em] text-[#64748b]">
        Statuts
      </p>
      <div className="mt-3 grid gap-2">
        {items.map(([key, label]) => (
          <div className="flex items-center justify-between gap-3" key={key}>
            <span className="font-['Inter'] text-[12px] text-[#64748b]">{label}</span>
            <span className="font-['Plus_Jakarta_Sans'] text-[15px] font-bold text-[#0f3460]">{counts[key] ?? 0}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TinyStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[14px] border border-[#dbeaf3] bg-white px-3 py-3 text-center">
      <p className="font-['Plus_Jakarta_Sans'] text-[18px] font-bold text-[#0f3460]">{value}</p>
      <p className="font-['Inter'] text-[10px] text-[#64748b]">{label}</p>
    </div>
  );
}

function PanelLink({ children, to }: { children: ReactNode; to: string }) {
  return (
    <Link className="inline-flex items-center gap-1 font-['Inter'] text-[12px] font-semibold text-[#052ca0]" to={to}>
      {children}
      <ChevronRight className="size-3" />
    </Link>
  );
}

function HeroStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[12px] bg-white/12 px-3 py-2">
      <p className="font-['Plus_Jakarta_Sans'] text-[22px] font-bold">{value}</p>
      <p className="font-['Inter'] text-[11px] text-white/70">{label}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const label = getStatusLabel(status);
  const className =
    status === "termine"
      ? "border-[#bbf7d0] bg-[#f0fdf4] text-[#008236]"
      : status === "confirme"
        ? "border-[#c2e0ef] bg-[#eaf3fb] text-[#265284]"
        : status === "annule" || status === "non_present"
          ? "border-[#fecaca] bg-[#fff1f2] text-[#e11d48]"
          : "border-[#fed7aa] bg-[#fff7ed] text-[#f97316]";

  return (
    <span className={`inline-flex w-fit rounded-full border px-3 py-1 font-['Inter'] text-[11px] font-semibold ${className}`}>
      {label}
    </span>
  );
}

function DashboardEmpty({ text }: { text: string }) {
  return (
    <div className="rounded-[15px] border border-dashed border-[#c2e0ef] bg-[#fbfdff] px-4 py-8 text-center font-['Inter'] text-[13px] text-[#64748b]">
      {text}
    </div>
  );
}

function buildActivityBars(rdvs: AppointmentLike[]) {
  const counts = new Map<string, number>();
  for (const rdv of rdvs) {
    counts.set(rdv.date, (counts.get(rdv.date) ?? 0) + 1);
  }

  const today = new Date();
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() + index);
    const key = date.toISOString().slice(0, 10);
    return {
      label: WEEK_DAYS[(date.getDay() + 6) % 7] ?? "",
      value: counts.get(key) ?? 0,
    };
  });
}

function countByStatus(rdvs: AppointmentLike[]) {
  return rdvs.reduce<Record<string, number>>((acc, rdv) => {
    acc[rdv.statut] = (acc[rdv.statut] ?? 0) + 1;
    return acc;
  }, {});
}

function compareAppointments(a: AppointmentLike, b: AppointmentLike) {
  return `${a.date} ${a.heure}`.localeCompare(`${b.date} ${b.heure}`);
}

function formatTime(value: string) {
  return value.slice(0, 5);
}

function formatShortDate(value: string) {
  return new Date(value).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
  });
}

function formatLongDate(value: Date) {
  return value.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function getInitials(value: string) {
  const initials = value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
  return initials || "DR";
}

function getStatusLabel(status: string) {
  switch (status) {
    case "planifie":
      return "Planifie";
    case "confirme":
      return "Confirme";
    case "termine":
      return "Termine";
    case "annule":
      return "Annule";
    case "non_present":
      return "Non present";
    default:
      return status;
  }
}
