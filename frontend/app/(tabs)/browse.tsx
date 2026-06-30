import React, { useState, useMemo, useEffect } from "react";
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator, Pressable, TextInput, RefreshControl, Platform,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ShopCard from "@/src/components/ShopCard";
import CategoryChips from "@/src/components/CategoryChips";
import MapShops from "@/src/components/MapShops";
import { useShops } from "@/src/useShops";
import { useI18n } from "@/src/i18n";
import { colors, spacing, radius, shadow } from "@/src/theme";

const IS_WEB = Platform.OS === "web";

export default function BrowseScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t, lang } = useI18n();
  const params = useLocalSearchParams<{ category?: string; location?: string; day?: string }>();

  const [category, setCategory] = useState(params.category || "all");
  const [query, setQuery] = useState("");
  const [openNowOnly, setOpenNowOnly] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "map">("list");

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
    let res = shops;
    if (q) res = res.filter((s) => s.name.toLowerCase().includes(q) || (s.address || "").toLowerCase().includes(q));
    if (openNowOnly) res = res.filter((s) => s.open_now === true);
    return res;
  }, [shops, query, openNowOnly]);

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
          <Ionicons name="time" size={14} color={openNowOnly ? colors.onBrand : colors.success} />
          <Text style={[styles.filterText, openNowOnly && styles.filterTextActive]}>{t("filter.openNow")}</Text>
        </Pressable>
      </View>

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
  filterRow: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.lg, marginTop: spacing.xs },
  filterChip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: spacing.md, height: 34, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  filterChipActive: { backgroundColor: colors.success, borderColor: colors.success },
  filterText: { fontSize: 13, fontWeight: "800", color: colors.success },
  filterTextActive: { color: colors.onBrand },
  count: { fontSize: 13, color: colors.muted, fontWeight: "700", paddingHorizontal: spacing.lg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.xl },
  emptyText: { color: colors.muted, fontSize: 15, textAlign: "center", fontWeight: "600" },
  retryBtn: { backgroundColor: colors.brand, paddingHorizontal: spacing.xl, paddingVertical: spacing.sm, borderRadius: radius.pill },
  retryText: { color: colors.onBrand, fontWeight: "800" },
});
