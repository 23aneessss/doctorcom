import { redirect } from "@tanstack/react-router";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { Check, ChevronDown, ChevronUp, Pencil, Plus, User, X } from "lucide-react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { queryClient, trpc } from "@/utils/trpc";

export const Route = createFileRoute("/patients/$id/sante-feminine")({
  beforeLoad: async ({ context, params }) => {
    const { trpc, queryClient } = context;
    try {
      const patient = await queryClient.ensureQueryData(
        trpc.patient.getPatient.queryOptions({ id: params.id }),
      );
      const { isFemaleSex } = await import("@/lib/patient-sex");
      if (!isFemaleSex(patient.sexe)) {
        throw redirect({
          to: "/patients/$id/general",
          params: { id: params.id },
          replace: true,
        });
      }
    } catch {
      throw redirect({
        to: "/patients/$id/general",
        params: { id: params.id },
        replace: true,
      });
    }
  },
  component: SanteFeminineView,
});

type EditCardKey =
  | "menarche"
  | "regularite_cycles"
  | "contraception"
  | "nb_grossesses"
  | "nb_cesariennes"
  | "menopause";

type EditFormState = {
  menarche: string;
  regularite_cycles: string;
  contraception: string;
  nb_grossesses: string;
  nb_cesariennes: string;
  menopause: "" | "true" | "false";
  age_menopause: string;
  symptomes_menopause: string;
};

const EMPTY_FORM: EditFormState = {
  menarche: "",
  regularite_cycles: "",
  contraception: "",
  nb_grossesses: "",
  nb_cesariennes: "",
  menopause: "",
  age_menopause: "",
  symptomes_menopause: "",
};

function SanteFeminineView() {
  const { id } = Route.useParams();

  const { data: fullRecord } = useSuspenseQuery(
    trpc.patient.getPatientFullRecord.queryOptions({ id }),
  );

  const femaleInfo = fullRecord.patient.female_info;

  const [editingCard, setEditingCard] = useState<EditCardKey | null>(null);
  const [formState, setFormState] = useState<EditFormState>(EMPTY_FORM);

  const updateMutation = useMutation(
    trpc.patient.updatePatient.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries(
          trpc.patient.getPatientFullRecord.queryFilter({ id }),
        );
        toast.success("Informations mises à jour");
        setEditingCard(null);
        setFormState(EMPTY_FORM);
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );

  const cards = useMemo(
    () => [
      {
        key: "menarche" as const,
        label: "Âge de la ménarche",
        value: formatWithSuffix(femaleInfo?.menarche, "ans"),
        action: "edit" as const,
      },
      {
        key: "regularite_cycles" as const,
        label: "Régularité du cycle",
        value: formatTextValue(femaleInfo?.regularite_cycles),
        action: "edit" as const,
      },
      {
        key: "contraception" as const,
        label: "Contraception",
        value: formatTextValue(femaleInfo?.contraception),
        action: "edit" as const,
      },
      {
        key: "nb_grossesses" as const,
        label: "Grossesses",
        value: formatNumberValue(femaleInfo?.nb_grossesses),
        action: "add" as const,
      },
      {
        key: "nb_cesariennes" as const,
        label: "Césariennes",
        value: formatNumberValue(femaleInfo?.nb_cesariennes),
        action: "add" as const,
      },
      {
        key: "menopause" as const,
        label: "Statut ménopause",
        value: formatMenopauseValue(femaleInfo?.menopause),
        action: "edit" as const,
      },
    ],
    [femaleInfo],
  );

  const beginEdit = (card: EditCardKey) => {
    setEditingCard(card);
    setFormState({
      menarche: toInputValue(femaleInfo?.menarche),
      regularite_cycles: femaleInfo?.regularite_cycles ?? "",
      contraception: femaleInfo?.contraception ?? "",
      nb_grossesses: toInputValue(femaleInfo?.nb_grossesses),
      nb_cesariennes: toInputValue(femaleInfo?.nb_cesariennes),
      menopause:
        femaleInfo?.menopause === true
          ? "true"
          : femaleInfo?.menopause === false
            ? "false"
            : "",
      age_menopause: toInputValue(femaleInfo?.age_menopause),
      symptomes_menopause: femaleInfo?.symptomes_menopause ?? "",
    });
  };

  const cancelEdit = () => {
    setEditingCard(null);
    setFormState(EMPTY_FORM);
  };

  const saveCard = (card: EditCardKey) => {
    const femaleData: Record<string, string | number | boolean | null> = {};

    if (card === "menarche") {
      const parsed = parseNullableInteger(formState.menarche);
      if (parsed === INVALID_NUMBER) {
        toast.error("Veuillez saisir un âge valide.");
        return;
      }
      femaleData.menarche = parsed;
    }

    if (card === "regularite_cycles") {
      femaleData.regularite_cycles = normalizeTextInput(formState.regularite_cycles);
    }

    if (card === "contraception") {
      femaleData.contraception = normalizeTextInput(formState.contraception);
    }

    if (card === "nb_grossesses") {
      const parsed = parseNullableInteger(formState.nb_grossesses);
      if (parsed === INVALID_NUMBER) {
        toast.error("Veuillez saisir un nombre de grossesses valide.");
        return;
      }
      femaleData.nb_grossesses = parsed;
    }

    if (card === "nb_cesariennes") {
      const parsed = parseNullableInteger(formState.nb_cesariennes);
      if (parsed === INVALID_NUMBER) {
        toast.error("Veuillez saisir un nombre de césariennes valide.");
        return;
      }
      femaleData.nb_cesariennes = parsed;
    }

    if (card === "menopause") {
      const menopauseValue =
        formState.menopause === "true"
          ? true
          : formState.menopause === "false"
            ? false
            : null;

      femaleData.menopause = menopauseValue;

      if (menopauseValue === true) {
        const parsedAge = parseNullableInteger(formState.age_menopause);
        if (parsedAge === INVALID_NUMBER) {
          toast.error("Veuillez saisir un âge de ménopause valide.");
          return;
        }

        femaleData.age_menopause = parsedAge;
        femaleData.symptomes_menopause = normalizeTextInput(
          formState.symptomes_menopause,
        );
      } else {
        femaleData.age_menopause = null;
        femaleData.symptomes_menopause = null;
      }
    }

    updateMutation.mutate({
      id,
      data: { female_data: femaleData },
    });
  };

  return (
    <div className="rounded-[14px] border-[0.8px] border-[#c2e0ef] bg-white px-[24.8px] pb-6 pt-[24.8px] shadow-[0px_4px_6px_0px_rgba(118,187,221,0.2),0px_2px_4px_0px_rgba(118,187,221,0.2)]">
      <div className="mb-10 flex items-center gap-2">
        <User className="size-5 text-[#052ca0]" />
        <h2 className="font-['Plus_Jakarta_Sans'] text-[20px] font-medium leading-[28px] text-[#052ca0]">
          Santé Féminine
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 xl:gap-x-4 xl:gap-y-[16px]">
        {cards.map((card) => {
          const isEditing = editingCard === card.key;

          return (
            <FemaleInfoCard
              key={card.key}
              label={card.label}
              action={card.action}
              isEditing={isEditing}
              onEdit={() => beginEdit(card.key)}
              onSave={() => saveCard(card.key)}
              onCancel={cancelEdit}
              isSaving={updateMutation.isPending}
            >
              {renderCardBody({
                cardKey: card.key,
                cardValue: card.value,
                femaleInfo,
                formState,
                setFormState,
                isEditing,
              })}
            </FemaleInfoCard>
          );
        })}
      </div>
    </div>
  );
}

function renderCardBody({
  cardKey,
  cardValue,
  femaleInfo,
  formState,
  setFormState,
  isEditing,
}: {
  cardKey: EditCardKey;
  cardValue: string;
  femaleInfo: {
    menarche?: number | null;
    regularite_cycles?: string | null;
    contraception?: string | null;
    nb_grossesses?: number | null;
    nb_cesariennes?: number | null;
    menopause?: boolean | null;
    age_menopause?: number | null;
    symptomes_menopause?: string | null;
  } | null;
  formState: EditFormState;
  setFormState: Dispatch<SetStateAction<EditFormState>>;
  isEditing: boolean;
}) {
  if (cardKey === "menopause") {
    if (isEditing) {
      const showDetails = formState.menopause === "true";
      return (
        <div className="flex flex-col gap-3">
          <select
            value={formState.menopause}
            onChange={(event) =>
              setFormState((current) => ({
                ...current,
                menopause: event.target.value as EditFormState["menopause"],
              }))
            }
            className="h-10 rounded-[8px] border border-[#c2e0ef] bg-white px-3 font-['Inter'] text-[14px] leading-5 text-[#0f3460] outline-none transition focus:border-[#76bbdd]"
          >
            <option value="">Non renseigné</option>
            <option value="true">Oui</option>
            <option value="false">Non</option>
          </select>
          {showDetails && (
            <>
              <input
                type="number"
                min="0"
                inputMode="numeric"
                placeholder="Âge de ménopause"
                value={formState.age_menopause}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    age_menopause: event.target.value,
                  }))
                }
                className="h-10 rounded-[8px] border border-[#c2e0ef] bg-white px-3 font-['Inter'] text-[14px] leading-5 text-[#0f3460] outline-none transition focus:border-[#76bbdd]"
              />
              <textarea
                rows={3}
                placeholder="Symptômes de ménopause"
                value={formState.symptomes_menopause}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    symptomes_menopause: event.target.value,
                  }))
                }
                className="min-h-[84px] resize-none rounded-[8px] border border-[#c2e0ef] bg-white px-3 py-2 font-['Inter'] text-[14px] leading-5 text-[#0f3460] outline-none transition focus:border-[#76bbdd]"
              />
            </>
          )}
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-2">
        <span className={badgeClassName(cardValue)}>{cardValue}</span>
        {femaleInfo?.menopause === true && (
          <div className="space-y-1 text-[12px] leading-[18px] text-[#5a7a9a]">
            <p className="font-['Inter']">
              Âge :{" "}
              <span className="font-medium text-[#0f3460]">
                {formatWithSuffix(femaleInfo.age_menopause, "ans")}
              </span>
            </p>
            <p className="font-['Inter'] break-words">
              Symptômes :{" "}
              <span className="text-[#0f3460]">
                {formatTextValue(femaleInfo.symptomes_menopause)}
              </span>
            </p>
          </div>
        )}
      </div>
    );
  }

  if (isEditing) {
    const isTextArea = cardKey === "contraception";
    const isNumber =
      cardKey === "menarche" ||
      cardKey === "nb_grossesses" ||
      cardKey === "nb_cesariennes";

    if (isTextArea) {
      return (
        <textarea
          rows={3}
          value={formState[cardKey]}
          onChange={(event) =>
            setFormState((current) => ({
              ...current,
              [cardKey]: event.target.value,
            }))
          }
          className="min-h-[84px] w-full resize-none rounded-[8px] border border-[#c2e0ef] bg-white px-3 py-2 font-['Inter'] text-[14px] leading-5 text-[#0f3460] outline-none transition focus:border-[#76bbdd]"
        />
      );
    }

    if (isNumber) {
      return (
        <NumberStepperInput
          value={formState[cardKey]}
          onChange={(value) =>
            setFormState((current) => ({ ...current, [cardKey]: value }))
          }
        />
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
    <p
      className={`font-['Inter'] text-[14px] leading-5 break-words ${
        cardValue === "-" ? "text-[#94a3b8]" : "text-[#0f3460]"
      }`}
    >
      {cardValue}
    </p>
  );
}

function NumberStepperInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const adjustValue = (delta: number) => {
    const current = value.trim();
    const parsed = current === "" ? 0 : Number.parseInt(current, 10);
    const safeValue = Number.isNaN(parsed) ? 0 : parsed;
    onChange(String(Math.max(0, safeValue + delta)));
  };

  return (
    <div className="flex h-10 w-full overflow-hidden rounded-[8px] border border-[#c2e0ef] bg-white">
      <input
        type="text"
        inputMode="numeric"
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/[^\d]/g, ""))}
        className="min-w-0 flex-1 bg-transparent px-3 font-['Inter'] text-[14px] leading-5 text-[#0f3460] outline-none"
      />
      <div className="flex w-8 flex-col border-l border-[#c2e0ef] bg-[#f8fafc]">
        <button
          type="button"
          onClick={() => adjustValue(1)}
          className="flex flex-1 items-center justify-center text-[#0f3460] transition hover:bg-[#eaf4f9]"
          aria-label="Augmenter la valeur"
        >
          <ChevronUp className="size-3" />
        </button>
        <button
          type="button"
          onClick={() => adjustValue(-1)}
          className="flex flex-1 items-center justify-center border-t border-[#c2e0ef] text-[#0f3460] transition hover:bg-[#eaf4f9]"
          aria-label="Diminuer la valeur"
        >
          <ChevronDown className="size-3" />
        </button>
      </div>
    </div>
  );
}

function ReadOnlyActionButton({
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
        className="inline-flex size-[22px] shrink-0 items-center justify-center rounded-[7px] border-[0.8px] border-[#c2e0ef] text-[#052ca0] transition hover:border-[#76bbdd] hover:bg-[#eef4ff]"
      >
        <Plus className="size-3.5" strokeWidth={2.2} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Modifier"
      className="inline-flex size-[23px] shrink-0 items-center justify-center rounded-[7px] text-[#f97316] transition hover:bg-[#fff7ed]"
    >
      <Pencil className="size-[15px]" strokeWidth={2.1} />
    </button>
  );
}

function FemaleInfoCard({
  label,
  action,
  isEditing,
  onEdit,
  onSave,
  onCancel,
  isSaving,
  children,
}: {
  label: string;
  action: "edit" | "add";
  isEditing: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  isSaving: boolean;
  children: ReactNode;
}) {
  return (
    <div className="rounded-[10px] border-[0.8px] border-[#76bbdd] bg-[#f8fafc] p-4">
      <div className="mb-2 flex items-start justify-between gap-3">
        <p className="font-['Plus_Jakarta_Sans'] text-[13px] font-semibold leading-5 text-[#7a93af]">
          {label}
        </p>
        {isEditing ? (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onCancel}
              disabled={isSaving}
              className="inline-flex size-[28px] items-center justify-center rounded-[8px] border border-[#fecaca] bg-white text-[#e11d48] transition hover:bg-[#fff1f2] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <X className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={isSaving}
              className="inline-flex size-[28px] items-center justify-center rounded-[8px] bg-[#052ca0] text-white shadow-[0px_2px_4px_0px_rgba(118,187,221,0.28)] transition hover:bg-[#0a36bc] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Check className="size-3.5" />
            </button>
          </div>
        ) : (
          <ReadOnlyActionButton action={action} onClick={onEdit} />
        )}
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

function formatTextValue(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : "-";
}

function formatNumberValue(value: number | null | undefined) {
  return value === null || value === undefined ? "-" : String(value);
}

function formatWithSuffix(value: number | null | undefined, suffix: string) {
  return value === null || value === undefined ? "-" : `${value} ${suffix}`;
}

function formatMenopauseValue(value: boolean | null | undefined) {
  if (value === true) return "Oui";
  if (value === false) return "Non";
  return "Non renseigné";
}

function badgeClassName(value: string) {
  if (value === "Oui") {
    return "inline-flex h-[21.587px] w-fit items-center rounded-[8px] border border-[#bbf7d0] bg-[#f0fdf4] px-2.5 font-['Inter'] text-[12px] font-medium leading-4 text-[#166534]";
  }

  if (value === "Non") {
    return "inline-flex h-[21.587px] w-fit items-center rounded-[8px] border border-[#d1d5dc] bg-[#f3f4f6] px-2.5 font-['Inter'] text-[12px] font-medium leading-4 text-[#364153]";
  }

  return "inline-flex h-[21.587px] w-fit items-center rounded-[8px] border border-[#cbd5e1] bg-white px-2.5 font-['Inter'] text-[12px] font-medium leading-4 text-[#64748b]";
}

function toInputValue(value: number | null | undefined) {
  return value === null || value === undefined ? "" : String(value);
}

function normalizeTextInput(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

const INVALID_NUMBER = Symbol("invalid-number");

function parseNullableInteger(value: string) {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (!/^\d+$/.test(trimmed)) return INVALID_NUMBER;
  return Number.parseInt(trimmed, 10);
}
