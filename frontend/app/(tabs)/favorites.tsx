import React, { useState, useCallback, useMemo } from "react";
import { View, Text, StyleSheet, FlatList, ActivityIndicator, ScrollView, Pressable, Alert, useWindowDimensions } from "react-native";
import * as Location from "expo-location";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ShopCard from "@/src/components/ShopCard";
import { getFavorites, clearFavorites } from "@/src/favorites";
import { useI18n } from "@/src/i18n";
import { spacing, radius, fonts, ThemeColors } from "@/src/theme";
import { distanceKm } from "@/src/utils/distance";
import { useTheme, useThemedStyles } from "@/src/theme-context";

const CATEGORY_ORDER = ["groomer", "groomerShop", "shop", "vet", "pharmacy"] as const;
type CategoryKey = (typeof CATEGORY_ORDER)[number];
const LOCATION_CACHE_TTL_MS = 10 * 60 * 1000;

let lastUserLoc: { latitude: number; longitude: number } | null = null;
let lastUserLocTs = 0;

const normalizeCategory = (category?: string) => {
  if (category === "both") return "groomerShop";
  if (CATEGORY_ORDER.includes(category as CategoryKey)) return category as CategoryKey;
  return "shop" as CategoryKey;
};

export default function FavoritesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useI18n();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const styles = useThemedStyles(makeStyles);
  const [favs, setFavs] = useState<any[]>([]);
  const [userLoc, setUserLoc] = useState<{ latitude: number; longitude: number } | null>(null);
  const [loading, setLoading] = useState(true);

  const resolveUserLoc = useCallback(async () => {
    if (lastUserLoc && Date.now() - lastUserLocTs < LOCATION_CACHE_TTL_MS) {
      setUserLoc(lastUserLoc);
      return;
    }
    try {
      let { status } = await Location.getForegroundPermissionsAsync();
      if (status !== "granted") {
        const req = await Location.requestForegroundPermissionsAsync();
        status = req.status;
      }
      if (status !== "granted") return;
      const pos =
        (await Location.getLastKnownPositionAsync()) ||
        (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
      if (!pos) return;
      const next = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      lastUserLoc = next;
      lastUserLocTs = Date.now();
      setUserLoc(next);
    } catch {
      // Keep existing location value if location APIs fail.
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getFavorites();
      setFavs(data.map((f: any) => ({ ...f, id: f.place_id, category: normalizeCategory(f.category) })));
    } catch {
      setFavs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    load();
    resolveUserLoc();
  }, [load, resolveUserLoc]));

  const favsWithDistance = useMemo(() => {
    if (!userLoc) return favs;
    return favs.map((item) => ({
      ...item,
      distanceKm: distanceKm(userLoc, item.latitude, item.longitude),
    }));
  }, [favs, userLoc]);

  const grouped = useMemo(() => {
    const groups = new Map<CategoryKey, any[]>();
    CATEGORY_ORDER.forEach((key) => groups.set(key, []));
    favsWithDistance.forEach((item) => {
      const key = normalizeCategory(item.category);
      groups.get(key)?.push(item);
    });
    return CATEGORY_ORDER
      .map((key) => ({ key, items: groups.get(key) || [] }))
      .filter((section) => section.items.length > 0);
  }, [favsWithDistance]);

  const cardWidth = useMemo(() => {
    const horizontalPadding = spacing.lg * 2;
    return Math.min(360, Math.max(300, width - horizontalPadding));
  }, [width]);

  const onClearAll = useCallback(() => {
    Alert.alert(
      t("saved.clearAllTitle"),
      t("saved.clearAllBody"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("saved.clearAllConfirm"),
          style: "destructive",
          onPress: async () => {
            await clearFavorites();
            setFavs([]);
          },
        },
      ],
    );
  }, [t]);

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.md }]} testID="favorites-screen">
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.title}>{t("saved.title")}</Text>
          {favs.length > 0 && !loading && (
            <Pressable style={styles.clearAllBtn} onPress={onClearAll} testID="favorites-clear-all">
              <Ionicons name="trash-outline" size={14} color={colors.error} />
              <Text style={styles.clearAllText}>{t("saved.clearAll")}</Text>
            </Pressable>
          )}
        </View>
        <Text style={styles.subtitle}>{t("saved.sub")}</Text>
      </View>
      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.brand} /></View>
      ) : favs.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="heart-outline" size={56} color={colors.muted} />
          <Text style={styles.emptyText}>{t("saved.empty")}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxxl }} showsVerticalScrollIndicator={false}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryText}>{t("browse.results", { count: favs.length })}</Text>
          </View>
          {grouped.map((section) => {
            const titleKey =
              section.key === "groomer"
                ? "common.groomer"
                : section.key === "groomerShop"
                  ? "common.groomerShop"
                  : section.key === "vet"
                    ? "common.vet"
                    : section.key === "pharmacy"
                      ? "common.pharmacy"
                      : "common.shop";
            return (
              <View key={section.key} style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionTitleRow}>
                    <Ionicons
                      name={section.key === "groomer" ? "cut" : section.key === "groomerShop" ? "ribbon" : section.key === "vet" ? "medkit" : section.key === "pharmacy" ? "add" : "storefront"}
                      size={16}
                      color={colors.brand}
                    />
                    <Text style={styles.sectionTitle}>{t(titleKey)}</Text>
                  </View>
                  <Text style={styles.sectionCount}>{section.items.length}</Text>
                </View>

                <FlatList
                  data={section.items}
                  keyExtractor={(item) => item.place_id}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  decelerationRate="fast"
                  snapToAlignment="start"
                  snapToInterval={cardWidth + spacing.md}
                  contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.md }}
                  renderItem={({ item }) => (
                    <View style={[styles.cardWrap, { width: cardWidth }]}> 
                      <ShopCard shop={item} onPress={() => router.push(`/shop/${item.place_id}`)} />
                    </View>
                  )}
                />
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md },
  headerTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  title: { fontSize: 28, fontWeight: "800", color: colors.onSurface, fontFamily: fonts.display },
  subtitle: { fontSize: 14, color: colors.muted, marginTop: 2 },
  clearAllBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary },
  clearAllText: { fontSize: 11, fontWeight: "800", color: colors.error, textTransform: "uppercase" },
  summaryRow: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  summaryText: { fontSize: 13, fontWeight: "800", color: colors.muted, textTransform: "uppercase", letterSpacing: 0.4 },
  section: { marginBottom: spacing.lg },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexShrink: 1 },
  sectionTitle: { fontSize: 18, fontWeight: "800", color: colors.onSurface },
  sectionCount: { fontSize: 13, fontWeight: "800", color: colors.muted, backgroundColor: colors.surfaceTertiary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  cardWrap: { width: 336 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.xl },
  emptyText: { color: colors.muted, fontSize: 15, textAlign: "center", fontWeight: "600" },
});
