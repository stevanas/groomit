import { useState, useEffect, useCallback } from "react";
import { Platform } from "react-native";
import * as Location from "expo-location";
import { apiGet } from "@/src/api";

const DEFAULT = { latitude: 37.7849, longitude: -122.4094 };

export function useShops(category: string) {
  const [shops, setShops] = useState<any[]>([]);
  const [region, setRegion] = useState(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const resolveLocation = useCallback(async () => {
    try {
      if (Platform.OS === "web") return DEFAULT;
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return DEFAULT;
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
    } catch {
      return DEFAULT;
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const loc = await resolveLocation();
      setRegion(loc);
      const data = await apiGet(`/places/nearby?lat=${loc.latitude}&lng=${loc.longitude}&radius=8000&category=${category}`);
      setShops(data.results || []);
    } catch (e: any) {
      setError("We lost the scent. Try again.");
      setShops([]);
    } finally {
      setLoading(false);
    }
  }, [category, resolveLocation]);

  useEffect(() => {
    load();
  }, [load]);

  return { shops, region, loading, error, reload: load };
}
