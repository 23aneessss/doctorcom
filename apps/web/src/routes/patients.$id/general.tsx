import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  Calendar,
  CalendarDays,
  Clock,
  Droplets,
  FileText,
  Heart,
  Pill,
  Ruler,
  Stethoscope,
  Syringe,
  Thermometer,
  User,
  Weight,
} from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/utils/trpc";

export const Route = createFileRoute("/patients/$id/general")({
  component: GeneralView,
  pendingComponent: GeneralSkeleton,
  pendingMs: 0,
});

function GeneralView() {
  const { id } = Route.useParams();

  const { data: fullRecord } = useSuspenseQuery(
    trpc.patient.getPatientFullRecord.queryOptions({ id })
  );
  const { data: profile } = useSuspenseQuery(
    trpc.patient.getPatientClinicalProfile.queryOptions({ id })
  );

  const lastExamen = profile.last_examen;
  const antecedents = fullRecord.antecedents;
  const vaccinations = fullRecord.vaccinations;
  const suivis = fullRecord.suivi;
  const ordonnances = fullRecord.ordonnances;
  const documents = fullRecord.documents;
  const rendezVous = fullRecord.rendez_vous;

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    return d.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  const formatDateShort = (dateStr: string | null) => {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    return d.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  const formatTime = (heure: string | null) => {
    if (!heure) return "";
    return heure;
  };

  const lastVaccin = vaccinations.length > 0 ? vaccinations[0] : null;
  const lastOrdonnance = ordonnances.length > 0 ? ordonnances[0] : null;

  const now = new Date();
  const upcomingRDV = rendezVous
    .filter((rdv) => new Date(rdv.date) >= now && (rdv.statut === "planifie" || rdv.statut === "confirme"))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <div className="flex gap-6 items-start">
      {/* Left Column */}
      <div className="flex-1 flex flex-col gap-6">
        {/* Vital Signs Card */}
        <div className="bg-white border-[0.8px] border-[#c2e0ef] rounded-[14px] px-6 pt-6 pb-6 shadow-[0px_4px_6px_0px_rgba(194,224,239,0.2),0px_2px_4px_0px_rgba(194,224,239,0.2)]">
          <div className="flex items-center gap-2 mb-5">
            <Activity className="size-5 text-[#052ca0]" />
            <h2 className="font-['Plus_Jakarta_Sans'] font-medium text-[20px] leading-[28px] text-[#052ca0]">
              Vital Signs (Latest)
            </h2>
          </div>

          <div className="flex flex-col gap-[19px]">
            <div className="flex gap-[19px]">
              <VitalCard
                icon={<Droplets className="size-4" />}
                label="Tension artérielle"
                value={lastExamen?.tension_arterielle ?? "—"}
              />
              <VitalCard
                icon={<Heart className="size-4" />}
                label="Fréquence cardiaque"
                value={
                  lastExamen?.frequence_cardiaque
                    ? `${lastExamen.frequence_cardiaque} bpm`
                    : "—"
                }
              />
              <VitalCard
                icon={<Thermometer className="size-4" />}
                label="Température"
                value={
                  lastExamen?.temperature
                    ? `${lastExamen.temperature}°C`
                    : "—"
                }
              />
              <VitalCard
                icon={<Activity className="size-4" />}
                label="SpO2"
                value={
                  lastExamen?.spo2
                    ? `${lastExamen.spo2}%`
                    : "—"
                }
              />
            </div>
            <div className="flex gap-[19px]">
              <VitalCard
                icon={<Weight className="size-4" />}
                label="Poids"
                value={
                  lastExamen?.poids ? `${lastExamen.poids} kg` : "—"
                }
              />
              <VitalCard
                icon={<Ruler className="size-4" />}
                label="Taille"
                value={
                  lastExamen?.taille ? `${lastExamen.taille} cm` : "—"
                }
              />
              <VitalCard
                icon={<User className="size-4" />}
                label="BMI"
                value={profile.imc ? String(profile.imc) : "—"}
              />
            </div>
          </div>
        </div>

        {/* Activité Récente Card */}
        <div className="bg-white border-[0.8px] border-[#c2e0ef] rounded-[14px] px-6 pt-6 pb-6 shadow-[0px_4px_6px_0px_rgba(194,224,239,0.2),0px_2px_4px_0px_rgba(194,224,239,0.2)]">
          <div className="flex items-center gap-2 mb-5">
            <Clock className="size-5 text-[#052ca0]" />
            <h2 className="font-['Plus_Jakarta_Sans'] font-medium text-[20px] leading-[28px] text-[#052ca0]">
              Activité Récente
            </h2>
          </div>

          <div className="flex flex-col gap-4">
            {suivis.length === 0 && ordonnances.length === 0 && documents.length === 0 ? (
              <p className="font-['Plus_Jakarta_Sans'] text-[14px] text-[rgba(100,116,139,0.9)]">
                Aucune activité récente
              </p>
            ) : (
              <>
                {suivis.map((s) => (
                  <ActivityGroup
                    key={`suivi-${s.id}`}
                    date={s.date_ouverture}
                    formatDate={formatDate}
                  >
                    <div className="flex items-center gap-1">
                      <Stethoscope className="size-[14px] text-[#265284]" />
                      <span className="font-['Plus_Jakarta_Sans'] font-medium text-[12px] leading-[16px] text-[#0f3460]">
                        Suivi de :
                      </span>
                      <span className="font-['Plus_Jakarta_Sans'] font-medium text-[12px] leading-[16px] text-[#f97316]">
                        {s.motif}
                      </span>
                    </div>
                    {s.hypothese_diagnostic && (
                      <p className="font-['Plus_Jakarta_Sans'] text-[14px] leading-[20px] text-[rgba(100,116,139,0.9)] pl-[18px]">
                        {s.hypothese_diagnostic}
                      </p>
                    )}
                  </ActivityGroup>
                ))}

                {ordonnances.map((ord) => (
                  <ActivityGroup
                    key={`ord-${ord.id}`}
                    date={ord.date_prescription}
                    formatDate={formatDate}
                  >
                    <div className="flex items-center gap-1">
                      <Pill className="size-[14px] text-[#265284]" />
                      <span className="font-['Poppins'] text-[14px] leading-[20px] text-[#0f3460]">
                        Ordonnance émise
                      </span>
                    </div>
                    {ord.remarques && (
                      <p className="font-['Plus_Jakarta_Sans'] text-[14px] leading-[20px] text-[rgba(100,116,139,0.9)] pl-[18px]">
                        {ord.remarques}
                      </p>
                    )}
                  </ActivityGroup>
                ))}

                {documents.map((doc) => (
                  <ActivityGroup
                    key={`doc-${doc.id}`}
                    date={doc.date_upload}
                    formatDate={formatDate}
                  >
                    <div className="flex items-center gap-1">
                      <FileText className="size-[14px] text-[#265284]" />
                      <span className="font-['Poppins'] text-[14px] leading-[20px] text-[#0f3460]">
                        {doc.type_document ?? "Document"}
                      </span>
                    </div>
                    {doc.description && (
                      <p className="font-['Plus_Jakarta_Sans'] text-[14px] leading-[20px] text-[rgba(100,116,139,0.9)] pl-[18px]">
                        {doc.description}
                      </p>
                    )}
                  </ActivityGroup>
                ))}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Right Column */}
      <div className="w-[360px] flex flex-col gap-6">
        {/* Info Rapide Patient Card */}
        <div className="bg-white border-[0.8px] border-[#c2e0ef] rounded-[14px] px-6 pt-6 pb-6 shadow-[0px_4px_6px_0px_rgba(194,224,239,0.2),0px_2px_4px_0px_rgba(194,224,239,0.2)]">
          <h2 className="font-['Plus_Jakarta_Sans'] font-medium text-[20px] leading-[28px] text-[#052ca0] mb-5">
            Info Rapide Patient
          </h2>

          <div className="flex flex-col gap-4">
            <QuickInfoRow
              iconBg="bg-[#f8fafc] border-[#052ca0] border-[0.5px]"
              icon={<CalendarDays className="size-5 text-[#052ca0]" />}
              label="Dernière visite"
              value={
                rendezVous.length > 0
                  ? formatDateShort(rendezVous.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]?.date ?? null)
                  : "—"
              }
              valueColor="text-[#052ca0]"
            />
            <QuickInfoRow
              iconBg="bg-[#f8fafc] border-[#052ca0] border-[0.5px]"
              icon={<Pill className="size-5 text-[#052ca0]" />}
              label="Ordonnances actives"
              value={`${ordonnances.length} ordonnance${ordonnances.length !== 1 ? "s" : ""}`}
              valueColor="text-[#052ca0]"
            />
            <QuickInfoRow
              iconBg="bg-[#f8fafc] border-[#052ca0] border-[0.5px]"
              icon={<Syringe className="size-5 text-[#052ca0]" />}
              label="Dernier vaccin"
              value={
                lastVaccin
                  ? `${lastVaccin.vaccin} (${formatDateShort(lastVaccin.date_vaccination)})`
                  : "—"
              }
              valueColor="text-[#052ca0]"
            />
            <QuickInfoRow
              iconBg="bg-[#ffedd4] border-[#f97316] border-[0.8px]"
              icon={<AlertTriangle className="size-5 text-[#f97316]" />}
              label="Allergies"
              value="Non renseigné"
              valueColor="text-[rgba(100,116,139,0.9)]"
            />
          </div>
        </div>

        {/* Rendez-vous à Venir Card */}
        <div className="bg-white border-[0.8px] border-[#c2e0ef] rounded-[14px] px-6 pt-6 pb-6 shadow-[0px_4px_6px_0px_rgba(194,224,239,0.2),0px_2px_4px_0px_rgba(194,224,239,0.2)]">
          <div className="flex items-center gap-2 mb-5">
            <Calendar className="size-5 text-[#052ca0]" />
            <h2 className="font-['Plus_Jakarta_Sans'] font-medium text-[20px] leading-[28px] text-[#052ca0]">
              Rendez-vous à Venir
            </h2>
          </div>

          <div className="flex flex-col gap-3">
            {upcomingRDV.length === 0 ? (
              <p className="font-['Plus_Jakarta_Sans'] text-[14px] text-[rgba(100,116,139,0.9)]">
                Aucun rendez-vous à venir
              </p>
            ) : (
              upcomingRDV.map((rdv) => (
                <div
                  key={rdv.id}
                  className="bg-[#f9fafb] border-[0.8px] border-[#c2e0ef] rounded-[10px] px-[15px] pt-[15px] pb-[15px]"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <CalendarDays className="size-[14px] text-[#0f3460]" />
                    <span className="font-['Plus_Jakarta_Sans'] text-[14px] leading-[20px] text-[#0f3460]">
                      {formatDateShort(rdv.date)}
                    </span>
                    <Clock className="size-[14px] text-[#0f3460] ml-auto" />
                    <span className="font-['Poppins'] text-[14px] leading-[20px] text-[#0f3460]">
                      {formatTime(rdv.heure)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Stethoscope className="size-[14px] text-[#265284]" />
                    <span className="font-['Plus_Jakarta_Sans'] font-medium text-[12px] leading-[16px] text-[#0f3460]">
                      Rendez-vous {rdv.statut === "planifie" ? "planifié" : "confirmé"}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ActivityGroup({
  date,
  formatDate,
  children,
}: {
  date: string | null;
  formatDate: (d: string | null) => string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="font-['Plus_Jakarta_Sans'] text-[12px] leading-[16px] text-[rgba(100,116,139,0.9)] tracking-[0.6px] uppercase mb-3">
        {formatDate(date)}
      </p>
      <div className="bg-[#f8fafc] border-[0.8px] border-[#c2e0ef] rounded-[10px] p-[15px] flex flex-col gap-[6px]">
        {children}
      </div>
    </div>
  );
}

function VitalCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-[#f8fafc] border-[0.8px] border-[#76bbdd] rounded-[10px] w-[140px] h-[80px] px-3 pt-[10px] pb-[7px] flex flex-col">
      <div className="flex items-center gap-[8px]">
        <div className="text-[#052ca0]">{icon}</div>
        <span className="font-['Plus_Jakarta_Sans'] text-[12px] leading-[16px] text-[#052ca0]">
          {label}
        </span>
      </div>
      <p className="font-['Poppins'] text-[18px] leading-[28px] text-[#0f3460] mt-auto">
        {value}
      </p>
    </div>
  );
}

function QuickInfoRow({
  iconBg,
  icon,
  label,
  value,
  valueColor,
}: {
  iconBg: string;
  icon: React.ReactNode;
  label: string;
  value: string;
  valueColor: string;
}) {
  return (
    <div className="flex items-center gap-[12px]">
      <div
        className={`${iconBg} rounded-[10px] size-[40px] flex items-center justify-center`}
      >
        {icon}
      </div>
      <div className="flex flex-col">
        <span className="font-['Plus_Jakarta_Sans'] text-[12px] leading-[16px] text-[#0f3460]">
          {label}
        </span>
        <span
          className={`font-['Poppins'] text-[14px] leading-[20px] ${valueColor}`}
        >
          {value}
        </span>
      </div>
    </div>
  );
}

function GeneralSkeleton() {
  return (
    <div className="flex items-start gap-6">
      <div className="flex flex-1 flex-col gap-6">
        <Skeleton className="h-[298px] rounded-[14px]" />
        <Skeleton className="h-[360px] rounded-[14px]" />
      </div>
      <div className="w-[360px] space-y-6">
        <Skeleton className="h-[286px] rounded-[14px]" />
        <Skeleton className="h-[286px] rounded-[14px]" />
      </div>
    </div>
  );
}
