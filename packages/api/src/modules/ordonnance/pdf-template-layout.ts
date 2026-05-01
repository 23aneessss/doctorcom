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
    logo_medecin: OrdonnancePdfTemplateField;
    medecin: OrdonnancePdfTemplateField;
    cabinet: OrdonnancePdfTemplateField;
    date_prescription: OrdonnancePdfTemplateField;
    titre: OrdonnancePdfTemplateField;
    patient: OrdonnancePdfTemplateField;
    medicaments: OrdonnancePdfTemplateField;
    remarques: OrdonnancePdfTemplateField;
    signature_cachet: OrdonnancePdfTemplateField;
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
    logo_medecin: {
      x: 64,
      y: 68,
      width: 42,
      height: 42,
      fontSize: 12,
      lineHeight: 14,
      align: "center",
      enabled: false,
    },
    medecin: {
      x: 118,
      y: 68,
      width: 235,
      height: 48,
      fontSize: 12,
      lineHeight: 15,
      align: "left",
      enabled: false,
    },
    cabinet: {
      x: 118,
      y: 116,
      width: 270,
      height: 52,
      fontSize: 9,
      lineHeight: 12,
      align: "left",
      enabled: false,
    },
    date_prescription: {
      x: 420,
      y: 132,
      width: 118,
      height: 26,
      fontSize: 10,
      lineHeight: 12,
      align: "right",
    },
    titre: {
      x: 210,
      y: 210,
      width: 180,
      height: 36,
      fontSize: 18,
      lineHeight: 22,
      align: "center",
      enabled: false,
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
    signature_cachet: {
      x: 360,
      y: 720,
      width: 190,
      height: 48,
      fontSize: 12,
      lineHeight: 15,
      align: "center",
      enabled: false,
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
    fontSize: Math.min(48, Math.max(6, coerceNumber(field.fontSize, fallback.fontSize))),
    lineHeight: field.lineHeight
      ? Math.min(64, Math.max(7, coerceNumber(field.lineHeight, field.fontSize ?? 12)))
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
  const fields = (layout.fields ?? {}) as Partial<
    OrdonnancePdfTemplateLayoutConfig["fields"]
  >;

  return {
    version: 1,
    page: 1,
    fields: {
      logo_medecin: normalizeField(
        fields.logo_medecin,
        DEFAULT_ORDONNANCE_PDF_LAYOUT.fields.logo_medecin,
      ),
      medecin: normalizeField(
        fields.medecin,
        DEFAULT_ORDONNANCE_PDF_LAYOUT.fields.medecin,
      ),
      cabinet: normalizeField(
        fields.cabinet,
        DEFAULT_ORDONNANCE_PDF_LAYOUT.fields.cabinet,
      ),
      date_prescription: normalizeField(
        fields.date_prescription,
        DEFAULT_ORDONNANCE_PDF_LAYOUT.fields.date_prescription,
      ),
      titre: normalizeField(
        fields.titre,
        DEFAULT_ORDONNANCE_PDF_LAYOUT.fields.titre,
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
      signature_cachet: normalizeField(
        fields.signature_cachet,
        DEFAULT_ORDONNANCE_PDF_LAYOUT.fields.signature_cachet,
      ),
    },
  };
}
