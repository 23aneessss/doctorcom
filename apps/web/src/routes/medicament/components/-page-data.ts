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
  subtitle: "Accédez à une base de 8 333 médicaments disponibles",
  searchPlaceholder: "Rechercher un médicament...",
  selectedCategory: "Toutes les catégories",
  resultsTitle: 'Médicaments commençant par "B"',
  resultsCount: "2 médicaments trouvés",
  primaryTag: "Anti-inflammatoire",
  secondaryTag: "Corticostéroïdes",
  condition: "Asthme et BPCO",
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

export const MEDICATIONS_LIST = Array.from({ length: 6 }, () => ({
  name: "Budesonide",
  scientificName: "Budésonide",
  primaryTag: MEDICATIONS_PAGE_TEXT.primaryTag,
  secondaryTag: MEDICATIONS_PAGE_TEXT.secondaryTag,
  condition: MEDICATIONS_PAGE_TEXT.condition,
}));
