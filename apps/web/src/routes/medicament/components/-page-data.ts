export const MEDICATIONS_PAGE_COLORS = {
  background: "#fbfbfc",
  darkBlue: "#0F3460",
  lightBlue: "#C2E0EF",
  paleBlue: "#EAF5FC",
  softBlue: "#F3F9FD",
  orange: "#FF8A1F",
  orangeLight: "#FFB14A",
  orangeBorder: "#FFA24A",
} as const;

export const MEDICATIONS_PAGE_TEXT = {
  title: "Médicaments",
  searchPlaceholder: "Rechercher un médicament...",
  selectedCategory: "Toutes les catégories",
} as const;

export const MEDICATIONS_ALPHABET_ROWS = [
  "ABCDEFGHIJKLMNOPQRSTUV".split(""),
  "WXYZ".split(""),
] as const;

export const MEDICATIONS_CATEGORIES = [
  "Toutes les catégories",
  "Antibiotique",
  "Antalgique",
  "Anti-inflammatoire",
  "Anti-diabétique",
  "Hypolipémiant",
] as const;
