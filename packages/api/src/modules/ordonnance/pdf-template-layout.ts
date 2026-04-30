export type OrdonnancePdfTemplateAlign = "left" | "center" | "right";

export type OrdonnancePdfTemplateField = {
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  lineHeight?: number;
  align?: OrdonnancePdfTemplateAlign;
  enabled?: boolean;
};

export type OrdonnancePdfTemplateLayoutConfig = {
  version: 1;
  page: 1;
  fields: {
    date_prescription: OrdonnancePdfTemplateField;
    patient: OrdonnancePdfTemplateField;
    medicaments: OrdonnancePdfTemplateField;
    remarques: OrdonnancePdfTemplateField;
  };
};

export const DEFAULT_PDF_TEMPLATE_PAGE = {
  width: 595,
  height: 842,
} as const;

export const DEFAULT_ORDONNANCE_PDF_LAYOUT: OrdonnancePdfTemplateLayoutConfig = {
  version: 1,
  page: 1,
  fields: {
    date_prescription: {
      x: 420,
      y: 132,
      width: 118,
      height: 26,
      fontSize: 10,
      lineHeight: 12,
      align: "right",
    },
    patient: {
      x: 56,
      y: 180,
      width: 260,
      height: 72,
      fontSize: 10,
      lineHeight: 13,
      align: "left",
    },
    medicaments: {
      x: 56,
      y: 296,
      width: 483,
      height: 300,
      fontSize: 10,
      lineHeight: 14,
      align: "left",
    },
    remarques: {
      x: 56,
      y: 620,
      width: 483,
      height: 72,
      fontSize: 9,
      lineHeight: 12,
      align: "left",
      enabled: true,
    },
  },
};

function coerceNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeField(
  value: unknown,
  fallback: OrdonnancePdfTemplateField,
): OrdonnancePdfTemplateField {
  if (!value || typeof value !== "object") {
    return fallback;
  }

  const field = value as Partial<OrdonnancePdfTemplateField>;
  const align =
    field.align === "center" || field.align === "right" || field.align === "left"
      ? field.align
      : fallback.align;

  return {
    x: coerceNumber(field.x, fallback.x),
    y: coerceNumber(field.y, fallback.y),
    width: Math.max(20, coerceNumber(field.width, fallback.width)),
    height: Math.max(16, coerceNumber(field.height, fallback.height)),
    fontSize: Math.min(24, Math.max(6, coerceNumber(field.fontSize, fallback.fontSize))),
    lineHeight: field.lineHeight
      ? Math.min(34, Math.max(7, coerceNumber(field.lineHeight, field.fontSize ?? 12)))
      : fallback.lineHeight,
    align,
    enabled: field.enabled ?? fallback.enabled,
  };
}

export function normalizeOrdonnancePdfLayout(
  value: unknown,
): OrdonnancePdfTemplateLayoutConfig {
  if (!value || typeof value !== "object") {
    return DEFAULT_ORDONNANCE_PDF_LAYOUT;
  }

  const layout = value as Partial<OrdonnancePdfTemplateLayoutConfig>;
  const fields = layout.fields ?? {};

  return {
    version: 1,
    page: 1,
    fields: {
      date_prescription: normalizeField(
        fields.date_prescription,
        DEFAULT_ORDONNANCE_PDF_LAYOUT.fields.date_prescription,
      ),
      patient: normalizeField(
        fields.patient,
        DEFAULT_ORDONNANCE_PDF_LAYOUT.fields.patient,
      ),
      medicaments: normalizeField(
        fields.medicaments,
        DEFAULT_ORDONNANCE_PDF_LAYOUT.fields.medicaments,
      ),
      remarques: normalizeField(
        fields.remarques,
        DEFAULT_ORDONNANCE_PDF_LAYOUT.fields.remarques,
      ),
    },
  };
}
