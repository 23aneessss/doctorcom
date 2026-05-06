import { AlertCircle, CalendarPlus, Check, ChevronDown, Clock, FileText, UserRound } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";

import type { AgendaSlotStatus } from "@/components/agenda/types";

import {
  DialogShell,
  Field,
  RDV_STATUS_OPTIONS,
  RDV_TYPE_OPTIONS,
  StatusBadge,
  TimeField,
  fieldControlClassName,
  getInitialsFromName,
  type RdvPatientOption,
  type RdvFormValues,
} from "./rdv-dialog-shared";

interface AjouterRdvDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDate: string;
  onCreate: (values: RdvFormValues) => Promise<boolean>;
  patientOptions: RdvPatientOption[];
  isSubmitting?: boolean;
}

export function AjouterRdvDialog({
  open,
  onOpenChange,
  defaultDate,
  onCreate,
  patientOptions,
  isSubmitting = false,
}: AjouterRdvDialogProps) {
  const initialValues = useMemo<RdvFormValues>(
    () => ({
      patientId: undefined,
      patientName: "",
      patientInitials: "",
      type: "Consultation",
      date: defaultDate,
      startTime: "09:00",
      endTime: "09:30",
      status: "booked",
      notes: "",
      important: false,
    }),
    [defaultDate],
  );

  const [values, setValues] = useState<RdvFormValues>(initialValues);
  const [showValidation, setShowValidation] = useState(false);

  useEffect(() => {
    if (open) {
      setValues(initialValues);
      setShowValidation(false);
    }
  }, [initialValues, open]);

  const resolvedInitials = values.patientInitials.trim() || getInitialsFromName(values.patientName);
  const isTimeValid = values.endTime > values.startTime;
  const isValid =
    values.patientName.trim().length > 0 &&
    values.type.trim().length > 0 &&
    values.date.trim().length > 0 &&
    values.startTime.trim().length > 0 &&
    values.endTime.trim().length > 0 &&
    isTimeValid;

  const updateValue = <T extends keyof RdvFormValues>(field: T, value: RdvFormValues[T]) => {
    setValues((currentValues) => ({ ...currentValues, [field]: value }));
  };

  const updatePatientName = (patientName: string) => {
    const selectedPatient = patientOptions.find(
      (patient) => patient.label.toLowerCase() === patientName.trim().toLowerCase(),
    );

    setValues((currentValues) => ({
      ...currentValues,
      patientId: selectedPatient?.id,
      patientName,
      patientInitials: selectedPatient?.initials ?? currentValues.patientInitials,
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (!isValid) {
      setShowValidation(true);
      return;
    }

    const created = await onCreate({
      ...values,
      patientName: values.patientName.trim(),
      patientInitials: resolvedInitials,
      type: values.type.trim(),
      notes: values.notes.trim(),
    });

    if (created) {
      onOpenChange(false);
    }
  };

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      title="Ajouter un rendez-vous"
      subtitle="Planifiez un creneau patient dans votre agenda"
      icon={<CalendarPlus className="size-5" aria-hidden="true" />}
      maxWidth="max-w-[620px]"
      footer={
        <>
          <button
            className="h-[38px] rounded-[12px] border border-[#f77a21] px-4 font-['Plus_Jakarta_Sans'] text-[14px] font-medium text-[#f77a21] transition-colors hover:bg-[#fff7ed]"
            onClick={() => onOpenChange(false)}
            type="button"
            disabled={isSubmitting}
          >
            Annuler
          </button>
          <button
            className="inline-flex h-[38px] items-center justify-center gap-2 rounded-[12px] bg-[#76bbdd] px-5 font-['Inter'] text-[14px] font-medium text-white shadow-[0px_4px_12px_rgba(118,187,221,0.45)] transition-colors hover:bg-[#63afd4]"
            type="submit"
            form="agenda-ajouter-rdv-form"
            disabled={isSubmitting}
          >
            <Check className="size-4" aria-hidden="true" />
            {isSubmitting ? "Ajout..." : "Ajouter RDV"}
          </button>
        </>
      }
    >
      <form id="agenda-ajouter-rdv-form" className="space-y-5" onSubmit={handleSubmit}>
        <div className="rounded-[18px] border border-[#c2e0ef] bg-gradient-to-br from-[rgba(194,224,239,0.42)] to-white p-4 shadow-[0_10px_30px_rgba(15,52,96,0.08)]">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-[#1447E6] bg-white font-['Inter'] text-[14px] font-bold text-[#1447E6]">
                {resolvedInitials}
              </span>
              <div className="min-w-0">
                <p className="m-0 truncate font-['Plus_Jakarta_Sans'] text-[16px] font-bold text-[#0f3460]">
                  {values.patientName.trim() || "Nom du patient"}
                </p>
                <p className="m-0 mt-1 truncate font-['Inter'] text-[12px] font-medium text-[#64748b]">
                  {values.type} - {values.startTime} a {values.endTime}
                </p>
              </div>
            </div>
            <StatusBadge status={values.status} />
          </div>
        </div>

        {showValidation && !isValid ? (
          <p className="rounded-[12px] border border-[#CA3500]/30 bg-[rgba(255,135,139,0.1)] px-3 py-2 font-['Inter'] text-[13px] font-medium text-[#CA3500]">
            Renseignez les champs obligatoires et verifiez que l'heure de fin est apres l'heure de debut.
          </p>
        ) : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Selectionner patient" required>
              <div className="group relative">
                <UserRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#94a3b8] group-focus-within:text-[#76bbdd]" />
                <input
                  className={`${fieldControlClassName} pl-10`}
                  value={values.patientName}
                  onChange={(event) => updatePatientName(event.currentTarget.value)}
                  list="agenda-ajouter-patients"
                  placeholder="Rechercher ou creer un patient"
                />
                <datalist id="agenda-ajouter-patients">
                  {patientOptions.map((patient) => (
                    <option key={patient.id} value={patient.label}>
                      {patient.matricule ?? patient.initials}
                    </option>
                  ))}
                </datalist>
              </div>
              {values.patientName.trim() && !values.patientId ? (
                <span className="font-['Inter'] text-[12px] font-medium text-[#f97316]">
                  Aucun patient exact trouve: il sera cree automatiquement.
                </span>
              ) : null}
            </Field>
          </div>

          <Field label="Type" required>
            <div className="group relative">
              <select
                className={`${fieldControlClassName} appearance-none pr-9`}
                value={values.type}
                onChange={(event) => updateValue("type", event.currentTarget.value)}
              >
                {RDV_TYPE_OPTIONS.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-[#94a3b8]" />
            </div>
          </Field>

          <Field label="Statut" required>
            <div className="group relative">
              <select
                className={`${fieldControlClassName} appearance-none pr-9`}
                value={values.status}
                onChange={(event) => updateValue("status", event.currentTarget.value as AgendaSlotStatus)}
              >
                {RDV_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-[#94a3b8]" />
            </div>
          </Field>

          <Field label="Date" required>
            <div className="group relative">
              <CalendarPlus className="pointer-events-none absolute left-3 top-5 size-4 -translate-y-1/2 text-[#94a3b8] group-focus-within:text-[#76bbdd]" />
              <input
                className={`${fieldControlClassName} pl-10`}
                type="date"
                value={values.date}
                onChange={(event) => updateValue("date", event.currentTarget.value)}
              />
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Debut" required>
              <div className="group relative">
                <Clock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#94a3b8] group-focus-within:text-[#76bbdd]" />
                <TimeField
                  ariaLabel="Heure de debut"
                  value={values.startTime}
                  onChange={(value) => updateValue("startTime", value)}
                  className="pl-10"
                />
              </div>
            </Field>
            <Field label="Fin" required>
              <TimeField
                ariaLabel="Heure de fin"
                value={values.endTime}
                onChange={(value) => updateValue("endTime", value)}
              />
            </Field>
          </div>
        </div>

        <Field label="Notes">
          <div className="group relative">
            <FileText className="pointer-events-none absolute left-3 top-3 size-4 text-[#94a3b8] group-focus-within:text-[#76bbdd]" />
            <textarea
              className={`${fieldControlClassName} min-h-[88px] resize-none pl-10 pt-2.5`}
              value={values.notes}
              onChange={(event) => updateValue("notes", event.currentTarget.value)}
              placeholder="Notes internes, preparation, documents a demander..."
            />
          </div>
        </Field>

        <label className="flex cursor-pointer items-center gap-3 rounded-[14px] border border-[#c2e0ef] bg-white px-4 py-3 transition-colors hover:bg-[#f0f8fd]">
          <div
            className={`flex size-5 shrink-0 items-center justify-center rounded-[6px] border-2 transition-colors ${
              values.important
                ? "border-[#f97316] bg-[#f97316]"
                : "border-[#c2e0ef] bg-white"
            }`}
          >
            {values.important && <Check size={11} className="text-white" />}
          </div>
          <input
            type="checkbox"
            className="sr-only"
            checked={values.important}
            onChange={(e) => updateValue("important", e.currentTarget.checked)}
          />
          <AlertCircle size={15} className={values.important ? "text-[#f97316]" : "text-[#94a3b8]"} />
          <span className="font-['Inter'] text-[13px] font-medium text-[#0f3460]">
            Marquer comme important
          </span>
        </label>
      </form>
    </DialogShell>
  );
}
