import { useState, useEffect, useCallback, useRef } from "react";
import { Platform } from "react-native";
import * as Location from "expo-location";
import { apiGet } from "@/src/api";

const DEFAULT = { latitude: 37.9838, longitude: 23.7275 }; // Athens

type Opts = { locationQuery?: string; day?: number; lang?: string; center?: { latitude: number; longitude: number } };

export function useShops(category: string, opts: Opts = {}) {
  const { locationQuery, day = -1, lang = "el", center } = opts;
  const [shops, setShops] = useState<any[]>([]);
  const [region, setRegion] = useState(center || DEFAULT);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nextToken = useRef<string | null>(null);
  const locRef = useRef(center || DEFAULT);

  const resolveLocation = useCallback(async () => {
    if (center) return center;
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
  }, [locationQuery, lang, center?.latitude, center?.longitude]);

  const fetchPage = useCallback(
    async (loc: { latitude: number; longitude: number }, token?: string | null) => {
      let url = `/places/nearby?lat=${loc.latitude}&lng=${loc.longitude}&radius=8000&category=${category}&day=${day}&lang=${lang}`;
      if (token) url += `&page_token=${encodeURIComponent(token)}`;
      return apiGet(url);
    },
    [category, day, lang],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    nextToken.current = null;
    try {
      const loc = await resolveLocation();
      locRef.current = loc;
      setRegion(loc);
      const data = await fetchPage(loc, null);
      setShops(data.results || []);
      nextToken.current = data.next_page_token || null;
    } catch {
      setError("error");
      setShops([]);
    } finally {
      setLoading(false);
    }
  }, [resolveLocation, fetchPage]);

  const loadMore = useCallback(async () => {
    if (loadingMore || loading || !nextToken.current) return;
    setLoadingMore(true);
    try {
      const data = await fetchPage(locRef.current, nextToken.current);
      setShops((prev) => {
        const seen = new Set(prev.map((s) => s.id));
        const fresh = (data.results || []).filter((s: any) => !seen.has(s.id));
        return [...prev, ...fresh];
      });
      nextToken.current = data.next_page_token || null;
    } catch {
      /* keep existing list on pagination error */
    } finally {
      setLoadingMore(false);
    }
  }, [fetchPage, loadingMore, loading]);

  useEffect(() => {
    load();
  }, [load]);

  return { shops, region, loading, loadingMore, hasMore: !!nextToken.current, error, reload: load, loadMore };
}
