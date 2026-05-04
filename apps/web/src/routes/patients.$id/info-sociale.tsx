import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import {
  Briefcase,
  Check,
  DollarSign,
  GraduationCap,
  Heart,
  Home,
  Leaf,
  PawPrint,
  Pencil,
  Plus,
  TriangleAlert,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { queryClient, trpc } from "@/utils/trpc";

export const Route = createFileRoute("/patients/$id/info-sociale")({
  component: RouteComponent,
});

type EditCardKey =
  | "profession"
  | "situation_familiale"
  | "nb_enfants"
  | "revenu_mensuel"
  | "foyer"
  | "niveau_intellectuel"
  | "habitudes_saines"
  | "habitudes_toxiques"
  | "environnement_animal"
  | "relations_environnement";

type EditFormState = {
  profession: string;
  situation_familiale: string;
  nb_enfants: string;
  revenu_mensuel: string;
  taille_menage: string;
  nb_pieces: string;
  niveau_intellectuel: string;
  habitudes_saines: string;
  habitudes_toxiques: string;
  environnement_animal: string;
  relations_environnement: string;
};

const EMPTY_FORM: EditFormState = {
  profession: "",
  situation_familiale: "",
  nb_enfants: "",
  revenu_mensuel: "",
  taille_menage: "",
  nb_pieces: "",
  niveau_intellectuel: "",
  habitudes_saines: "",
  habitudes_toxiques: "",
  environnement_animal: "",
  relations_environnement: "",
};

function RouteComponent() {
  const { id } = Route.useParams();

  const { data: fullRecord } = useSuspenseQuery(
    trpc.patient.getPatientFullRecord.queryOptions({ id }),
  );

  const patient = fullRecord.patient;

  const [editingCard, setEditingCard] = useState<EditCardKey | null>(null);
  const [formState, setFormState] = useState<EditFormState>(EMPTY_FORM);

  const updateMutation = useMutation(
    trpc.patient.updatePatient.mutationOptions({
      onSuccess: async () => {
        await Promise.all([
          queryClient.invalidateQueries(
            trpc.patient.getPatient.queryFilter({ id }),
          ),
          queryClient.invalidateQueries(
            trpc.patient.getPatientFullRecord.queryFilter({ id }),
          ),
        ]);
        toast.success("Informations sociales mises à jour");
        setEditingCard(null);
        setFormState(EMPTY_FORM);
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );

  const topCards = useMemo(
    () => [
      {
        key: "profession" as const,
        label: "Profession",
        icon: Briefcase,
        tone: "filled" as const,
        action: "edit" as const,
        value: formatTextValue(patient.profession),
      },
      {
        key: "situation_familiale" as const,
        label: "Situation familiale",
        icon: Heart,
        tone: "filled" as const,
        action: "edit" as const,
        value: formatTextValue(patient.situation_familiale),
      },
      {
        key: "nb_enfants" as const,
        label: "Nombre d'enfants",
        icon: Users,
        tone: "default" as const,
        action: "add" as const,
        value: formatNumberValue(patient.nb_enfants),
      },
      {
        key: "revenu_mensuel" as const,
        label: "Revenu mensuel",
        icon: DollarSign,
        tone: "default" as const,
        action: "edit" as const,
        value: formatRevenueValue(patient.revenu_mensuel),
      },
      {
        key: "foyer" as const,
        label: "Foyer",
        icon: Home,
        tone: "default" as const,
        action: "add" as const,
        value: null,
      },
      {
        key: "niveau_intellectuel" as const,
        label: "Niveau d'éducation",
        icon: GraduationCap,
        tone: "default" as const,
        action: "edit" as const,
        value: formatTextValue(patient.niveau_intellectuel),
      },
    ],
    [patient],
  );

  const habitCards = useMemo(
    () => [
      {
        key: "habitudes_saines" as const,
        label: "Habitudes saines",
        icon: Leaf,
        value: formatTextValue(patient.habitudes_saines),
      },
      {
        key: "habitudes_toxiques" as const,
        label: "Habitudes toxiques",
        icon: TriangleAlert,
        value: formatTextValue(patient.habitudes_toxiques),
      },
      {
        key: "environnement_animal" as const,
        label: "Environnement animal",
        icon: PawPrint,
        value: formatTextValue(patient.environnement_animal),
      },
      {
        key: "relations_environnement" as const,
        label: "Relations environnementales",
        icon: Users,
        value: formatTextValue(patient.relations_environnement),
      },
    ],
    [patient],
  );

  const beginEdit = (card: EditCardKey) => {
    setEditingCard(card);
    setFormState({
      profession: patient.profession ?? "",
      situation_familiale: patient.situation_familiale ?? "",
      nb_enfants: toInputValue(patient.nb_enfants),
      revenu_mensuel: toInputValue(patient.revenu_mensuel),
      taille_menage: toInputValue(patient.taille_menage),
      nb_pieces: toInputValue(patient.nb_pieces),
      niveau_intellectuel: patient.niveau_intellectuel ?? "",
      habitudes_saines: patient.habitudes_saines ?? "",
      habitudes_toxiques: patient.habitudes_toxiques ?? "",
      environnement_animal: patient.environnement_animal ?? "",
      relations_environnement: patient.relations_environnement ?? "",
    });
  };

  const cancelEdit = () => {
    setEditingCard(null);
    setFormState(EMPTY_FORM);
  };

  const saveCard = (card: EditCardKey) => {
    const data: Record<string, number | string | boolean | null> = {};

    if (card === "profession") {
      data.profession = normalizeTextInput(formState.profession);
    }

    if (card === "situation_familiale") {
      data.situation_familiale = normalizeTextInput(
        formState.situation_familiale,
      );
    }

    if (card === "nb_enfants") {
      const parsed = parseNullableInteger(formState.nb_enfants);
      if (parsed === INVALID_NUMBER) {
        toast.error("Veuillez saisir un nombre d'enfants valide.");
        return;
      }
      data.nb_enfants = parsed;
    }

    if (card === "revenu_mensuel") {
      const parsed = normalizeNullableDecimal(formState.revenu_mensuel);
      if (parsed === INVALID_NUMBER) {
        toast.error("Veuillez saisir un revenu mensuel valide.");
        return;
      }
      data.revenu_mensuel = parsed;
    }

    if (card === "foyer") {
      const householdSize = parseNullableInteger(formState.taille_menage);
      if (householdSize === INVALID_NUMBER) {
        toast.error("Veuillez saisir une taille de ménage valide.");
        return;
      }

      const roomCount = parseNullableInteger(formState.nb_pieces);
      if (roomCount === INVALID_NUMBER) {
        toast.error("Veuillez saisir un nombre de pièces valide.");
        return;
      }

      data.taille_menage = householdSize;
      data.nb_pieces = roomCount;
    }

    if (card === "niveau_intellectuel") {
      data.niveau_intellectuel = normalizeTextInput(formState.niveau_intellectuel);
    }

    if (card === "habitudes_saines") {
      data.habitudes_saines = normalizeTextInput(formState.habitudes_saines);
    }

    if (card === "habitudes_toxiques") {
      data.habitudes_toxiques = normalizeTextInput(formState.habitudes_toxiques);
    }

    if (card === "environnement_animal") {
      data.environnement_animal = normalizeTextInput(formState.environnement_animal);
    }

    if (card === "relations_environnement") {
      data.relations_environnement = normalizeTextInput(
        formState.relations_environnement,
      );
    }

    updateMutation.mutate({ id, data });
  };

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-[14px] border-[0.8px] border-[#c2e0ef] bg-white px-4 py-5 shadow-[0px_4px_6px_0px_rgba(118,187,221,0.2),0px_2px_4px_0px_rgba(118,187,221,0.2)] sm:px-[24.8px] sm:pt-[24.8px]">
        <div className="mb-6 flex items-center gap-[8px]">
          <Home className="size-5 shrink-0 text-[#052ca0]" />
          <h2 className="font-['Inter'] text-[20px] font-medium leading-7 text-[#052ca0]">
            Informations sociales
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {topCards.map((card) => (
            <InfoCard
              key={card.key}
              label={card.label}
              icon={card.icon}
              tone={card.tone}
              action={card.action}
              isEditing={editingCard === card.key}
              onEdit={() => beginEdit(card.key)}
              onCancel={cancelEdit}
              onSave={() => saveCard(card.key)}
              isSaving={updateMutation.isPending}
            >
              {renderPrimaryCardBody({
                cardKey: card.key,
                cardValue: card.value,
                isEditing: editingCard === card.key,
                patient,
                formState,
                setFormState,
              })}
            </InfoCard>
          ))}
        </div>
      </section>

      <section className="rounded-[14px] border-[0.8px] border-[#c2e0ef] bg-white px-4 py-5 shadow-[0px_4px_6px_0px_rgba(118,187,221,0.2),0px_2px_4px_0px_rgba(118,187,221,0.2)] sm:px-[24.8px] sm:pt-[24.8px]">
        <div className="mb-6 flex items-center gap-[8px]">
          <Leaf className="size-5 shrink-0 text-[#052ca0]" />
          <h2 className="font-['Inter'] text-[20px] font-medium leading-7 text-[#052ca0]">
            Mode de vie et environnement
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {habitCards.map((card) => (
            <HabitCard
              key={card.key}
              label={card.label}
              icon={card.icon}
              value={card.value}
              isEditing={editingCard === card.key}
              onEdit={() => beginEdit(card.key)}
              onCancel={cancelEdit}
              onSave={() => saveCard(card.key)}
              isSaving={updateMutation.isPending}
            >
              <textarea
                rows={3}
                value={formState[card.key]}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    [card.key]: event.target.value,
                  }))
                }
                className="min-h-[84px] w-full resize-none rounded-[10px] border border-[#c2e0ef] bg-white px-3 py-2 font-['Inter'] text-[14px] leading-5 text-[#0f3460] outline-none transition focus:border-[#76bbdd] focus:ring-2 focus:ring-[#c2e0ef]/50"
              />
            </HabitCard>
          ))}
        </div>
      </section>
    </div>
  );
}

function renderPrimaryCardBody({
  cardKey,
  cardValue,
  isEditing,
  patient,
  formState,
  setFormState,
}: {
  cardKey: EditCardKey;
  cardValue: string | null;
  isEditing: boolean;
  patient: {
    taille_menage?: number | null;
    nb_pieces?: number | null;
  };
  formState: EditFormState;
  setFormState: Dispatch<SetStateAction<EditFormState>>;
}) {
  if (cardKey === "nb_enfants") {
    if (!isEditing) {
      return (
        <p className="font-['Inter'] text-[18px] leading-[28px] text-[#0f3460]">
          {cardValue ?? "—"}
        </p>
      );
    }

    return (
      <NumberCardEditor
        value={formState.nb_enfants}
        onChange={(value) =>
          setFormState((current) => ({ ...current, nb_enfants: value }))
        }
        displayValue={cardValue ?? "—"}
      />
    );
  }

  if (cardKey === "foyer") {
    if (!isEditing) {
      return (
        <div className="grid grid-cols-2 gap-4">
          <p className="font-['Poppins'] text-[18px] leading-[28px] text-[#0f3460]">
            {formatHouseholdValue(patient.taille_menage)} personnes
          </p>
          <p className="font-['Poppins'] text-[18px] leading-[28px] text-[#0f3460]">
            {formatRoomValue(patient.nb_pieces)} pièces
          </p>
        </div>
      );
    }

    return (
      <HouseholdEditor
        householdSize={formState.taille_menage}
        roomCount={formState.nb_pieces}
        onHouseholdSizeChange={(value) =>
          setFormState((current) => ({ ...current, taille_menage: value }))
        }
        onRoomCountChange={(value) =>
          setFormState((current) => ({ ...current, nb_pieces: value }))
        }
        displayHouseholdSize={formatHouseholdValue(patient.taille_menage)}
        displayRoomCount={formatRoomValue(patient.nb_pieces)}
      />
    );
  }

  if (cardKey === "revenu_mensuel") {
    if (!isEditing) {
      return (
        <p className="font-['Poppins'] text-[14px] leading-[20px] text-[#0f3460]">
          {cardValue ?? "—"}
        </p>
      );
    }

    return (
      <input
        type="text"
        inputMode="decimal"
        value={formState.revenu_mensuel}
        onChange={(event) =>
          setFormState((current) => ({
            ...current,
            revenu_mensuel: event.target.value.replace(/[^\d.,]/g, ""),
          }))
        }
        className="h-10 w-full rounded-[8px] border border-[#c2e0ef] bg-white px-3 font-['Inter'] text-[14px] leading-5 text-[#0f3460] outline-none transition focus:border-[#76bbdd]"
      />
    );
  }

  if (
    cardKey === "profession" ||
    cardKey === "situation_familiale" ||
    cardKey === "niveau_intellectuel"
  ) {
    if (!isEditing) {
      return (
        <p className="font-['Poppins'] text-[14px] leading-[20px] text-[#0f3460]">
          {cardValue ?? "—"}
        </p>
      );
    }

    return (
      <input
        type="text"
        value={formState[cardKey]}
        onChange={(event) =>
          setFormState((current) => ({
            ...current,
            [cardKey]: event.target.value,
          }))
        }
        className="h-10 w-full rounded-[8px] border border-[#c2e0ef] bg-white px-3 font-['Inter'] text-[14px] leading-5 text-[#0f3460] outline-none transition focus:border-[#76bbdd]"
      />
    );
  }

  return (
    <p className="font-['Poppins'] text-[14px] leading-[20px] text-[#0f3460]">
      {cardValue ?? "—"}
    </p>
  );
}

function InfoCard({
  label,
  icon: Icon,
  tone,
  action,
  isEditing,
  onEdit,
  onCancel,
  onSave,
  isSaving,
  children,
}: {
  label: string;
  icon: LucideIcon;
  tone: "filled" | "default";
  action: "edit" | "add";
  isEditing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  isSaving: boolean;
  children: ReactNode;
}) {
  if (!isEditing) {
    return (
      <div
        className={`rounded-[10px] border-[0.8px] border-[#76bbdd] bg-[#f8fafc] px-4 py-4 ${cardKeyClassName(action, tone)}`}
      >
        <div className="flex h-[24px] items-center gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-[11px] bg-[#eef8fd] text-[#052ca0]">
            <Icon className="size-4" strokeWidth={1.8} />
          </span>
          <p className="font-['Plus_Jakarta_Sans'] text-[13px] font-semibold leading-[20px] text-[#7a93af]">
            {label}
          </p>
        </div>

        <div className="mt-2 min-h-[21px]">
          <ReadOnlyPrimaryContent action={action} onEdit={onEdit}>
            {children}
          </ReadOnlyPrimaryContent>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[10px] border-[0.8px] border-[#76bbdd] bg-[#f8fafc] px-4 py-4">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-[11px] bg-[#eef8fd] text-[#052ca0]">
            <Icon className="size-4" strokeWidth={1.8} />
          </span>
          <p className="font-['Plus_Jakarta_Sans'] text-[13px] font-semibold leading-[20px] text-[#7a93af]">
            {label}
          </p>
        </div>

        {isEditing ? (
          <EditActions
            compact={tone === "filled"}
            isSaving={isSaving}
            onCancel={onCancel}
            onSave={onSave}
          />
        ) : null}
      </div>

      <div className="min-h-[36px]">{children}</div>
    </div>
  );
}

function HabitCard({
  label,
  icon: Icon,
  value,
  isEditing,
  onEdit,
  onCancel,
  onSave,
  isSaving,
  children,
}: {
  label: string;
  icon: LucideIcon;
  value: string;
  isEditing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  isSaving: boolean;
  children: ReactNode;
}) {
  const valueClassName =
    isNoneLikeValue(value) && value !== "—" ? "text-[#f97316]" : "text-[#0f3460]";

  if (!isEditing) {
    return (
    <div className="rounded-[10px] border-[0.8px] border-[#76bbdd] bg-[#f8fafc] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-[12px] bg-[#eef8fd] text-[#052ca0]">
              <Icon className="size-4" strokeWidth={1.8} />
            </span>
            <p className="font-['Plus_Jakarta_Sans'] text-[14px] font-semibold leading-[20px] text-[#0f3460]">
              {label}
            </p>
          </div>
          <p className={`mt-1 font-['Inter'] text-[14px] leading-5 ${valueClassName}`}>
            {value}
          </p>
        </div>
        <ReadOnlyEditButton onClick={onEdit} />
      </div>
    </div>
    );
  }

  return (
    <div className="rounded-[10px] border-[0.8px] border-[#76bbdd] bg-[#f8fafc] p-4">
      <div className="mb-1 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-[12px] bg-[#eef8fd] text-[#052ca0]">
            <Icon className="size-4" strokeWidth={1.8} />
          </span>
          <p className="font-['Plus_Jakarta_Sans'] text-[14px] font-semibold leading-[20px] text-[#0f3460]">
            {label}
          </p>
        </div>

        {isEditing ? (
          <EditActions
            compact={false}
            isSaving={isSaving}
            onCancel={onCancel}
            onSave={onSave}
          />
        ) : null}
      </div>

      {isEditing ? (
        children
      ) : (
        <p className={`font-['Inter'] text-[14px] leading-5 ${valueClassName}`}>
          {value}
        </p>
      )}
    </div>
  );
}

function EditActions({
  compact,
  isSaving,
  onCancel,
  onSave,
}: {
  compact: boolean;
  isSaving: boolean;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={onCancel}
        disabled={isSaving}
        className={`inline-flex items-center justify-center rounded-[8px] border border-[#f97316] bg-white text-[#f97316] transition hover:bg-[#fff7ed] disabled:cursor-not-allowed disabled:opacity-60 ${
          compact ? "size-6" : "h-8 px-3"
        }`}
      >
        <X className="size-3.5" />
        {compact ? null : <span className="ml-1 text-[12px] font-medium">Annuler</span>}
      </button>
      <button
        type="button"
        onClick={onSave}
        disabled={isSaving}
        className={`inline-flex items-center justify-center rounded-[8px] bg-[#052ca0] text-white shadow-[0px_2px_4px_0px_rgba(118,187,221,0.28)] transition hover:bg-[#0a36bc] disabled:cursor-not-allowed disabled:opacity-60 ${
          compact ? "size-6" : "h-8 px-3"
        }`}
      >
        <Check className="size-3.5" />
        {compact ? null : <span className="ml-1 text-[12px] font-medium">OK</span>}
      </button>
    </div>
  );
}

function ActionTrigger({
  action,
  onClick,
}: {
  action: "edit" | "add";
  onClick: () => void;
}) {
  if (action === "add") {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label="Ajouter"
        className="inline-flex size-5 items-center justify-center rounded-[8px] border-[0.7px] border-[#0f3460] text-[#0f3460] transition hover:bg-white/60"
      >
        <Plus className="size-3.5" strokeWidth={2.2} />
      </button>
    );
  }

  return (
    <ReadOnlyEditButton onClick={onClick} />
  );
}

function ReadOnlyPrimaryContent({
  action,
  onEdit,
  children,
}: {
  action: "edit" | "add";
  onEdit: () => void;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">{children}</div>
      {action === "edit" ? (
        <ReadOnlyEditButton onClick={onEdit} />
      ) : (
        <ActionTrigger action={action} onClick={onEdit} />
      )}
    </div>
  );
}

function ReadOnlyEditButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Modifier"
      className="inline-flex size-[23px] shrink-0 items-center justify-center rounded-[7px] text-[#f97316] transition hover:bg-white/60"
    >
      <Pencil className="size-[18px]" strokeWidth={2.1} />
    </button>
  );
}

function cardKeyClassName(action: "edit" | "add", tone: "filled" | "default") {
  if (tone === "filled") {
    return "min-h-[80px]";
  }

  return action === "add" ? "min-h-[81.6px]" : "min-h-[81.6px]";
}

function NumberCardEditor({
  value,
  onChange,
  displayValue,
}: {
  value: string;
  onChange: (value: string) => void;
  displayValue: string;
}) {
  return (
    <NumberStepperInput
      value={value}
      onChange={onChange}
      displayValue={displayValue}
      suffix=""
    />
  );
}

function HouseholdEditor({
  householdSize,
  roomCount,
  onHouseholdSizeChange,
  onRoomCountChange,
  displayHouseholdSize,
  displayRoomCount,
}: {
  householdSize: string;
  roomCount: string;
  onHouseholdSizeChange: (value: string) => void;
  onRoomCountChange: (value: string) => void;
  displayHouseholdSize: string;
  displayRoomCount: string;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <NumberStepperInput
        value={householdSize}
        onChange={onHouseholdSizeChange}
        displayValue={displayHouseholdSize}
        suffix="personnes"
      />
      <NumberStepperInput
        value={roomCount}
        onChange={onRoomCountChange}
        displayValue={displayRoomCount}
        suffix="pièces"
      />
    </div>
  );
}

function NumberStepperInput({
  value,
  onChange,
  displayValue,
  suffix,
}: {
  value: string;
  onChange: (value: string) => void;
  displayValue: string;
  suffix: string;
}) {
  const adjustValue = (delta: number) => {
    const current = value.trim();
    const parsed = current === "" ? 0 : Number.parseInt(current, 10);
    const safeValue = Number.isNaN(parsed) ? 0 : parsed;
    onChange(String(Math.max(0, safeValue + delta)));
  };

  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="flex h-10 min-w-0 flex-1 overflow-hidden rounded-[8px] border border-[#c2e0ef] bg-white">
        <input
          type="text"
          inputMode="numeric"
          value={value}
          onChange={(event) => onChange(event.target.value.replace(/[^\d]/g, ""))}
          className="min-w-0 flex-1 bg-transparent px-3 font-['Inter'] text-[14px] leading-5 text-[#0f3460] outline-none"
        />
        <button
          type="button"
          onClick={() => adjustValue(1)}
          className="flex w-10 shrink-0 items-center justify-center border-l border-[#c2e0ef] text-[#0f3460] transition hover:bg-[#eaf4f9]"
          aria-label={`Augmenter ${suffix || "la valeur"}`}
        >
          <Plus className="size-4" strokeWidth={2.2} />
        </button>
      </div>
      <span className="whitespace-nowrap font-['Poppins'] text-[14px] leading-[20px] text-[#0f3460]">
        {displayValue}
        {suffix ? ` ${suffix}` : ""}
      </span>
    </div>
  );
}

function formatTextValue(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : "—";
}

function formatNumberValue(value: number | null | undefined) {
  return value === null || value === undefined ? "—" : String(value);
}

function formatHouseholdValue(value: number | null | undefined) {
  return value === null || value === undefined ? "—" : String(value);
}

function formatRoomValue(value: number | null | undefined) {
  return value === null || value === undefined ? "—" : String(value);
}

function formatRevenueValue(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "N/A";
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return String(value);
  return `${numeric.toLocaleString("fr-FR")} DA`;
}

function toInputValue(value: number | string | null | undefined) {
  return value === null || value === undefined ? "" : String(value);
}

function normalizeTextInput(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeNullableDecimal(value: string) {
  const trimmed = value.trim().replace(",", ".");
  if (trimmed.length === 0) return null;
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return INVALID_NUMBER;
  return trimmed;
}

function isNoneLikeValue(value: string) {
  return /^(aucun|aucune|non|neant|n[ée]ant|ras)$/i.test(value.trim());
}

const INVALID_NUMBER = Symbol("invalid-number");

function parseNullableInteger(value: string) {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (!/^\d+$/.test(trimmed)) return INVALID_NUMBER;
  return Number.parseInt(trimmed, 10);
}
