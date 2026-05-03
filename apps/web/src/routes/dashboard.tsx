import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  CalendarDays,
  CircleX,
  Eye,
  Plus,
  UserPlus,
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
  const displayName = sessionUser?.name?.trim() || "Dr Benali";
  const firstName = displayName.replace(/^Dr\.?\s*/i, "").trim() || displayName;

  const overviewQuery = useQuery(
    trpc.dashboard.getOverview.queryOptions(undefined, {
      staleTime: 60_000,
      retry: false,
    }),
  );
  const overview = (overviewQuery.data ?? EMPTY_OVERVIEW) as DashboardOverview;

  return (
    <div className="flex min-h-svh bg-[#f8fafc]">
      <Sidebar currentUser={sidebarUser} />
      <main className="min-w-0 flex-1 overflow-auto">
        <div className="mx-auto flex max-w-[1160px] flex-col gap-[18px] px-6 py-7">
          <WelcomeBanner displayName={firstName} />

          <section className="grid gap-[18px] md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              icon={CalendarDays}
              label="Rendez-vous du jour"
              value={overview.metrics.todayAppointments}
            />
            <MetricCard
              icon={Users}
              label="Total patients"
              value={overview.metrics.totalPatients}
            />
            <MetricCard
              icon={UserPlus}
              label="Nouveaux patients"
              value={overview.metrics.newPatients}
            />
            <MetricCard
              icon={CircleX}
              label="RDV annulés"
              value={overview.metrics.cancelledAppointments}
              padded
            />
          </section>

          <section className="grid gap-[18px] xl:grid-cols-[1fr_184px]">
            <DashboardCard className="min-h-[193px]">
              <div className="mb-5 flex items-start justify-between gap-4">
                <h2 className="font-['Plus_Jakarta_Sans'] text-[20px] font-semibold leading-7 text-[#0f3460]">
                  Nombre de patients
                </h2>
                <div className="flex items-center gap-6 font-['Inter'] text-[10px] leading-4 text-[#606060]">
                  <span>Par an</span>
                  <span>Par mois</span>
                  <span className="border-b-2 border-[#052ca0] pb-1 text-[#0f3460]">
                    Par jour
                  </span>
                </div>
              </div>
              <PatientTrendChart bars={overview.patientTrend} />
            </DashboardCard>

            <DashboardCard className="min-h-[193px]">
              <h2 className="font-['Plus_Jakarta_Sans'] text-[14px] font-semibold leading-5 text-[#0f3460]">
                Médicaments les plus prescrits
              </h2>
              <p className="font-['Inter'] text-[10px] leading-4 text-[#606060]">
                Ce mois
              </p>
              <div className="mt-7 flex flex-col gap-2">
                {overview.topMedications.length > 0 ? (
                  overview.topMedications.map((medication) => (
                    <MedicationPill key={medication.name} medication={medication} />
                  ))
                ) : (
                  <EmptyPanel text="Aucune prescription ce mois" />
                )}
              </div>
            </DashboardCard>
          </section>

          <section className="grid gap-[18px] xl:grid-cols-[1fr_380px]">
            <div className="grid gap-[18px]">
              <DashboardCard className="min-h-[178px]">
                <RdvTypeDonut data={overview.rdvTypes} />
              </DashboardCard>

              <DashboardCard className="min-h-[130px]">
                <h2 className="mb-7 text-center font-['Plus_Jakarta_Sans'] text-[20px] font-semibold leading-7 text-[#0f3460]">
                  Actions Rapides
                </h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <QuickAction to="/agenda/ajouter">
                    <Plus className="size-[30px]" />
                    Ajouter un RDV
                  </QuickAction>
                  <QuickAction to="/patients">
                    <Plus className="size-[30px]" />
                    Ajouter un patient
                  </QuickAction>
                </div>
              </DashboardCard>
            </div>

            <DashboardCard className="min-h-[326px] overflow-hidden p-0">
              <UpcomingAppointments overview={overview} />
            </DashboardCard>
          </section>
        </div>
      </main>
    </div>
  );
}

function WelcomeBanner({ displayName }: { displayName: string }) {
  return (
    <section className="relative overflow-hidden rounded-[15px] border border-[#c2e0ef] bg-[linear-gradient(97deg,rgba(194,224,239,0.87)_0%,#ffffff_100%)] px-8 py-5 shadow-[0px_4px_10px_rgba(118,187,221,0.5)]">
      <div className="absolute inset-0 opacity-30 [background-image:repeating-radial-gradient(ellipse_at_70%_50%,transparent_0,transparent_8px,rgba(118,187,221,0.35)_9px,transparent_10px)]" />
      <div className="relative max-w-[780px]">
        <h1 className="font-['Plus_Jakarta_Sans'] text-[28px] font-bold leading-8 text-[#0f3460]">
          Bienvenue Dr {displayName}
        </h1>
        <p className="mt-1 font-['Plus_Jakarta_Sans'] text-[20px] font-semibold leading-7 text-[#052ca0]">
          Accédez rapidement à vos informations médicales, et organisez vos consultations en toute simplicité avec Doctor.com !
        </p>
      </div>
    </section>
  );
}

function MetricCard({
  icon: Icon,
  label,
  padded,
  value,
}: {
  icon: LucideIcon;
  label: string;
  padded?: boolean;
  value: number;
}) {
  return (
    <article className="flex h-[108px] items-center justify-between rounded-[15px] border-[0.8px] border-[rgba(194,224,239,0.9)] bg-white px-[22px] shadow-[0_2px_8px_rgba(118,187,221,0.16)]">
      <div className="min-w-0">
        <p className="font-['Plus_Jakarta_Sans'] text-[14px] font-medium leading-5 text-[#0f3460]">
          {label}
        </p>
        <p className="mt-1 font-['Plus_Jakarta_Sans'] text-[24px] font-bold leading-8 text-[#11142d]">
          {padded ? value.toString().padStart(2, "0") : value}
        </p>
      </div>
      <Icon className="size-[38px] shrink-0 text-[#052ca0]" strokeWidth={1.9} />
    </article>
  );
}

function DashboardCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-[15px] border border-[#c2e0ef] bg-white p-[18px] shadow-[0px_4px_10px_rgba(118,187,221,0.18)] ${className}`}
    >
      {children}
    </section>
  );
}

function PatientTrendChart({ bars }: { bars: DashboardOverview["patientTrend"] }) {
  const data = bars.length > 0 ? bars : Array.from({ length: 22 }, (_, index) => ({
    label: String(index + 6).padStart(2, "0"),
    value: 0,
    ghostValue: 6,
  }));
  const max = Math.max(1, ...data.map((bar) => Math.max(bar.value, bar.ghostValue)));

  return (
    <div className="flex h-[118px] items-end gap-[13px] overflow-hidden px-5">
      {data.map((bar) => {
        const ghostHeight = Math.max(18, Math.round((bar.ghostValue / max) * 86));
        const valueHeight = Math.max(bar.value > 0 ? 12 : 4, Math.round((bar.value / max) * 86));

        return (
          <div className="flex min-w-[10px] flex-1 flex-col items-center gap-1" key={bar.label}>
            <div className="relative flex h-[86px] w-[9px] items-end justify-center">
              <div
                className="absolute bottom-0 w-[9px] rounded-full bg-[#e1e7f0]"
                style={{ height: ghostHeight }}
              />
              <div
                className="relative z-10 w-[9px] rounded-full bg-[#052ca0]"
                style={{ height: valueHeight }}
              />
            </div>
            <span className="font-['Inter'] text-[10px] leading-4 text-[#606060]">
              {bar.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function MedicationPill({ medication }: { medication: { name: string; count: number } }) {
  return (
    <div className="flex h-[29px] items-center justify-between rounded-full bg-[#c2e0ef] px-4 font-['Inter'] text-[12px] leading-4 text-[#0f3460]">
      <span className="truncate">{medication.name}</span>
      <span>{medication.count}</span>
    </div>
  );
}

function RdvTypeDonut({ data }: { data: DashboardOverview["rdvTypes"] }) {
  const colors = ["#052ca0", "#76bbdd", "#c2e0ef", "#f77a21"];
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const displayData =
    total > 0
      ? data
      : [
          { label: "Routine", value: 20 },
          { label: "Consultation", value: 40 },
          { label: "Suivi", value: 25 },
          { label: "Contrôle", value: 15 },
        ];
  const displayTotal = displayData.reduce((sum, item) => sum + item.value, 0);
  let cursor = 0;
  const gradient = displayData
    .map((item, index) => {
      const start = cursor;
      const end = cursor + (item.value / displayTotal) * 100;
      cursor = end;
      return `${colors[index] ?? "#052ca0"} ${start}% ${end}%`;
    })
    .join(", ");

  return (
    <div className="grid items-center gap-8 md:grid-cols-[190px_1fr]">
      <div>
        <h2 className="mb-5 font-['Plus_Jakarta_Sans'] text-[20px] font-semibold leading-7 text-[#0f3460]">
          RDV type
        </h2>
        <div className="grid gap-3">
          {displayData.map((item, index) => {
            const percent = displayTotal > 0 ? Math.round((item.value / displayTotal) * 100) : 0;
            return (
              <div className="flex items-center gap-3" key={item.label}>
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: colors[index] ?? "#052ca0" }}
                />
                <span className="min-w-0 flex-1 font-['Inter'] text-[12px] leading-4 text-[#101828]">
                  {item.label}
                </span>
                <span className="font-['Inter'] text-[12px] leading-4 text-[#606060]">
                  {percent}%
                </span>
              </div>
            );
          })}
        </div>
      </div>
      <div
        className="mx-auto size-[118px] rounded-full"
        style={{ backgroundImage: `conic-gradient(${gradient})` }}
      >
        <div className="m-auto flex size-full items-center justify-center rounded-full">
          <div className="size-[70px] rounded-full bg-white" />
        </div>
      </div>
    </div>
  );
}

function QuickAction({ children, to }: { children: ReactNode; to: string }) {
  return (
    <Link
      className="flex h-[69px] items-center justify-center gap-4 rounded-[15px] bg-[#c2e0ef] px-6 font-['Plus_Jakarta_Sans'] text-[18px] font-bold leading-7 text-[#0f3460] transition hover:bg-[#b6d9eb]"
      to={to}
    >
      {children}
    </Link>
  );
}

function UpcomingAppointments({ overview }: { overview: DashboardOverview }) {
  return (
    <div className="flex h-full min-h-[326px] flex-col">
      <div className="px-8 pb-4 pt-6">
        <h2 className="text-center font-['Plus_Jakarta_Sans'] text-[20px] font-semibold leading-7 text-[#0f3460]">
          Prochains Rendez-vous
        </h2>
        <div className="mt-4 flex items-center justify-between bg-[#d6edf7] px-2 py-1 font-['Inter'] text-[12px] font-medium text-[#101828]">
          <span>‹</span>
          <span>{formatMonthLabel(new Date())}</span>
          <span>›</span>
        </div>
        <div className="mt-4 grid grid-cols-7 gap-2">
          {(overview.calendarDays.length > 0 ? overview.calendarDays : fallbackCalendarDays()).map((day) => (
            <div
              className={`flex h-[60px] flex-col items-center justify-center rounded-[14px] border border-[#c2e0ef] font-['Inter'] ${
                day.isActive ? "bg-[#76bbdd] text-white" : "bg-[#f7f9fc] text-[#0f3460]"
              }`}
              key={day.isoDate}
            >
              <span className="text-[16px] font-medium leading-6">{day.day}</span>
              <span className="text-[12px] font-medium leading-4">{day.weekday}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 border-t border-[#f3f4f6]">
        {overview.upcomingAppointments.length > 0 ? (
          overview.upcomingAppointments.map((appointment) => (
            <AppointmentRow appointment={appointment} key={appointment.id} />
          ))
        ) : (
          <div className="px-8 py-8">
            <EmptyPanel text="Aucun rendez-vous à venir" />
          </div>
        )}
      </div>

      <div className="flex justify-center border-t border-[#f3f4f6] px-8 py-4">
        <Link
          className="inline-flex items-center gap-2 rounded-[13px] bg-[#c9e4f1] p-[10px] font-['Plus_Jakarta_Sans'] text-[12px] font-bold text-[#103561]"
          to="/agenda"
        >
          <CalendarDays className="size-[15px]" />
          Voir l'agenda
        </Link>
      </div>
    </div>
  );
}

function AppointmentRow({
  appointment,
}: {
  appointment: DashboardOverview["upcomingAppointments"][number];
}) {
  return (
    <div className="flex h-[48px] items-center border-b border-[#f3f4f6] px-8">
      <span className="flex size-[39px] shrink-0 items-center justify-center rounded-full bg-[#0f3460] font-['Inter'] text-[12px] font-bold text-white">
        {appointment.patientInitials}
      </span>
      <div className="ml-6 min-w-0 flex-1">
        <p className="truncate font-['Inter'] text-[14px] font-semibold leading-5 text-[#101828]">
          {appointment.patientLabel}
        </p>
        <p className="font-['Inter'] text-[12px] leading-4 text-[#606060]">
          {appointment.time}
        </p>
      </div>
      <Link
        className="inline-flex items-center gap-1 font-['Poppins'] text-[14px] font-medium leading-5 text-[#f77a21]"
        to="/agenda"
      >
        <Eye className="size-[18px]" />
        Voir
      </Link>
    </div>
  );
}

function EmptyPanel({ text }: { text: string }) {
  return (
    <div className="rounded-[12px] border border-dashed border-[#c2e0ef] bg-[#f8fafc] px-4 py-4 text-center font-['Inter'] text-[12px] text-[#64748b]">
      {text}
    </div>
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
      isActive: index === 1,
    };
  });
}

function formatMonthLabel(value: Date) {
  return value.toLocaleDateString("fr-FR", { month: "long" });
}
