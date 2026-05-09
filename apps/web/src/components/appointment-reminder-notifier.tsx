import { useEffect } from "react";
import { toast } from "sonner";

import { trpcClient } from "@/utils/trpc";

type AppointmentSlot = Awaited<
  ReturnType<typeof trpcClient.agenda.getSlots.query>
>[number];

const ACTIVE_REMINDER_STATUSES = new Set(["booked", "pending"]);
const POLL_INTERVAL_MS = 30_000;
const FIVE_MINUTES_MS = 5 * 60_000;
const ARRIVAL_WINDOW_MS = 30_000;

function formatDateForApi(dateValue: Date) {
  const year = dateValue.getFullYear();
  const month = String(dateValue.getMonth() + 1).padStart(2, "0");
  const day = String(dateValue.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeTime(timeValue: string) {
  return timeValue.slice(0, 5);
}

function getAppointmentTime(slot: AppointmentSlot) {
  return new Date(`${slot.date}T${normalizeTime(slot.startTime)}:00`);
}

function getPatientLabel(slot: AppointmentSlot) {
  return slot.patientLabel.trim() || "Patient";
}

function notifyBrowser(title: string, body: string) {
  if (!("Notification" in window) || Notification.permission !== "granted") {
    return;
  }

  new Notification(title, { body });
}

function showReminderToast(slot: AppointmentSlot, type: "five-minutes" | "now") {
  const patientLabel = getPatientLabel(slot);
  const time = normalizeTime(slot.startTime);

  if (type === "five-minutes") {
    const message = `${patientLabel} a un rendez-vous a ${time}, dans 5 minutes.`;
    toast.warning("Rendez-vous imminent", {
      description: message,
      action:
        "Notification" in window && Notification.permission === "default"
          ? {
              label: "Activer",
              onClick: () => {
                void Notification.requestPermission();
              },
            }
          : undefined,
    });
    notifyBrowser("Rendez-vous dans 5 minutes", message);
    return;
  }

  const message = `${patientLabel} est attendu maintenant pour son rendez-vous de ${time}.`;
  toast.info("Rendez-vous maintenant", {
    description: message,
    action:
      "Notification" in window && Notification.permission === "default"
        ? {
            label: "Activer",
            onClick: () => {
              void Notification.requestPermission();
            },
          }
        : undefined,
  });
  notifyBrowser("Rendez-vous maintenant", message);
}

function shouldNotify(storageKey: string) {
  if (window.sessionStorage.getItem(storageKey)) {
    return false;
  }

  window.sessionStorage.setItem(storageKey, "1");
  return true;
}

export function AppointmentReminderNotifier() {
  useEffect(() => {
    let disposed = false;

    const checkAppointments = async () => {
      const today = formatDateForApi(new Date());

      try {
        const slots = await trpcClient.agenda.getSlots.query({
          startDate: today,
          endDate: today,
        });

        if (disposed) {
          return;
        }

        const now = Date.now();
        for (const slot of slots) {
          if (!ACTIVE_REMINDER_STATUSES.has(slot.status)) {
            continue;
          }

          const startsAt = getAppointmentTime(slot).getTime();
          if (!Number.isFinite(startsAt)) {
            continue;
          }

          const diff = startsAt - now;
          if (diff > 0 && diff <= FIVE_MINUTES_MS) {
            const key = `doctor-com-rdv-reminder:${today}:${slot.id}:five-minutes`;
            if (shouldNotify(key)) {
              showReminderToast(slot, "five-minutes");
            }
          }

          if (Math.abs(diff) <= ARRIVAL_WINDOW_MS) {
            const key = `doctor-com-rdv-reminder:${today}:${slot.id}:now`;
            if (shouldNotify(key)) {
              showReminderToast(slot, "now");
            }
          }
        }
      } catch {
        // The root renders on public pages too. Ignore auth/network failures here.
      }
    };

    void checkAppointments();
    const interval = window.setInterval(() => {
      void checkAppointments();
    }, POLL_INTERVAL_MS);

    return () => {
      disposed = true;
      window.clearInterval(interval);
    };
  }, []);

  return null;
}
