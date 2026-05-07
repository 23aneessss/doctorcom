// apps/web/src/routes/agenda/components/types.ts
export type AgendaTone = "green" | "blue" | "orange" | "red" | "slate";
export type AgendaSlotStatus = "booked" | "pending" | "completed" | "cancelled" | "blocked";
export type AgendaStatusFilter = AgendaSlotStatus | "all";

export interface AgendaEvent {
  id: string;
  day: number;
  startTime: string;
  endTime?: string;
  patientName: string;
  patientInitials: string;
  type: string;
  status: AgendaSlotStatus;
  date: string;
  month: number;
  year: number;
  notes?: string;
  important?: boolean;
}

export interface UpcomingItem {
  id: string;
  patientName: string;
  patientInitials: string;
  type: string;
  time: string;
  status: AgendaSlotStatus;
  relativeLabel: string;
}

export interface GroupedEvent {
  date: string;
  day: number;
  weekday: string;
  events: AgendaEvent[];
}
