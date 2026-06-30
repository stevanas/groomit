export const colors = {
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

export const fonts = {
  display: "Comfortaa",
};

// Per-category colors (used on labels, list tags, map pins, detail badge).
// Distinct, readable, and intentionally NOT the brand orange.
export const categoryColor: Record<string, { main: string; on: string; soft: string; onSoft: string }> = {
  groomer: { main: "#2E8B83", on: "#FFFFFF", soft: "#DCEEEC", onSoft: "#1F5F59" },
  shop: { main: "#3D6FB4", on: "#FFFFFF", soft: "#DEE8F5", onSoft: "#264C7E" },
  both: { main: "#B5527E", on: "#FFFFFF", soft: "#F6DDE8", onSoft: "#7E2E50" },
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
