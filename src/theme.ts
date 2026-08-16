export const FONT_DISPLAY = "'Baloo 2', sans-serif";
export const FONT_BODY = "'Plus Jakarta Sans', sans-serif";
export const FONT_MONO = "'JetBrains Mono', monospace";

export interface ThemeTokens {
  bg: string;
  bgAlt: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  textFaint: string;
  purple: string;
  purpleStrong: string;
  purpleDeep: string;
  teal: string;
  tealDeep: string;
  gold: string;
  goldDeep: string;
  green: string;
  red: string;
  chip: string[];
}

export const THEME: { dark: ThemeTokens; light: ThemeTokens } = {
  dark: {
    bg: "#00122e",
    bgAlt: "#000d21",
    surface: "#001B48",
    surfaceAlt: "#022b54",
    border: "#0e4a7d",
    text: "#F0F7FA",
    textMuted: "#97CADB",
    textFaint: "#5C8F9F",
    purple: "#018ABE",
    purpleStrong: "#02457A",
    purpleDeep: "#03325c",
    teal: "#97CADB",
    tealDeep: "#018ABE",
    gold: "#FDE047",
    goldDeep: "#EAB308",
    green: "#34D399",
    red: "#F87171",
    chip: ["#018ABE", "#02457A", "#97CADB", "#001B48", "#249DD1", "#64C0DC"],
  },
  light: {
    bg: "#F2F8FB",
    bgAlt: "#D6E8EE",
    surface: "#FFFFFF",
    surfaceAlt: "#E6F2F7",
    border: "#BEDDE8",
    text: "#001B48",
    textMuted: "#02457A",
    textFaint: "#4C7491",
    purple: "#02457A",
    purpleStrong: "#001B48",
    purpleDeep: "#D6E8EE",
    teal: "#018ABE",
    tealDeep: "#02457A",
    gold: "#F5B82A",
    goldDeep: "#D97706",
    green: "#16A34A",
    red: "#DC2626",
    chip: ["#02457A", "#018ABE", "#001B48", "#257A9E", "#5BA6C2", "#0F5280"],
  },
};
