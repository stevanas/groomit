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
import { useShops } from "@/src/useShops";
import { useI18n } from "@/src/i18n";
import { colors, spacing, radius } from "@/src/theme";

const IS_WEB = Platform.OS === "web";

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
  const params = useLocalSearchParams<{ category?: string; location?: string; day?: string }>();

  const [category, setCategory] = useState(params.category || "all");
  const [query, setQuery] = useState("");
  const [openNowOnly, setOpenNowOnly] = useState(false);
  const [openUntil, setOpenUntil] = useState<string | null>(null);
  const [sort, setSort] = useState<"recommended" | "distance" | "rating">("recommended");
  const [sortOpen, setSortOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "map">("list");

  const todayIdx = (new Date().getDay() + 6) % 7;

  // Keep filters in sync when arriving from the Find form with new params.
  useEffect(() => {
    if (params.category) setCategory(params.category);
  }, [params.category]);

  const day = params.day ? Number(params.day) : -1;
  const { shops, region, loading, error, reload } = useShops(category, {
    locationQuery: params.location,
    day,
    lang,
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let res = shops.map((s) => ({ ...s, distanceKm: distanceKm(region, s.latitude, s.longitude) }));
    if (q) res = res.filter((s) => s.name.toLowerCase().includes(q) || (s.address || "").toLowerCase().includes(q));
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
    if (sort === "rating") res = [...res].sort((a, b) => (b.rating || 0) - (a.rating || 0));
    else if (sort === "distance") res = [...res].sort((a, b) => (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9));
    return res;
  }, [shops, region, query, openNowOnly, openUntil, sort, todayIdx]);

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
    category !== "all" || query.trim() !== "" || openNowOnly || openUntil !== null || sort !== "recommended";

  const clearFilters = () => {
    setCategory("all");
    setQuery("");
    setOpenNowOnly(false);
    setOpenUntil(null);
    setSort("recommended");
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
              {(["recommended", "distance", "rating"] as const).map((opt) => (
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
        <Text style={styles.count}>{t("browse.results", { count: filtered.length })}</Text>
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
          <MapShops shops={filtered} region={region} onSelect={go} />
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
          refreshControl={<RefreshControl refreshing={false} onRefresh={reload} tintColor={colors.brand} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
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
  sortChip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: spacing.md, height: 36, borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary, flexShrink: 0 },
  clearBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: spacing.sm, height: 36, flexShrink: 0, marginLeft: "auto" },
  clearText: { fontSize: 13, fontWeight: "700", color: colors.muted },
  sortText: { fontSize: 13, fontWeight: "800", color: colors.onSurfaceTertiary },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sortSheet: { backgroundColor: colors.surfaceSecondary, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, paddingVertical: spacing.md, paddingTop: spacing.lg },
  sortTitle: { fontSize: 13, fontWeight: "800", color: colors.muted, textTransform: "uppercase", letterSpacing: 0.5, paddingHorizontal: spacing.xl, marginBottom: spacing.xs },
  sortRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.xl, paddingVertical: spacing.lg },
  sortRowText: { fontSize: 16, color: colors.onSurface },
  sortRowActive: { fontWeight: "800", color: colors.brand },
  count: { fontSize: 13, color: colors.muted, fontWeight: "700", paddingHorizontal: spacing.lg, marginTop: spacing.md, marginBottom: spacing.xs },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.xl },
  emptyText: { color: colors.muted, fontSize: 15, textAlign: "center", fontWeight: "600" },
  retryBtn: { backgroundColor: colors.brand, paddingHorizontal: spacing.xl, paddingVertical: spacing.sm, borderRadius: radius.pill },
  retryText: { color: colors.onBrand, fontWeight: "800" },
});
