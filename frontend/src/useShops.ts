import { useState, useEffect, useCallback } from "react";
import { Platform } from "react-native";
import * as Location from "expo-location";
import { apiGet } from "@/src/api";

const DEFAULT = { latitude: 37.9838, longitude: 23.7275 }; // Athens

type Opts = { locationQuery?: string; day?: number; lang?: string };

export function useShops(category: string, opts: Opts = {}) {
  const { locationQuery, day = -1, lang = "el" } = opts;
  const [shops, setShops] = useState<any[]>([]);
  const [region, setRegion] = useState(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const resolveLocation = useCallback(async () => {
    if (locationQuery && locationQuery.trim()) {
      try {
        const g = await apiGet(`/places/geocode?q=${encodeURIComponent(locationQuery)}&lang=${lang}`);
        return { latitude: g.latitude, longitude: g.longitude };
      } catch {
        return DEFAULT;
      }
    }
    try {
      if (Platform.OS === "web") return DEFAULT;
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return DEFAULT;
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
    } catch {
      return DEFAULT;
    }
  }, [locationQuery, lang]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const loc = await resolveLocation();
      setRegion(loc);
      const data = await apiGet(
        `/places/nearby?lat=${loc.latitude}&lng=${loc.longitude}&radius=8000&category=${category}&day=${day}&lang=${lang}`,
      );
      setShops(data.results || []);
    } catch {
      setError("error");
      setShops([]);
    } finally {
      setLoading(false);
    }
  }, [category, day, lang, resolveLocation]);

  useEffect(() => {
    load();
  }, [load]);

  return { shops, region, loading, error, reload: load };
}
