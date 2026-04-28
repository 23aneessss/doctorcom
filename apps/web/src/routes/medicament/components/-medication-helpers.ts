import type { AppRouter } from "@doctor.com/api/routers/index";
import type { inferRouterOutputs } from "@trpc/server";

type RouterOutputs = inferRouterOutputs<AppRouter>;

export type MobileCatalogOutput = RouterOutputs["medicaments"]["searchMobileCatalog"];
export type MobileCatalogItem = MobileCatalogOutput["items"][number];
export type MobileMedicationDetail = RouterOutputs["medicaments"]["getMobileMedicamentById"];
export type MedicationAggregate = RouterOutputs["medicaments"]["getMedicamentById"];
export type MedicationAggregateRecord = MedicationAggregate["medicament"];
export type SearchMedicamentsOutput = RouterOutputs["medicaments"]["rechercherMedicaments"];
export type SearchMedicamentsItem = SearchMedicamentsOutput["items"][number];

export type MedicationCardViewModel = {
  id: number;
  name: string;
  scientificName: string;
  primaryTag: string;
};

export type MedicationFormValues = {
  nom_medicament: string;
  nom_generique: string;
  classe_therapeutique: string;
  famille_pharmacologique: string;
  posologie_adulte: string;
  posologie_enfant: string;
  dose_maximale: string;
  frequence_administration: string;
  grossesse: string;
  allaitement: string;
  substances_actives: string;
  indications: string;
  contre_indications: string;
  precautions: string;
  interactions: string;
  effets_indesirables: string;
  presentations: string;
};

export const EMPTY_MEDICATION_FORM_VALUES: MedicationFormValues = {
  nom_medicament: "",
  nom_generique: "",
  classe_therapeutique: "",
  famille_pharmacologique: "",
  posologie_adulte: "",
  posologie_enfant: "",
  dose_maximale: "",
  frequence_administration: "",
  grossesse: "",
  allaitement: "",
  substances_actives: "",
  indications: "",
  contre_indications: "",
  precautions: "",
  interactions: "",
  effets_indesirables: "",
  presentations: "",
};

function firstSegment(value: string | null | undefined) {
  return value?.split("||")[0]?.trim() ?? "";
}

export function getPrimaryCategory(value?: string | null, fallback?: string | null) {
  const source = firstSegment(value) || firstSegment(fallback) || "Autres";

  return source
    .replace(/^Classification pharmacothérapeutique VIDAL:\s*/i, "")
    .replace(/^Classification ATC:\s*/i, "")
    .split(">")[0]
    ?.trim() || "Autres";
}

export function getSecondaryCategory(primary: string, family?: string | null, classification?: string | null) {
  const familyRoot = firstSegment(family);
  if (familyRoot && familyRoot !== primary) {
    return familyRoot;
  }

  const classificationRoot = firstSegment(classification);
  if (classificationRoot && classificationRoot !== primary) {
    return classificationRoot;
  }

  return "Autres";
}

export function toCardFromMobileItem(item: MobileCatalogItem): MedicationCardViewModel {
  return {
    id: item.id,
    name: item.name,
    scientificName: item.genericName ?? item.name,
    primaryTag: item.category,
  };
}

export function toCardFromSearchItem(
  item: SearchMedicamentsItem,
  mobileMap?: Map<number, MobileCatalogItem>,
): MedicationCardViewModel {
  const mobile = mobileMap?.get(item.id);
  if (mobile) {
    return toCardFromMobileItem(mobile);
  }

  return {
    id: item.id,
    name: item.nom_medicament,
    scientificName: item.nom_generique ?? item.nom_medicament,
    primaryTag: getPrimaryCategory(item.classe_therapeutique, item.famille_pharmacologique),
  };
}

function joinLines(values: string[]) {
  return values.filter(Boolean).join("\n");
}

export function aggregateToFormValues(aggregate: MedicationAggregate): MedicationFormValues {
  return {
    nom_medicament: aggregate.medicament.nom_medicament ?? "",
    nom_generique: aggregate.medicament.nom_generique ?? "",
    classe_therapeutique: aggregate.medicament.classe_therapeutique ?? "",
    famille_pharmacologique: aggregate.medicament.famille_pharmacologique ?? "",
    posologie_adulte: aggregate.medicament.posologie_adulte ?? "",
    posologie_enfant: aggregate.medicament.posologie_enfant ?? "",
    dose_maximale: aggregate.medicament.dose_maximale ?? "",
    frequence_administration: aggregate.medicament.frequence_administration ?? "",
    grossesse: aggregate.medicament.grossesse ?? "",
    allaitement: aggregate.medicament.allaitement ?? "",
    substances_actives: joinLines(aggregate.substances_actives.map((item) => item.nom_substance)),
    indications: joinLines(aggregate.indications.map((item) => item.indication)),
    contre_indications: joinLines(aggregate.contre_indications.map((item) => item.description)),
    precautions: joinLines(aggregate.precautions.map((item) => item.description)),
    interactions: joinLines(
      aggregate.interactions.map((item) => item.medicament_interaction),
    ),
    effets_indesirables: joinLines(
      aggregate.effets_indesirables.map((item) =>
        item.frequence ? `${item.effet} | ${item.frequence}` : item.effet,
      ),
    ),
    presentations: joinLines(
      aggregate.presentations.map((item) => {
        if (item.forme && item.dosage) {
          return `${item.forme} | ${item.dosage}`;
        }

        return item.forme ?? item.dosage ?? "";
      }),
    ),
  };
}

function splitLines(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function parseSubstances(value: string) {
  return splitLines(value).map((line) => ({ nom_substance: line }));
}

export function parseIndications(value: string) {
  return splitLines(value).map((line) => ({ indication: line }));
}

export function parseDescriptions(value: string) {
  return splitLines(value).map((line) => ({ description: line }));
}

export function parseInteractions(value: string) {
  return splitLines(value).map((line) => ({ medicament_interaction: line }));
}

export function parseSideEffects(value: string) {
  return splitLines(value).map((line) => {
    const [effect, frequency] = line.split("|").map((part) => part.trim());
    return {
      effet: effect ?? "",
      frequence: frequency || null,
    };
  });
}

export function parsePresentations(value: string) {
  return splitLines(value).map((line) => {
    const [forme, dosage] = line.split("|").map((part) => part.trim());
    return {
      forme: forme || null,
      dosage: dosage || null,
    };
  });
}

export function buildCreatePayload(values: MedicationFormValues) {
  return {
    nom_medicament: values.nom_medicament.trim(),
    nom_generique: values.nom_generique.trim() || null,
    classe_therapeutique: values.classe_therapeutique.trim() || null,
    famille_pharmacologique: values.famille_pharmacologique.trim() || null,
    posologie_adulte: values.posologie_adulte.trim() || null,
    posologie_enfant: values.posologie_enfant.trim() || null,
    dose_maximale: values.dose_maximale.trim() || null,
    frequence_administration: values.frequence_administration.trim() || null,
    grossesse: values.grossesse.trim() || null,
    allaitement: values.allaitement.trim() || null,
    substances_actives: parseSubstances(values.substances_actives),
    indications: parseIndications(values.indications),
    contre_indications: parseDescriptions(values.contre_indications),
    precautions: parseDescriptions(values.precautions),
    interactions: parseInteractions(values.interactions),
    effets_indesirables: parseSideEffects(values.effets_indesirables),
    presentations: parsePresentations(values.presentations),
  };
}

export function buildUpdatePayload(values: MedicationFormValues, initialValues: MedicationFormValues) {
  const payload: Record<string, unknown> = {};

  const maybeAssign = (key: keyof MedicationFormValues, targetKey = key) => {
    if (values[key].trim() !== initialValues[key].trim()) {
      payload[targetKey] = values[key].trim() || null;
    }
  };

  if (values.nom_medicament.trim() !== initialValues.nom_medicament.trim()) {
    payload.nom_medicament = values.nom_medicament.trim();
  }

  maybeAssign("nom_generique");
  maybeAssign("classe_therapeutique");
  maybeAssign("famille_pharmacologique");
  maybeAssign("posologie_adulte");
  maybeAssign("posologie_enfant");
  maybeAssign("dose_maximale");
  maybeAssign("frequence_administration");
  maybeAssign("grossesse");
  maybeAssign("allaitement");

  if (values.substances_actives.trim() !== initialValues.substances_actives.trim()) {
    payload.substances_actives = parseSubstances(values.substances_actives);
  }
  if (values.indications.trim() !== initialValues.indications.trim()) {
    payload.indications = parseIndications(values.indications);
  }
  if (values.contre_indications.trim() !== initialValues.contre_indications.trim()) {
    payload.contre_indications = parseDescriptions(values.contre_indications);
  }
  if (values.precautions.trim() !== initialValues.precautions.trim()) {
    payload.precautions = parseDescriptions(values.precautions);
  }
  if (values.interactions.trim() !== initialValues.interactions.trim()) {
    payload.interactions = parseInteractions(values.interactions);
  }
  if (values.effets_indesirables.trim() !== initialValues.effets_indesirables.trim()) {
    payload.effets_indesirables = parseSideEffects(values.effets_indesirables);
  }
  if (values.presentations.trim() !== initialValues.presentations.trim()) {
    payload.presentations = parsePresentations(values.presentations);
  }

  return payload;
}

export function formatMedicationCount(count: number) {
  return `${count.toLocaleString("fr-FR")} médicament${count > 1 ? "s" : ""} trouv${count > 1 ? "és" : "é"}`;
}

export function formatMedicationBaseCount(count: number) {
  return `Accédez à une base de ${count.toLocaleString("fr-FR")} médicaments disponibles`;
}
