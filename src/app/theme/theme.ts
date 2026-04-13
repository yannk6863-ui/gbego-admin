// src/theme/theme.ts

export const theme = {
  colors: {
    primary: "#0FA958",
    accent: "#F7931E",

    bg: "#F7F8FA",
    surface: "#FFFFFF",

    text: "#101828",
    muted: "#667085",

    border: "#EAECF0",
    danger: "#D92D20",
    success: "#12B76A",
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
  },

  radius: {
    sm: 12,
    md: 16,
    lg: 20,
    pill: 999,
  },

  shadow: {
    card: {
      shadowColor: "#000",
      shadowOpacity: 0.08,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 3,
    },
  },

  typography: {
    title: 24,
    h2: 20,
    h3: 18,
    body: 16,
    small: 14,
    tiny: 12,
  },
} as const;