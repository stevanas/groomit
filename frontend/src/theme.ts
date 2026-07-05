export const lightColors = {
  surface: "#FBF5EE",
  onSurface: "#241F1A",
  surfaceSecondary: "#FFFFFF",
  onSurfaceSecondary: "#241F1A",
  surfaceTertiary: "#F1E7DA",
  onSurfaceTertiary: "#5A5249",
  surfaceInverse: "#2A211C",
  onSurfaceInverse: "#FFF7EE",
  brand: "#E2683C",
  onBrand: "#FFFFFF",
  brandSecondary: "#FBD9C6",
  onBrandSecondary: "#7A2F12",
  brandTertiary: "#FBEDE3",
  onBrandTertiary: "#8A3A18",
  accent: "#2E8B83",
  onAccent: "#FFFFFF",
  success: "#3F9D7C",
  warning: "#E6A93C",
  error: "#CF5151",
  info: "#7C8B86",
  border: "#ECE0D2",
  borderStrong: "#D8C9B6",
  muted: "#9A8E7F",
};

export const darkColors: typeof lightColors = {
  surface: "#17130F",
  onSurface: "#F5EEE6",
  surfaceSecondary: "#221C16",
  onSurfaceSecondary: "#F5EEE6",
  surfaceTertiary: "#2E261E",
  onSurfaceTertiary: "#C9BEB0",
  surfaceInverse: "#FFF7EE",
  onSurfaceInverse: "#241F1A",
  brand: "#EE7547",
  onBrand: "#FFFFFF",
  brandSecondary: "#5A2A16",
  onBrandSecondary: "#FBD9C6",
  brandTertiary: "#3A271C",
  onBrandTertiary: "#F3B999",
  accent: "#43B5AB",
  onAccent: "#06201D",
  success: "#54BA92",
  warning: "#E6A93C",
  error: "#E26B6B",
  info: "#9FB0AB",
  border: "#352D25",
  borderStrong: "#4A4036",
  muted: "#A29686",
};

export type ThemeColors = typeof lightColors;

// Default static export (light). Components use useTheme() for runtime theming.
export const colors = lightColors;

export const fonts = {
  display: "Comfortaa",
};

// Per-category colors (used on labels, list tags, map pins, detail badge).
// Distinct, readable, and intentionally NOT the brand orange.
export const categoryColor: Record<string, { main: string; on: string; soft: string; onSoft: string }> = {
  groomer: { main: "#D94C9A", on: "#FFFFFF", soft: "#FBE1F0", onSoft: "#8A1F59" },
  shop: { main: "#3D6FB4", on: "#FFFFFF", soft: "#DEE8F5", onSoft: "#264C7E" },
  vet: { main: "#D64545", on: "#FFFFFF", soft: "#FBE3E3", onSoft: "#8D2020" },
  groomerShop: { main: "#7B52C7", on: "#FFFFFF", soft: "#EEE7FA", onSoft: "#4A2D86" },
  both: { main: "#7B52C7", on: "#FFFFFF", soft: "#EEE7FA", onSoft: "#4A2D86" },
  pharmacy: { main: "#1A7A4C", on: "#FFFFFF", soft: "#D1F0E2", onSoft: "#0F4D30" },
};

export const getCat = (c?: string) => categoryColor[c || "shop"] || categoryColor.shop;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 };
export const radius = { sm: 8, md: 16, lg: 24, pill: 999 };

export const shadow = {
  card: {
    shadowColor: "#3A2A1E",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3,
  },
  float: {
    shadowColor: "#3A2A1E",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 20,
    elevation: 8,
  },
};
