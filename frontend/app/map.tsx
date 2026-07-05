import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MapShops from "@/src/components/MapShops";
import { useShops } from "@/src/useShops";
import { useI18n } from "@/src/i18n";
import { photoUrl } from "@/src/api";
import { spacing, radius, shadow, getCat, ThemeColors } from "@/src/theme";
import { useTheme, useThemedStyles } from "@/src/theme-context";

export default function MapScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const { lang } = useI18n();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const params = useLocalSearchParams<{ lat?: string; lng?: string; focusId?: string; category?: string }>();

  const center =
    params.lat && params.lng ? { latitude: Number(params.lat), longitude: Number(params.lng) } : undefined;

  const { shops, region, loading } = useShops("all", { lang, center, disablePagination: true });
  const [selected, setSelected] = useState<any>(null);

  const cat = selected ? getCat(selected.category) : null;
  const catLabel = (c?: string) =>
    c === "groomer" ? t("common.groomer") : c === "both" ? t("common.both") : t("common.shop");

  return (
    <View style={styles.container} testID="map-screen">
      <MapShops
        shops={shops}
        region={center || region}
        focusId={params.focusId}
        onSelect={(s) => setSelected(s)}
      />

      <Pressable
        style={[styles.close, { top: insets.top + spacing.sm }]}
        onPress={() => router.back()}
        testID="map-close"
      >
        <Ionicons name="close" size={24} color="#2A211C" />
      </Pressable>

      {loading && (
        <View style={styles.loading} pointerEvents="none">
          <ActivityIndicator size="large" color={colors.brand} />
        </View>
      )}

      {selected && (
        <View style={[styles.cardWrap, { paddingBottom: insets.bottom + spacing.md }]}>
          <Pressable style={styles.card} onPress={() => router.push(`/shop/${selected.id}`)} testID="map-shop-card">
            <Image source={{ uri: photoUrl(selected, { size: "preview" }) || undefined }} style={styles.cardImg} contentFit="cover" />
            <View style={styles.cardBody}>
              <Text style={styles.cardName} numberOfLines={1}>{selected.name}</Text>
              <View style={styles.cardMeta}>
                <Ionicons name="star" size={13} color={colors.warning} />
                <Text style={styles.cardRating}>{selected.rating ?? "–"}</Text>
                {selected.user_rating_count ? <Text style={styles.cardCount}>({selected.user_rating_count})</Text> : null}
                {cat && (
                  <View style={[styles.cardTag, { backgroundColor: cat.soft }]}>
                    <Text style={[styles.cardTagText, { color: cat.onSoft }]}>{catLabel(selected.category)}</Text>
                  </View>
                )}
              </View>
              {selected.open_now != null && (
                <Text style={[styles.cardOpen, { color: selected.open_now ? colors.success : colors.muted }]}>
                  {selected.open_now ? t("common.open") : t("common.closed")}
                </Text>
              )}
            </View>
            <Ionicons name="chevron-forward" size={22} color={colors.muted} />
          </Pressable>
          <Pressable style={styles.dismiss} onPress={() => setSelected(null)} testID="map-card-dismiss">
            <Ionicons name="close-circle" size={26} color={colors.muted} />
          </Pressable>
        </View>
      )}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  close: {
    position: "absolute",
    left: spacing.lg,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.95)",
    alignItems: "center",
    justifyContent: "center",
    ...shadow.float,
  },
  loading: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  cardWrap: { position: "absolute", left: 0, right: 0, bottom: 0, padding: spacing.lg },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    padding: spacing.sm,
    paddingRight: spacing.md,
    ...shadow.float,
  },
  cardImg: { width: 64, height: 64, borderRadius: radius.sm, backgroundColor: colors.surfaceTertiary },
  cardBody: { flex: 1, gap: 3 },
  cardName: { fontSize: 15, fontWeight: "800", color: colors.onSurface },
  cardMeta: { flexDirection: "row", alignItems: "center", gap: 4 },
  cardRating: { fontSize: 13, fontWeight: "800", color: colors.onSurface },
  cardCount: { fontSize: 12, color: colors.muted },
  cardTag: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.pill, marginLeft: 4 },
  cardTagText: { fontSize: 11, fontWeight: "800" },
  cardOpen: { fontSize: 12, fontWeight: "800" },
  dismiss: { position: "absolute", top: spacing.sm, right: spacing.xl + 2, backgroundColor: "#fff", borderRadius: 13 },
});
