import React, { useState, useCallback } from "react";
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ShopCard from "@/src/components/ShopCard";
import { getFavorites } from "@/src/favorites";
import { useI18n } from "@/src/i18n";
import { colors, spacing, fonts } from "@/src/theme";

export default function FavoritesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useI18n();
  const [favs, setFavs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getFavorites();
      setFavs(data.map((f: any) => ({ ...f, id: f.place_id })));
    } catch {
      setFavs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View style={[styles.container, { paddingTop: insets.top }]} testID="favorites-screen">
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md },
  title: { fontSize: 28, fontWeight: "800", color: colors.onSurface, fontFamily: fonts.display },
  subtitle: { fontSize: 14, color: colors.muted, marginTop: 2 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.xl },
  emptyText: { color: colors.muted, fontSize: 15, textAlign: "center", fontWeight: "600" },
});
