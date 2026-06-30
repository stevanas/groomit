import React, { useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, Pressable, ScrollView } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MapShops from "@/src/components/MapShops";
import CategoryChips from "@/src/components/CategoryChips";
import { useShops } from "@/src/useShops";
import { photoUrl } from "@/src/api";
import { colors, spacing, radius, shadow } from "@/src/theme";

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [category, setCategory] = useState("all");
  const { shops, region, loading, error, reload } = useShops(category);

  const go = (s: any) => router.push(`/shop/${s.id}`);

  return (
    <View style={styles.container} testID="explore-screen">
      <View style={StyleSheet.absoluteFill}>
        <MapShops shops={shops} region={region} onSelect={go} />
      </View>

      {/* Floating header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]} pointerEvents="box-none">
        <View style={styles.searchBar}>
          <Ionicons name="paw" size={20} color={colors.brand} />
          <Text style={styles.searchText}>Find pet shops & groomers</Text>
        </View>
        <CategoryChips value={category} onChange={setCategory} />
      </View>

      {loading && (
        <View style={styles.loadingPill} testID="explore-loading">
          <ActivityIndicator color={colors.brand} />
          <Text style={styles.loadingText}>Sniffing out spots…</Text>
        </View>
      )}

      {error && !loading && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={reload} testID="explore-retry">
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      )}

      {/* Top picks carousel */}
      {!loading && shops.length > 0 && (
        <View style={[styles.carouselWrap, { bottom: spacing.md }]} pointerEvents="box-none">
          <Text style={styles.carouselTitle}>Top Picks Nearby</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carousel}>
            {shops.map((s) => (
              <Pressable key={s.id} style={styles.pick} onPress={() => go(s)} testID={`top-pick-${s.id}`}>
                <Image source={{ uri: photoUrl(s) || undefined }} style={styles.pickImg} contentFit="cover" />
                <View style={styles.pickBody}>
                  <Text style={styles.pickName} numberOfLines={1}>{s.name}</Text>
                  <View style={styles.pickMeta}>
                    <Ionicons name="star" size={12} color={colors.warning} />
                    <Text style={styles.pickRating}>{s.rating ?? "–"}</Text>
                    <Text style={styles.pickCat}>· {s.category === "groomer" ? "Groomer" : "Shop"}</Text>
                  </View>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surfaceTertiary },
  header: { position: "absolute", top: 0, left: 0, right: 0, gap: spacing.sm },
  searchBar: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginHorizontal: spacing.lg, backgroundColor: colors.surfaceSecondary, borderRadius: radius.pill, paddingHorizontal: spacing.lg, height: 52, ...shadow.float },
  searchText: { color: colors.muted, fontSize: 15, fontWeight: "600" },
  loadingPill: { position: "absolute", alignSelf: "center", top: "45%", flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surfaceSecondary, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radius.pill, ...shadow.float },
  loadingText: { color: colors.onSurface, fontWeight: "700" },
  errorBox: { position: "absolute", alignSelf: "center", top: "45%", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surfaceSecondary, padding: spacing.lg, borderRadius: radius.md, ...shadow.float },
  errorText: { color: colors.onSurface, fontWeight: "700" },
  retryBtn: { backgroundColor: colors.brand, paddingHorizontal: spacing.xl, paddingVertical: spacing.sm, borderRadius: radius.pill },
  retryText: { color: colors.onBrand, fontWeight: "800" },
  carouselWrap: { position: "absolute", left: 0, right: 0, gap: spacing.sm },
  carouselTitle: { fontSize: 16, fontWeight: "900", color: colors.onSurface, marginHorizontal: spacing.lg, textShadowColor: "rgba(255,255,255,0.8)", textShadowRadius: 6 },
  carousel: { gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.xs },
  pick: { width: 220, flexDirection: "row", backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, overflow: "hidden", ...shadow.float },
  pickImg: { width: 64, height: 64, backgroundColor: colors.surfaceTertiary },
  pickBody: { flex: 1, padding: spacing.sm, justifyContent: "center" },
  pickName: { fontSize: 14, fontWeight: "800", color: colors.onSurface },
  pickMeta: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 4 },
  pickRating: { fontSize: 12, fontWeight: "700", color: colors.onSurface },
  pickCat: { fontSize: 12, color: colors.muted },
});
