import type { AppRouter } from "@doctor.com/api/routers/index";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import type { inferRouterOutputs } from "@trpc/server";
import { CalendarCheck, CheckCircle2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Sidebar } from "../../components/sidebar";
import { requireSession } from "../../lib/require-session";

import { AgendaHeader } from "../../components/agenda/agenda-header";
import { SearchBar } from "../../components/agenda/search-bar";
import { MonthSelector } from "../../components/agenda/month-selector";
import { TimelineSection } from "../../components/agenda/timeline-section";
import { CalendarSection } from "../../components/agenda/calendar-section";
import { UpcomingList } from "../../components/agenda/upcoming-list";
import { AjouterRdvDialog } from "./popups/ajouter-rdv";
import { ModifierRdvDialog } from "./popups/modifier-rdv";
import {
  RDV_TYPE_OPTIONS,
  getInitialsFromName,
  type RdvFormValues,
  type RdvPatientOption,
} from "./popups/rdv-dialog-shared";
import { VoirRdvDialog } from "./popups/voir-rdv";
import type {
  AgendaEvent,
  AgendaStatusFilter,
  GroupedEvent,
  UpcomingItem,
} from "../../components/agenda/types";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type MobileAgendaSlot = RouterOutputs["agenda"]["getSlots"][number];
type PatientRecord = RouterOutputs["patient"]["searchPatients"][number];

const STATUS_FILTER_OPTIONS: Array<{ value: AgendaStatusFilter; label: string }> = [
  { value: "all", label: "Tous les statuts" },
  { value: "booked", label: "Confirmé" },
  { value: "pending", label: "En attente" },
  { value: "completed", label: "Terminé" },
  { value: "cancelled", label: "Annulé" },
  { value: "blocked", label: "Bloqué" },
];

const WEEKDAY_LABELS = ["DIM", "LUN", "MAR", "MER", "JEU", "VEN", "SAM"] as const;
const UPCOMING_DAYS_WINDOW = 30;

function getDateParts(dateValue: string) {
  const [yearText = "2026", monthText = "1", dayText = "1"] = dateValue.split("-");
  const year = Number(yearText) || 2026;
  const month = Math.max(0, Math.min(11, (Number(monthText) || 1) - 1));
  const day = Math.max(1, Number(dayText) || 1);

  return { year, month, day };
}

function getWeekdayLabel(dateValue: string) {
  const date = new Date(`${dateValue}T00:00:00`);
  return WEEKDAY_LABELS[date.getDay()] ?? "LUN";
}

function formatDateFromSelection(year: number, month: number, day: number) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const safeDay = Math.min(day, daysInMonth);
  const monthText = String(month + 1).padStart(2, "0");
  const dayText = String(safeDay).padStart(2, "0");

  return `${year}-${monthText}-${dayText}`;
}

function formatDateForApi(dateValue: Date) {
  const year = dateValue.getFullYear();
  const month = String(dateValue.getMonth() + 1).padStart(2, "0");
  const day = String(dateValue.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(dateValue: Date, days: number) {
  const nextDate = new Date(dateValue);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function normalizeTime(timeValue: string) {
  return timeValue.slice(0, 5);
}

function parseDateTime(dateValue: string, timeValue: string) {
  return new Date(`${dateValue}T${normalizeTime(timeValue)}:00`);
}

function toMeridiemTime(timeValue: string) {
  const [hourText = "0", minuteText = "00"] = normalizeTime(timeValue).split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);

  if (Number.isNaN(hour) || Number.isNaN(minute)) {
    return "00:00 AM";
  }

  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = ((hour + 11) % 12) + 1;

  return `${String(hour12).padStart(2, "0")}:${String(minute).padStart(2, "0")} ${period}`;
}

function formatRelativeLabel(dateValue: Date) {
  const diffMs = dateValue.getTime() - Date.now();

  if (!Number.isFinite(diffMs) || diffMs <= 0) {
    return "Maintenant";
  }

  const minutes = Math.round(diffMs / 60000);
  if (minutes < 60) {
    return `Dans ${minutes} min`;
  }

  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `Dans ${hours} h`;
  }

  const days = Math.round(hours / 24);
  return `Dans ${days} jour${days > 1 ? "s" : ""}`;
}

function mapSlotToEvent(slot: MobileAgendaSlot): AgendaEvent {
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
    important: slot.important ?? false,
  };
}

function mapEventToUpcomingItem(event: AgendaEvent): UpcomingItem {
  const startsAt = parseDateTime(event.date, event.startTime);

  return {
    id: event.id,
    patientName: event.patientName,
    patientInitials: event.patientInitials,
    type: event.type,
    time: toMeridiemTime(event.startTime),
    status: event.status,
    relativeLabel: formatRelativeLabel(startsAt),
  };
}

function groupAgendaEvents(events: AgendaEvent[]): GroupedEvent[] {
  const sortedEvents = [...events].sort((firstEvent, secondEvent) => {
    const dateCompare = firstEvent.date.localeCompare(secondEvent.date);
    if (dateCompare !== 0) {
      return dateCompare;
    }

    return firstEvent.startTime.localeCompare(secondEvent.startTime);
  });

  const groups = new Map<string, GroupedEvent>();

  for (const event of sortedEvents) {
    const existingGroup = groups.get(event.date);
    if (existingGroup) {
      existingGroup.events.push(event);
      continue;
    }

    groups.set(event.date, {
      date: event.date,
      day: event.day,
      weekday: getWeekdayLabel(event.date),
      events: [event],
    });
  }

  return Array.from(groups.values());
}

function toSlotPayload(values: RdvFormValues) {
  const patientName = normalizeAgendaPlaceholderName(values.patientName);

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
    important: values.important,
  };
}

function getPatientInitials(patient: PatientRecord) {
  const { nom, prenom } = normalizePatientDisplayParts(patient);
  return `${nom.slice(0, 1)}${prenom.slice(0, 1)}`.toUpperCase() || "PT";
}

function getPatientLabel(patient: PatientRecord) {
  const { nom, prenom } = normalizePatientDisplayParts(patient);
  return [nom, prenom].filter(Boolean).join(" ").trim() || "Patient inconnu";
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
  const parts = normalizeAgendaPlaceholderName(patientName).split(/\s+/).filter(Boolean);
  const [nom = "Patient", ...prenomParts] = parts;
  const prenom = prenomParts.join(" ") || "Nouveau";

  return { nom, prenom };
}

function normalizeAgendaPlaceholderName(value: string) {
  return value.replace(/\s+agenda$/i, "").trim();
}

function normalizePatientDisplayParts(patient: PatientRecord) {
  const nom = patient.nom.trim();
  const prenom = patient.prenom.trim();
  const isAgendaCreatedPatient = /^[A-Z0-9]{1,3}-\d{4}-\d{4}$/i.test(
    patient.matricule.trim(),
  );
  const shouldHidePlaceholder =
    isAgendaCreatedPatient && /^(agenda|nouveau)$/i.test(prenom);

  return {
    nom,
    prenom: shouldHidePlaceholder ? "" : prenom,
  };
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

export const Route = createFileRoute("/agenda/")({
  component: RouteComponent,
  beforeLoad: async () => {
    const session = await requireSession();
    return { session };
  },
});

function RouteComponent() {
  const context = Route.useRouteContext();
  const trpc = context.trpc;
  const session = context?.session;
  const sessionUser = session?.data?.user;

  const sidebarUser = sessionUser && typeof sessionUser.email === "string"
    ? {
        name: sessionUser.name?.trim() || sessionUser.email,
        email: sessionUser.email,
        avatarUrl: sessionUser.image ?? undefined,
      }
    : undefined;

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<AgendaStatusFilter>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth());
  const [selectedDay, setSelectedDay] = useState(() => new Date().getDate());
  const [isDaySelected, setIsDaySelected] = useState(false);
  const [activeDialog, setActiveDialog] = useState<"add" | "view" | "edit" | null>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<AgendaEvent | null>(null);
  const [createdSuccessAppointment, setCreatedSuccessAppointment] = useState<AgendaEvent | null>(null);

  const monthRange = useMemo(() => {
    const monthStart = new Date(selectedYear, selectedMonth, 1);
    const monthEnd = new Date(selectedYear, selectedMonth + 1, 0);

    return {
      startDate: formatDateForApi(monthStart),
      endDate: formatDateForApi(monthEnd),
    };
  }, [selectedMonth, selectedYear]);

  const upcomingRange = useMemo(() => {
    const today = new Date();

    return {
      startDate: formatDateForApi(today),
      endDate: formatDateForApi(addDays(today, UPCOMING_DAYS_WINDOW)),
    };
  }, []);

  const monthSlotsQuery = useQuery(trpc.agenda.getSlots.queryOptions(monthRange));
  const upcomingSlotsQuery = useQuery(trpc.agenda.getSlots.queryOptions(upcomingRange));
  const patientsQuery = useQuery(trpc.patient.searchPatients.queryOptions({}));

  const createSlotMutation = useMutation(trpc.agenda.createSlot.mutationOptions());
  const updateSlotMutation = useMutation(trpc.agenda.updateSlot.mutationOptions());
  const deleteSlotMutation = useMutation(trpc.agenda.deleteSlot.mutationOptions());
  const createPatientMutation = useMutation(trpc.patient.createPatient.mutationOptions());

  const allAgendaEvents = useMemo(
    () => (monthSlotsQuery.data ?? []).map((slot) => mapSlotToEvent(slot)),
    [monthSlotsQuery.data],
  );

  const groupedEvents = useMemo(
    () => groupAgendaEvents(allAgendaEvents),
    [allAgendaEvents],
  );

  const typeFilterOptions = useMemo(
    () => ["all", ...Array.from(new Set([...RDV_TYPE_OPTIONS, ...allAgendaEvents.map((event) => event.type)]))],
    [allAgendaEvents],
  );

  const upcomingItems = useMemo(() => {
    const now = Date.now();

    return (upcomingSlotsQuery.data ?? [])
      .map((slot) => mapSlotToEvent(slot))
      .map((event) => ({
        event,
        startsAt: parseDateTime(event.date, event.startTime),
      }))
      .filter(
        ({ startsAt }) =>
          Number.isFinite(startsAt.getTime()) && startsAt.getTime() >= now,
      )
      .sort((firstItem, secondItem) => firstItem.startsAt.getTime() - secondItem.startsAt.getTime())
      .slice(0, 6)
      .map(({ event }) => mapEventToUpcomingItem(event));
  }, [upcomingSlotsQuery.data]);

  const patientOptions = useMemo(
    () => (patientsQuery.data ?? []).map((patient) => mapPatientToOption(patient)),
    [patientsQuery.data],
  );

  const defaultDialogDate = formatDateFromSelection(selectedYear, selectedMonth, selectedDay);

  const searchLower = searchTerm.trim().toLowerCase();
  const matchesFilters = (
    item: Pick<AgendaEvent, "patientName" | "patientInitials" | "type" | "status">,
  ) => {
    const matchesSearch =
      !searchLower ||
      item.patientName.toLowerCase().includes(searchLower) ||
      item.patientInitials.toLowerCase().includes(searchLower) ||
      item.type.toLowerCase().includes(searchLower);
    const matchesStatus = selectedStatus === "all" || item.status === selectedStatus;
    const matchesType = selectedType === "all" || item.type === selectedType;

    return matchesSearch && matchesStatus && matchesType;
  };

  const selectedDateIso = formatDateFromSelection(selectedYear, selectedMonth, selectedDay);

  const filteredGroupedEvents = groupedEvents
    .filter((group: GroupedEvent) => !isDaySelected || group.events[0]?.date === selectedDateIso)
    .map((group: GroupedEvent) => ({
      ...group,
      events: group.events.filter(matchesFilters),
    }))
    .filter((group: GroupedEvent) => group.events.length > 0);

  const filteredUpcomingItems = upcomingItems.filter(matchesFilters);

  const refetchAgenda = async () => {
    await Promise.all([monthSlotsQuery.refetch(), upcomingSlotsQuery.refetch()]);
  };

  const handleAppointmentClick = (appointment: AgendaEvent) => {
    setSelectedAppointment(appointment);
    setActiveDialog("edit");
  };

  useEffect(() => {
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    setSelectedDay((currentDay) => Math.min(currentDay, daysInMonth));
  }, [selectedMonth, selectedYear]);

  const handleSelectMonth = (month: number) => {
    setSelectedMonth(month);
    setIsDaySelected(false);
  };

  const handleSelectDay = (day: number) => {
    if (isDaySelected && day === selectedDay) {
      setIsDaySelected(false);
    } else {
      setSelectedDay(day);
      setIsDaySelected(true);
    }
  };

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

      const createdSlot = await createSlotMutation.mutateAsync(toSlotPayload(nextValues));
      const createdEvent = mapSlotToEvent(createdSlot);

      setSelectedYear(createdEvent.year);
      setSelectedMonth(createdEvent.month);
      setSelectedDay(createdEvent.day);
      setSelectedAppointment(createdEvent);

      setCreatedSuccessAppointment(createdEvent);
      await refetchAgenda();
      return true;
    } catch (error) {
      toast.error(getErrorMessage(error, "Impossible d'ajouter le rendez-vous."));
      return false;
    }
  };

  const handleUpdateRdv = async (appointmentId: string, values: RdvFormValues) => {
    try {
      const updatedSlot = await updateSlotMutation.mutateAsync({
        id: appointmentId,
        ...toSlotPayload(values),
      });

      const updatedEvent = mapSlotToEvent(updatedSlot);
      setSelectedAppointment(updatedEvent);
      setSelectedYear(updatedEvent.year);
      setSelectedMonth(updatedEvent.month);
      setSelectedDay(updatedEvent.day);

      toast.success("Rendez-vous modifie avec succes.");
      await refetchAgenda();
      return true;
    } catch (error) {
      toast.error(getErrorMessage(error, "Impossible de modifier le rendez-vous."));
      return false;
    }
  };

  const handleEditFromView = (appointment: AgendaEvent) => {
    setSelectedAppointment(appointment);
    setActiveDialog("edit");
  };

  const handleDeleteFromView = async (appointment: AgendaEvent) => {
    try {
      await deleteSlotMutation.mutateAsync({ id: appointment.id });
      setSelectedAppointment((currentAppointment) =>
        currentAppointment?.id === appointment.id ? null : currentAppointment,
      );

      toast.success("Rendez-vous supprime avec succes.");
      await refetchAgenda();
      return true;
    } catch (error) {
      toast.error(getErrorMessage(error, "Impossible de supprimer le rendez-vous."));
      return false;
    }
  };

  const isAgendaLoading = monthSlotsQuery.isLoading || upcomingSlotsQuery.isLoading;

  return (
    <div className="flex h-screen h-[100svh] h-[100dvh] overflow-hidden bg-[#f3f7fb]">
      <Sidebar currentUser={sidebarUser} />

      <main className="h-full min-h-0 flex-1 min-w-0 overflow-x-hidden overflow-y-auto px-[clamp(1.25rem,_2.3vw,_2.2rem)] py-[clamp(0.875rem,_1.6vw,_1.5rem)]">
        <div className="flex flex-col gap-[clamp(0.75rem,_1.5vw,_1.125rem)] px-[clamp(0.25rem,_0.65vw,_0.55rem)]">
          {/* Header */}
          <AgendaHeader onAddRdv={() => setActiveDialog("add")} />

          <section className="grid w-full grid-cols-1 gap-3 md:grid-cols-[12.5rem_13.5rem_minmax(0,1fr)] md:items-center">
            <label className="relative w-full min-w-0">
              <span className="sr-only">Filtrer par statut</span>
              <select
                value={selectedStatus}
                onChange={(event) => setSelectedStatus(event.target.value as AgendaStatusFilter)}
                className="h-[2.55rem] w-full cursor-pointer appearance-none rounded-[0.7rem] border border-[#c2e0ef] bg-white px-3.5 pr-9 text-[0.86rem] font-semibold text-[#0f3460] outline-none transition-all duration-150 hover:border-[#76bbdd] focus:border-[#76bbdd] focus:bg-[color-mix(in_srgb,_white_94%,_#c2e0ef)] focus:shadow-[inset_0_0_0_1px_#76bbdd]"
                aria-label="Filtrer les rendez-vous par statut"
              >
                {STATUS_FILTER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#0f3460]">
                ▾
              </span>
            </label>

            <label className="relative w-full min-w-0">
              <span className="sr-only">Filtrer par type</span>
              <select
                value={selectedType}
                onChange={(event) => setSelectedType(event.target.value)}
                className="h-[2.55rem] w-full cursor-pointer appearance-none rounded-[0.7rem] border border-[#c2e0ef] bg-white px-3.5 pr-9 text-[0.86rem] font-semibold text-[#0f3460] outline-none transition-all duration-150 hover:border-[#76bbdd] focus:border-[#76bbdd] focus:bg-[color-mix(in_srgb,_white_94%,_#c2e0ef)] focus:shadow-[inset_0_0_0_1px_#76bbdd]"
                aria-label="Filtrer les rendez-vous par type"
              >
                {typeFilterOptions.map((type) => (
                  <option key={type} value={type}>
                    {type === "all" ? "Tous les types" : type}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#0f3460]">
                ▾
              </span>
            </label>

            <SearchBar
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Recherche patient, type, initiales..."
            />
          </section>

          {/* Main Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_21rem] gap-3.5 items-start">
            <section className="min-w-0 space-y-8">
              <MonthSelector selectedMonth={selectedMonth} onSelectMonth={handleSelectMonth} />

              <TimelineSection
                groupedEvents={filteredGroupedEvents}
                isLoading={isAgendaLoading}
                selectedDate={selectedDateIso}
                onAppointmentClick={handleAppointmentClick}
                emptyMessage={
                  isDaySelected
                    ? "Aucun rendez-vous pour ce jour."
                    : "Aucun rendez-vous pour ce mois."
                }
              />
            </section>

            {/* Right Column */}
            <aside className="flex flex-col gap-6">
              <CalendarSection
                selectedMonth={selectedMonth}
                selectedYear={selectedYear}
                onSelectMonth={(month) => { setSelectedMonth(month); setIsDaySelected(false); }}
                onSelectYear={(year) => { setSelectedYear(year); setIsDaySelected(false); }}
                selectedDay={isDaySelected ? selectedDay : 0}
                onSelectDate={handleSelectDay}
              />

              <section className="border border-[rgba(194,224,239,0.5)] rounded-xl bg-white shadow-[0px_4px_24px_rgba(194,224,239,0.5)] p-5">
                <h2 className="m-0 font-['Inter',sans-serif] text-[1.125rem] leading-none font-semibold text-[#1f2937]">
                  Prochains rendez-vous
                </h2>
                <UpcomingList
                  items={filteredUpcomingItems}
                  isLoading={upcomingSlotsQuery.isLoading}
                />
              </section>
            </aside>
          </div>
        </div>
      </main>

      <AjouterRdvDialog
        open={activeDialog === "add"}
        onOpenChange={(open) => setActiveDialog(open ? "add" : null)}
        defaultDate={defaultDialogDate}
        onCreate={handleCreateRdv}
        patientOptions={patientOptions}
        isSubmitting={createSlotMutation.isPending || createPatientMutation.isPending}
      />

      <VoirRdvDialog
        open={activeDialog === "view"}
        onOpenChange={(open) => setActiveDialog(open ? "view" : null)}
        appointment={selectedAppointment}
        onEdit={handleEditFromView}
        onDelete={handleDeleteFromView}
        isDeleting={deleteSlotMutation.isPending}
      />

      <ModifierRdvDialog
        open={activeDialog === "edit"}
        onOpenChange={(open) => setActiveDialog(open ? "edit" : null)}
        appointment={selectedAppointment}
        onUpdate={handleUpdateRdv}
        isSubmitting={updateSlotMutation.isPending}
      />

      <RdvSuccessDialog
        appointment={createdSuccessAppointment}
        onClose={() => setCreatedSuccessAppointment(null)}
        onView={(appointment) => {
          setCreatedSuccessAppointment(null);
          setSelectedAppointment(appointment);
          setActiveDialog("view");
        }}
      />
    </div>
  );
}

function RdvSuccessDialog({
  appointment,
  onClose,
  onView,
}: {
  appointment: AgendaEvent | null;
  onClose: () => void;
  onView: (appointment: AgendaEvent) => void;
}) {
  if (!appointment) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[rgba(10,35,65,0.24)] p-4">
      <section className="w-full max-w-[430px] overflow-hidden rounded-[24px] border border-[#c2e0ef] bg-white shadow-[0_24px_70px_rgba(15,52,96,0.24)]">
        <div className="relative bg-gradient-to-br from-[rgba(194,224,239,0.55)] via-white to-[#fff9f4] px-6 pb-5 pt-6 text-center">
          <span className="mx-auto flex size-16 items-center justify-center rounded-full border border-[#009689]/20 bg-[#D0F1E7] text-[#009689] shadow-[0_10px_30px_rgba(0,150,137,0.18)]">
            <CheckCircle2 className="size-9" aria-hidden="true" />
          </span>
          <h3 className="m-0 mt-4 font-['Plus_Jakarta_Sans'] text-[22px] font-bold text-[#0f3460]">
            Rendez-vous ajoute
          </h3>
          <p className="mx-auto mt-2 max-w-[310px] font-['Inter'] text-[14px] leading-6 text-[#64748b]">
            Le creneau a ete ajoute a votre agenda et sera visible dans la journee selectionnee.
          </p>
        </div>

        <div className="px-6 py-5">
          <div className="rounded-[18px] border border-[#e2eef5] bg-[#f8fafc] p-4">
            <div className="flex items-center gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white text-[#1447E6] shadow-[0_1px_4px_rgba(15,52,96,0.08)]">
                <CalendarCheck className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="m-0 truncate font-['Plus_Jakarta_Sans'] text-[16px] font-bold text-[#0f3460]">
                  {appointment.patientName}
                </p>
                <p className="m-0 mt-1 font-['Inter'] text-[13px] font-medium text-[#64748b]">
                  {appointment.type} - {appointment.date} - {appointment.startTime} a {appointment.endTime}
                </p>
              </div>
            </div>
          </div>
        </div>

        <footer className="flex items-center justify-end gap-3 border-t border-[#e2eef5] px-6 py-4">
          <button
            className="h-[40px] rounded-[12px] border border-[#c2e0ef] px-4 font-['Inter'] text-[14px] font-semibold text-[#0f3460] transition-colors hover:bg-[#f8fafc]"
            type="button"
            onClick={onClose}
          >
            Fermer
          </button>
          <button
            className="h-[40px] rounded-[12px] bg-[#76bbdd] px-4 font-['Inter'] text-[14px] font-semibold text-white shadow-[0_8px_18px_rgba(118,187,221,0.35)] transition-colors hover:bg-[#63afd4]"
            type="button"
            onClick={() => onView(appointment)}
          >
            Voir le RDV
          </button>
        </footer>
      </section>
    </div>
  );
}
