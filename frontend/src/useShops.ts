import { useState, useEffect, useCallback, useRef } from "react";
import { Platform } from "react-native";
import * as Location from "expo-location";
import { apiGet } from "@/src/api";

const DEFAULT = { latitude: 37.9838, longitude: 23.7275 }; // Athens
const SESSION_CACHE_TTL_MS = 10 * 60 * 1000;
const GEOCODE_CACHE_TTL_MS = 60 * 60 * 1000;

type SessionEntry = {
  ts: number;
  shops: any[];
  nextToken: string | null;
  region: { latitude: number; longitude: number };
};

const SESSION_CACHE = new Map<string, SessionEntry>();
const GEOCODE_CACHE = new Map<string, { ts: number; loc: { latitude: number; longitude: number } }>();

const normalizeCategory = (c?: string | null): string => {
  if (!c) return "shop";
  if (c === "both") return "groomerShop";
  return c;
};

const normalizeCategorySelection = (category: string | string[]): string[] => {
  const raw = Array.isArray(category) ? category : [category];
  const cleaned = raw
    .map((c) => String(c || "").trim())
    .filter(Boolean)
    .map((c) => (c === "both" ? "groomerShop" : c));

  if (cleaned.length === 0 || cleaned.includes("all")) return ["all"];

  const valid = ["shop", "groomer", "groomerShop", "vet", "pharmacy"];
  const uniq = Array.from(new Set(cleaned.filter((c) => valid.includes(c))));
  return uniq.length ? uniq.sort() : ["all"];
};

const normalizeShops = (items: any[]) =>
  (items || []).map((s) => ({ ...s, category: normalizeCategory(s?.category), tags: s?.tags || [] }));

type Opts = {
  locationQuery?: string;
  day?: number;
  lang?: string;
  center?: { latitude: number; longitude: number };
  enabled?: boolean;
  disablePagination?: boolean;
};

const cacheKeyFor = (
  category: string | string[],
  day: number,
  lang: string,
  locationQuery: string | undefined,
  center: { latitude: number; longitude: number } | undefined,
  loc: { latitude: number; longitude: number },
) => {
  const cat = normalizeCategorySelection(category).join(",");
  const normalizedQuery = (locationQuery || "").trim().toLowerCase().slice(0, 80);
  const source = center ? "center" : normalizedQuery ? "query" : "gps";
  return [
    source,
    cat,
    day,
    lang,
    normalizedQuery,
    center ? `${center.latitude.toFixed(3)},${center.longitude.toFixed(3)}` : "",
    `${loc.latitude.toFixed(3)},${loc.longitude.toFixed(3)}`,
  ].join("|");
};

export function useShops(category: string | string[], opts: Opts = {}) {
  const { locationQuery, day = -1, lang = "el", center, enabled = true, disablePagination = false } = opts;
  const [shops, setShops] = useState<any[]>([]);
  const [region, setRegion] = useState(center || DEFAULT);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nextToken = useRef<string | null>(null);
  const locRef = useRef(center || DEFAULT);

  const resolveLocation = useCallback(async () => {
    if (center) return center;

    const query = (locationQuery || "").trim();
    if (query.length > 0) {
      const cacheKey = `${lang}:${query.toLowerCase().slice(0, 120)}`;
      const cached = GEOCODE_CACHE.get(cacheKey);
      if (cached && Date.now() - cached.ts < GEOCODE_CACHE_TTL_MS) {
        return cached.loc;
      }
      try {
        const g = await apiGet(`/places/geocode?q=${encodeURIComponent(query)}&lang=${lang}`);
        const next = {
          latitude: Number(g?.latitude) || DEFAULT.latitude,
          longitude: Number(g?.longitude) || DEFAULT.longitude,
        };
        GEOCODE_CACHE.set(cacheKey, { ts: Date.now(), loc: next });
        return next;
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
  }, [center?.latitude, center?.longitude, locationQuery, lang]);

  const fetchPage = useCallback(
    async (loc: { latitude: number; longitude: number }, token?: string | null) => {
      const catStr = normalizeCategorySelection(category).join(",");
      let url = `/places/nearby?lat=${loc.latitude}&lng=${loc.longitude}&radius=8000&category=${catStr}&day=${day}&lang=${lang}`;
      if (token) url += `&page_token=${encodeURIComponent(token)}`;
      return apiGet(url);
    },
    [category, day, lang],
  );

  const load = useCallback(async () => {
    if (!enabled) {
      nextToken.current = null;
      setShops([]);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    nextToken.current = null;
    try {
      const loc = await resolveLocation();
      locRef.current = loc;
      setRegion(loc);

      const key = cacheKeyFor(category, day, lang, locationQuery, center, loc);
      const cached = SESSION_CACHE.get(key);
      if (cached && Date.now() - cached.ts < SESSION_CACHE_TTL_MS) {
        setShops(cached.shops);
        nextToken.current = disablePagination ? null : cached.nextToken;
        return;
      }

      const data = await fetchPage(loc, null);
      const normalized = normalizeShops(data.results || []);
      setShops(normalized);
      nextToken.current = disablePagination ? null : data.next_page_token || null;
      SESSION_CACHE.set(key, {
        ts: Date.now(),
        shops: normalized,
        nextToken: data.next_page_token || null,
        region: loc,
      });
    } catch {
      setError("error");
      setShops([]);
    } finally {
      setLoading(false);
    }
  }, [enabled, resolveLocation, fetchPage, category, day, lang, locationQuery, center?.latitude, center?.longitude, disablePagination]);

  const loadMore = useCallback(async () => {
    if (disablePagination || !enabled || loadingMore || loading || !nextToken.current) return;
    setLoadingMore(true);
    try {
      const data = await fetchPage(locRef.current, nextToken.current);
      setShops((prev) => {
        const seen = new Set(prev.map((s) => s.id));
        const fresh = normalizeShops(data.results || []).filter((s: any) => !seen.has(s.id));
        return [...prev, ...fresh];
      });
      nextToken.current = data.next_page_token || null;
    } catch {
      /* keep existing list on pagination error */
    } finally {
      setLoadingMore(false);
    }
  }, [disablePagination, enabled, fetchPage, loadingMore, loading]);

  useEffect(() => {
    load();
  }, [load]);

  return { shops, region, loading, loadingMore, hasMore: !!nextToken.current, error, reload: load, loadMore };
}
