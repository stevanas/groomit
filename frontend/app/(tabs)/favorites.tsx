import React, { useState, useCallback } from "react";
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ShopCard from "@/src/components/ShopCard";
import { getFavorites } from "@/src/favorites";
import { apiGet } from "@/src/api";
import { useI18n } from "@/src/i18n";
import { spacing, fonts, ThemeColors } from "@/src/theme";
import { useTheme, useThemedStyles } from "@/src/theme-context";

export default function FavoritesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t, lang } = useI18n();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [favs, setFavs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getFavorites();
      const base = data.map((f: any) => ({ ...f, id: f.place_id }));
      setFavs(base);
      setLoading(false);
      // Enrich with live open status + schedule so cards match the list section.
      const enriched = await Promise.all(
        base.map(async (f: any) => {
          try {
            const d = await apiGet(`/places/${f.place_id}?lang=${lang}`);
            return { ...f, open_now: d.open_now, schedule: d.schedule };
          } catch {
            return f;
          }
        }),
      );
      setFavs(enriched);
    } catch {
      setFavs([]);
      setLoading(false);
    }
  }, [lang]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.md }]} testID="favorites-screen">
      <View style={styles.header}>
        <Text style={styles.title}>{t("saved.title")}</Text>
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
        <FlatList
          data={favs}
          keyExtractor={(item) => item.place_id}
          renderItem={({ item }) => <ShopCard shop={item} onPress={() => router.push(`/shop/${item.place_id}`)} />}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxxl }}
        />
      )}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md },
  title: { fontSize: 28, fontWeight: "800", color: colors.onSurface, fontFamily: fonts.display },
  subtitle: { fontSize: 14, color: colors.muted, marginTop: 2 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.xl },
  emptyText: { color: colors.muted, fontSize: 15, textAlign: "center", fontWeight: "600" },
});
