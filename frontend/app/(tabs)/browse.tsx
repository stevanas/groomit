import React, { useState, useMemo, useEffect } from "react";
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator, Pressable, TextInput, RefreshControl, Platform, Modal, ScrollView,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ShopCard from "@/src/components/ShopCard";
import CategoryChips from "@/src/components/CategoryChips";
import TimePicker from "@/src/components/TimePicker";
import MapShops from "@/src/components/MapShops";
import AdBanner from "@/src/components/AdBanner";
import AdUpsell from "@/src/components/AdUpsell";
import { useShops } from "@/src/useShops";
import { apiGet, photoUrl } from "@/src/api";
import { useI18n } from "@/src/i18n";
import { spacing, radius, shadow, getCat, ThemeColors } from "@/src/theme";
import { Image } from "expo-image";
import { useTheme, useThemedStyles } from "@/src/theme-context";

const IS_WEB = Platform.OS === "web";

function parseCategoryParam(raw?: string): string | string[] {
  if (!raw) return "groomer";
  const vals = raw
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => (x === "both" ? "groomerShop" : x));
  if (vals.length === 0 || vals.includes("all")) return "groomer";
  const valid = ["shop", "groomer", "groomerShop", "vet", "pharmacy"];
  const uniq = Array.from(new Set(vals.filter((x) => valid.includes(x))));
  if (uniq.length === 0) return "groomer";
  return uniq.length === 1 ? uniq[0] : uniq;
}

function categoryMatchesSelected(shop: { category?: string; tags?: string[] }, selected: string | string[]): boolean {
  const c = (shop.category === "both" ? "groomerShop" : shop.category) || "shop";
  const tags: string[] = shop.tags || [];
  const picks = Array.isArray(selected) ? selected : [selected];
  if (picks.includes("all")) return true;
  for (const p of picks) {
    if (p === "groomer" && c === "groomer") return true;
    if (p === "shop" && c === "shop") return true;
    if (p === "groomerShop" && c === "groomerShop") return true;
    if (p === "vet" && c === "vet") return true;
    // Pharmacy: match dedicated pharmacies OR any place tagged with pharmacy
    if (p === "pharmacy" && (c === "pharmacy" || tags.includes("pharmacy"))) return true;
  }
  return false;
}

function distanceKm(a: { latitude: number; longitude: number }, lat?: number, lng?: number) {
  if (lat == null || lng == null) return null;
  const R = 6371;
  const dLat = ((lat - a.latitude) * Math.PI) / 180;
  const dLng = ((lng - a.longitude) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.latitude * Math.PI) / 180) * Math.cos((lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

export default function BrowseScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t, lang } = useI18n();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const params = useLocalSearchParams<{ category?: string; location?: string; day?: string }>();

  // Initialize category as string or array
  const initCategory = parseCategoryParam(params.category);
  const [category, setCategory] = useState<string | string[]>(initCategory);
  const [query, setQuery] = useState("");
  const [emergencyOnly, setEmergencyOnly] = useState(false);
  const [openNowOnly, setOpenNowOnly] = useState(false);
  const [openUntil, setOpenUntil] = useState<string | null>(null);
  const [sort, setSort] = useState<"distance" | "rating">("distance");
  const [sortOpen, setSortOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [mapSelected, setMapSelected] = useState<any>(null);
  const [providerMode, setProviderMode] = useState<"seed" | "google" | null>(null);

  const todayIdx = (new Date().getDay() + 6) % 7;

  // Keep filters in sync when arriving from the Find form with new params.
  useEffect(() => {
    if (params.category) {
      setCategory(parseCategoryParam(params.category));
    }
  }, [params.category]);

  useEffect(() => {
    if (!__DEV__) return;
    let mounted = true;
    (async () => {
      try {
        const info = await apiGet("/");
        if (!mounted) return;
        setProviderMode(info?.places_provider === "google" ? "google" : "seed");
      } catch {
        if (!mounted) return;
        setProviderMode(null);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const day = params.day ? Number(params.day) : -1;
  const { shops, region, loading, error, reload, loadMore, loadingMore, hasMore } = useShops(category, {
    locationQuery: params.location,
    day,
    lang,
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let res = shops
      .filter((s) => categoryMatchesSelected(s, category))
      .map((s) => ({ ...s, distanceKm: distanceKm(region, s.latitude, s.longitude) }));
    if (q) res = res.filter((s) => s.name.toLowerCase().includes(q) || (s.address || "").toLowerCase().includes(q));
    if (emergencyOnly) res = res.filter((s) => s.emergency === true);
    if (openNowOnly) res = res.filter((s) => s.open_now === true);
    if (openUntil === "24h") {
      res = res.filter((s) => {
        const d = s.schedule?.[todayIdx];
        return d && !d.closed && d.open === "00:00" && d.close === "23:59";
      });
    } else if (openUntil) {
      res = res.filter((s) => {
        if (!s.schedule) return true; // hours unknown -> keep visible
        const d = s.schedule[todayIdx];
        return d && !d.closed && d.close >= openUntil;
      });
    }
    if (sort === "rating") {
      res = [...res].sort((a, b) => (b.rating || 0) - (a.rating || 0));
    } else {
      res = [...res].sort((a, b) => (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9));
    }
    return res;
  }, [shops, region, category, query, emergencyOnly, openNowOnly, openUntil, sort, todayIdx]);

  // Rating sort must consider ALL results in the scanned area (a far 5-star should rank first),
  // so load every remaining page. Pages are Mongo-cached -> no new API calls for a scanned area.
  useEffect(() => {
    if (sort === "rating" && hasMore && !loadingMore && !loading) loadMore();
  }, [sort, hasMore, loadingMore, loading]);

  // Build "open until" options from real data: hourly close times today (sensible range only).
  const untilOptions = useMemo(() => {
    const set = new Set<string>();
    shops.forEach((s) => {
      const d = s.schedule?.[todayIdx];
      if (!d || d.closed || !d.close || d.close === "23:59") return;
      const [h, m] = d.close.split(":").map(Number);
      const hh = m > 0 ? h + 1 : h; // round up to next hour
      if (hh >= 12 && hh <= 24) set.add(`${String(hh).padStart(2, "0")}:00`);
    });
    return Array.from(set).sort();
  }, [shops, todayIdx]);

  const has24h = useMemo(
    () => shops.some((s) => { const d = s.schedule?.[todayIdx]; return d && d.open === "00:00" && d.close === "23:59"; }),
    [shops, todayIdx],
  );

  const hasActiveFilters =
    (Array.isArray(category) ? !(category.length === 1 && category[0] === "groomer") : category !== "groomer") ||
    query.trim() !== "" ||
    emergencyOnly ||
    openNowOnly ||
    openUntil !== null ||
    sort !== "distance";

  const clearFilters = () => {
    setCategory("groomer");
    setQuery("");
    setEmergencyOnly(false);
    setOpenNowOnly(false);
    setOpenUntil(null);
    setSort("distance");
  };

  const go = (s: any) => router.push(`/shop/${s.id}`);

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]} testID="browse-screen">
      <View style={styles.header}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={colors.muted} />
          <TextInput
            style={styles.searchInput}
            placeholder={t("browse.searchPlaceholder")}
            placeholderTextColor={colors.muted}
            value={query}
            onChangeText={setQuery}
            testID="browse-search-input"
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery("")} testID="clear-search">
              <Ionicons name="close-circle" size={18} color={colors.muted} />
            </Pressable>
          )}
        </View>
        {!IS_WEB && (
          <Pressable
            style={styles.toggle}
            onPress={() => setViewMode((m) => (m === "list" ? "map" : "list"))}
            testID="view-toggle"
          >
            <Ionicons name={viewMode === "list" ? "map" : "list"} size={20} color={colors.brand} />
          </Pressable>
        )}
      </View>

      <CategoryChips value={category} onChange={setCategory} />

      <View style={styles.filterRow}>
        <Pressable
          style={[styles.filterChip, emergencyOnly && styles.filterChipActive, emergencyOnly && { backgroundColor: colors.error, borderColor: colors.error }]}
          onPress={() => setEmergencyOnly((v) => !v)}
          testID="filter-emergency"
        >
          <Ionicons name="alert-circle" size={15} color={emergencyOnly ? colors.onBrand : colors.error} />
          <Text
            style={[
              styles.filterText,
              { color: colors.error },
              emergencyOnly && styles.filterTextActive,
            ]}
            numberOfLines={1}
          >
            {t("filter.emergency")}
          </Text>
        </Pressable>

        <Pressable
          style={[styles.filterChip, openNowOnly && styles.filterChipActive]}
          onPress={() => setOpenNowOnly((v) => !v)}
          testID="filter-open-now"
        >
          <Ionicons name="time" size={15} color={openNowOnly ? colors.onBrand : colors.success} />
          <Text style={[styles.filterText, openNowOnly && styles.filterTextActive]} numberOfLines={1}>{t("filter.openNow")}</Text>
        </Pressable>

        <TimePicker value={openUntil} onChange={setOpenUntil} options={untilOptions} has24h={has24h} fill testID="filter-until" />
      </View>

      <View style={styles.filterRow}>
        <Pressable style={styles.sortChip} onPress={() => setSortOpen(true)} testID="sort-button">
          <Ionicons name="swap-vertical" size={15} color={colors.onSurfaceTertiary} />
          <Text style={styles.sortText}>{t(`sort.${sort}`)}</Text>
          <Ionicons name="chevron-down" size={13} color={colors.muted} />
        </Pressable>

        {hasActiveFilters && (
          <Pressable style={styles.clearBtn} onPress={clearFilters} testID="clear-filters">
            <Ionicons name="close-circle" size={16} color={colors.muted} />
            <Text style={styles.clearText}>{t("filter.clear")}</Text>
          </Pressable>
        )}
      </View>

      <Modal visible={sortOpen} transparent animationType="fade" onRequestClose={() => setSortOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setSortOpen(false)}>
          <Pressable style={styles.sortSheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sortTitle}>{t("sort.label")}</Text>
            <ScrollView>
              {(["distance", "rating"] as const).map((opt) => (
                <Pressable
                  key={opt}
                  style={styles.sortRow}
                  onPress={() => { setSort(opt); setSortOpen(false); }}
                  testID={`sort-${opt}`}
                >
                  <Text style={[styles.sortRowText, sort === opt && styles.sortRowActive]}>{t(`sort.${opt}`)}</Text>
                  {sort === opt && <Ionicons name="checkmark" size={20} color={colors.brand} />}
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {!loading && !error && (
        <View style={styles.metaRow}>
          <Text style={styles.count}>{t("browse.results", { count: filtered.length })}</Text>
          {__DEV__ && providerMode && (
            <View style={styles.devBadge} testID="provider-mode-badge">
              <Text style={styles.devBadgeText}>{providerMode === "google" ? "LIVE GOOGLE" : "SEED MODE"}</Text>
            </View>
          )}
        </View>
      )}

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.brand} /></View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="cloud-offline" size={48} color={colors.muted} />
          <Text style={styles.emptyText}>{t("common.error")}</Text>
          <Pressable style={styles.retryBtn} onPress={reload} testID="browse-retry">
            <Text style={styles.retryText}>{t("common.retry")}</Text>
          </Pressable>
        </View>
      ) : viewMode === "map" && !IS_WEB ? (
        <View style={{ flex: 1 }}>
          <MapShops shops={filtered} region={region} focusId={mapSelected?.id} onSelect={setMapSelected} />
          {mapSelected && (
            <View style={[styles.cardWrap, { paddingBottom: insets.bottom + spacing.md }]}>
              <Pressable style={styles.mapCard} onPress={() => go(mapSelected)} testID="browse-map-card">
                <Image source={{ uri: photoUrl(mapSelected, { size: "preview" }) || undefined }} style={styles.mapCardImg} contentFit="cover" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.mapCardName} numberOfLines={1}>{mapSelected.name}</Text>
                  <View style={styles.mapCardMeta}>
                    <Ionicons name="star" size={13} color={colors.warning} />
                    <Text style={styles.mapCardRating}>{mapSelected.rating ?? "–"}</Text>
                    {mapSelected.user_rating_count ? <Text style={styles.mapCardCount}>({mapSelected.user_rating_count})</Text> : null}
                  </View>
                  {mapSelected.open_now != null && (
                    <Text style={[styles.mapCardOpen, { color: mapSelected.open_now ? colors.success : colors.muted }]}>
                      {mapSelected.open_now ? t("common.open") : t("common.closed")}
                    </Text>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={22} color={colors.muted} />
              </Pressable>
              <Pressable style={styles.mapDismiss} onPress={() => setMapSelected(null)} testID="browse-map-dismiss">
                <Ionicons name="close-circle" size={26} color={colors.muted} />
              </Pressable>
            </View>
          )}
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="sad-outline" size={48} color={colors.muted} />
          <Text style={styles.emptyText}>{t("common.noResults")}</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ShopCard shop={item} onPress={() => go(item)} />}
          contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.sm, gap: spacing.md, paddingBottom: spacing.xxxl }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onEndReached={() => { if (hasMore && !loadingMore) loadMore(); }}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            <View>
              {loadingMore && <ActivityIndicator color={colors.brand} style={{ marginVertical: spacing.md }} />}
              <AdUpsell />
              <AdBanner />
            </View>
          }
          refreshControl={<RefreshControl refreshing={false} onRefresh={reload} tintColor={colors.brand} />}
        />
      )}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.lg },
  searchBar: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surfaceSecondary, borderRadius: radius.pill, paddingHorizontal: spacing.lg, height: 50, borderWidth: 1, borderColor: colors.border },
  searchInput: { flex: 1, fontSize: 15, color: colors.onSurface },
  toggle: { width: 50, height: 50, borderRadius: radius.md, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  filterScroll: { flexGrow: 0, marginTop: spacing.xs },
  filterRow: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.lg, alignItems: "center", marginTop: spacing.sm },
  filterChip: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingHorizontal: spacing.md, height: 40, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  filterChipActive: { backgroundColor: colors.success, borderColor: colors.success },
  filterText: { fontSize: 13, fontWeight: "800", color: colors.success, flexShrink: 1 },
  filterTextActive: { color: colors.onBrand },
  sortChip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: spacing.md, height: 40, borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary, flexShrink: 0 },
  clearBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: spacing.md, height: 40, flexShrink: 0, marginLeft: "auto" },
  clearText: { fontSize: 13, fontWeight: "700", color: colors.muted },
  sortText: { fontSize: 13, fontWeight: "800", color: colors.onSurfaceTertiary },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sortSheet: { backgroundColor: colors.surfaceSecondary, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, paddingVertical: spacing.md, paddingTop: spacing.lg },
  sortTitle: { fontSize: 13, fontWeight: "800", color: colors.muted, textTransform: "uppercase", letterSpacing: 0.5, paddingHorizontal: spacing.xl, marginBottom: spacing.xs },
  sortRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.xl, paddingVertical: spacing.lg },
  sortRowText: { fontSize: 16, color: colors.onSurface },
  sortRowActive: { fontWeight: "800", color: colors.brand },
  metaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, marginTop: spacing.md, marginBottom: spacing.xs, gap: spacing.sm },
  count: { fontSize: 13, color: colors.muted, fontWeight: "700" },
  devBadge: { paddingHorizontal: spacing.sm, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary, borderWidth: 1, borderColor: colors.borderStrong },
  devBadgeText: { fontSize: 11, fontWeight: "900", color: colors.onSurfaceTertiary, letterSpacing: 0.4 },
  noMore: { textAlign: "center", color: colors.muted, fontSize: 13, fontWeight: "600", paddingVertical: spacing.md },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.xl },
  emptyText: { color: colors.muted, fontSize: 15, textAlign: "center", fontWeight: "600" },
  retryBtn: { backgroundColor: colors.brand, paddingHorizontal: spacing.xl, paddingVertical: spacing.sm, borderRadius: radius.pill },
  retryText: { color: colors.onBrand, fontWeight: "800" },
  cardWrap: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.lg },
  mapCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, ...shadow.float },
  mapCardImg: { width: 56, height: 56, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary },
  mapCardName: { fontSize: 16, fontWeight: "800", color: colors.onSurface },
  mapCardMeta: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 2 },
  mapCardRating: { fontSize: 13, fontWeight: "700", color: colors.onSurface },
  mapCardCount: { fontSize: 12, color: colors.muted },
  mapCardOpen: { fontSize: 12, fontWeight: "700", marginTop: 2 },
  mapDismiss: { position: "absolute", top: -12, right: spacing.lg + 4, backgroundColor: colors.surface, borderRadius: 14 },
});
