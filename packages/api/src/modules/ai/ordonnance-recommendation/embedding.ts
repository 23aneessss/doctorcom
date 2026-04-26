import { createHash } from "node:crypto";

import type { MedicamentAggregate } from "../../medicaments/service";

const MAX_ITEMS = 6;
const MAX_LINE = 220;
const PREVIEW_LIMIT = 800;

function compact(value: string | null | undefined): string | null {
  const normalized = value?.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return null;
  }

  return normalized.length > MAX_LINE
    ? `${normalized.slice(0, MAX_LINE - 3).trimEnd()}...`
    : normalized;
}

function dedupe(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const rows: string[] = [];

  for (const value of values) {
    const normalized = compact(value);
    if (!normalized) {
      continue;
    }

    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    rows.push(normalized);

    if (rows.length >= MAX_ITEMS) {
      break;
    }
  }

  return rows;
}

export function buildMedicamentEmbeddingPayload(aggregate: MedicamentAggregate): {
  content: string;
  contentHash: string;
  preview: string;
} {
  const lines: string[] = [];
  const medicament = aggregate.medicament;

  const core = [
    compact(medicament.nom_medicament),
    compact(medicament.nom_generique),
    compact(medicament.classe_therapeutique),
    compact(medicament.famille_pharmacologique),
  ].filter((value): value is string => Boolean(value));

  if (core.length > 0) {
    lines.push(`core: ${core.join(" | ")}`);
  }

  const substances = dedupe(
    aggregate.substances_actives.map((item) => item.nom_substance),
  );
  if (substances.length > 0) {
    lines.push(`substances: ${substances.join(" ; ")}`);
  }

  const indications = dedupe(aggregate.indications.map((item) => item.indication));
  if (indications.length > 0) {
    lines.push(`indications: ${indications.join(" ; ")}`);
  }

  const precautions = dedupe([
    ...aggregate.contre_indications.map((item) => item.description),
    ...aggregate.precautions.map((item) => item.description),
    medicament.grossesse,
    medicament.allaitement,
  ]);
  if (precautions.length > 0) {
    lines.push(`safety: ${precautions.join(" ; ")}`);
  }

  const content = lines.join("\n").trim();
  const preview = content.length > PREVIEW_LIMIT
    ? `${content.slice(0, PREVIEW_LIMIT - 3).trimEnd()}...`
    : content;
  const contentHash = createHash("sha256").update(content).digest("hex");

  return {
    content,
    contentHash,
    preview,
  };
}
