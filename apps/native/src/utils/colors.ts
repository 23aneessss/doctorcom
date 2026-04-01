// Color constants matching your web design
export const colors = {
  // Primary palette
  primary: {
    50: '#eff8ff',
    100: '#dbeffe',
    200: '#bfe3fe',
    300: '#93d2fc',
    400: '#60b8f9',
    500: '#3b9af4',
    600: '#1e7ce9',
    700: '#1a6ad6',
    800: '#1e3a5f', // Main dark blue
    900: '#1a2e4a',
    950: '#0f1c2e',
  },
  // Accent colors
  accent: {
    teal: '#0891B2',
    orange: '#F97316',
    green: '#10B981',
    red: '#EF4444',
    yellow: '#EAB308',
    purple: '#8B5CF6',
    pink: '#EC4899',
  },
  // Status colors
  status: {
    completed: '#10B981',
    confirmed: '#0891B2',
    pending: '#F97316',
    cancelled: '#EF4444',
    booked: '#3B82F6',
    free: '#6B7280',
    blocked: '#374151',
  },
  // Background colors
  background: {
    primary: '#FFFFFF',
    secondary: '#F8FAFC',
    tertiary: '#F1F5F9',
    card: '#FFFFFF',
  },
  // Text colors
  text: {
    primary: '#1E293B',
    secondary: '#64748B',
    tertiary: '#94A3B8',
    inverse: '#FFFFFF',
  },
  // Utility
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
};

// Status badge configurations
export const statusConfig = {
  completed: {
    label: 'Terminé',
    color: colors.status.completed,
    bgColor: '#D1FAE5',
    textColor: colors.status.completed,
  },
  confirmed: {
    label: 'Confirmé',
    color: colors.status.confirmed,
    bgColor: '#CFFAFE',
    textColor: colors.status.confirmed,
  },
  booked: {
    label: 'Confirmé',
    color: colors.status.confirmed,
    bgColor: '#CFFAFE',
    textColor: colors.status.confirmed,
  },
  pending: {
    label: 'En Attente',
    color: colors.status.pending,
    bgColor: '#FFEDD5',
    textColor: colors.status.pending,
  },
  cancelled: {
    label: 'Annulé',
    color: colors.status.cancelled,
    bgColor: '#FEE2E2',
    textColor: colors.status.cancelled,
  },
  free: {
    label: 'Libre',
    color: colors.status.free,
    bgColor: '#F3F4F6',
    textColor: colors.status.free,
  },
  blocked: {
    label: 'Bloqué',
    color: colors.status.blocked,
    bgColor: '#E5E7EB',
    textColor: colors.status.blocked,
  },
};

// Slot type configurations
export const slotTypeConfig = {
  consultation: {
    label: 'Consultation',
    color: colors.accent.teal,
  },
  routine: {
    label: 'Contrôle de routine',
    color: colors.accent.green,
  },
  follow_up: {
    label: 'Suivi post-traitement',
    color: colors.accent.purple,
  },
  control: {
    label: 'Contrôle',
    color: colors.accent.orange,
  },
  other: {
    label: 'Autre',
    color: colors.text.secondary,
  },
};

// Avatar background colors for initials
export const avatarColors = [
  '#0891B2', // Teal
  '#F97316', // Orange
  '#10B981', // Green
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#EAB308', // Yellow
  '#3B82F6', // Blue
  '#EF4444', // Red
];

export const getAvatarColor = (initials: string): string => {
  const charCode = initials.charCodeAt(0) + (initials.charCodeAt(1) || 0);
  return avatarColors[charCode % avatarColors.length];
};
