const truthy = new Set(["1", "true", "yes", "on"]);

export const mapsDisabled = truthy.has(String(process.env.EXPO_PUBLIC_DISABLE_MAPS || "").trim().toLowerCase());
