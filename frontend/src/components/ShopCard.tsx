import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, radius, shadow, getCat } from "@/src/theme";
import { photoUrl } from "@/src/api";
import { useI18n } from "@/src/i18n";

const catLabelKey = (c?: string) =>
  c === "groomer" ? "common.groomer" : c === "both" ? "common.both" : "common.shop";
const catIcon = (c?: string) => (c === "groomer" ? "cut" : c === "both" ? "ribbon" : "storefront");

export default function ShopCard({ shop, onPress }: { shop: any; onPress: () => void }) {
  const { t } = useI18n();
  const uri = photoUrl(shop);
  const cat = getCat(shop.category);
  return (
    <Pressable style={styles.card} onPress={onPress} testID={`shop-card-${shop.id}`}>
      <Image source={{ uri: uri || undefined }} style={styles.img} contentFit="cover" transition={200} />
      <View style={styles.body}>
        <View style={styles.rowTop}>
          <Text style={styles.name} numberOfLines={2}>{shop.name}</Text>
          <View style={styles.ratingRow}>
            <Ionicons name="star" size={14} color={colors.warning} />
            <Text style={styles.rating}>{shop.rating ?? "–"}</Text>
            {shop.user_rating_count ? <Text style={styles.count}>({shop.user_rating_count})</Text> : null}
          </View>
        </View>
        <Text style={styles.addr} numberOfLines={1}>
          {shop.address}
          {shop.distanceKm != null ? `  ·  ${shop.distanceKm < 10 ? shop.distanceKm.toFixed(1) : Math.round(shop.distanceKm)} ${t("browse.km")}` : ""}
        </Text>
        <View style={styles.metaRow}>
          <View style={[styles.tag, { backgroundColor: cat.soft }]}>
            <Ionicons name={catIcon(shop.category)} size={12} color={cat.onSoft} />
            <Text style={[styles.tagText, { color: cat.onSoft }]} numberOfLines={1}>{t(catLabelKey(shop.category))}</Text>
          </View>
          {shop.open_now != null && (
            <View style={[styles.badge, { backgroundColor: shop.open_now ? colors.brandTertiary : colors.surfaceTertiary }]}>
              <Ionicons name={shop.open_now ? "time" : "time-outline"} size={11} color={shop.open_now ? colors.success : colors.muted} />
              <Text style={[styles.badgeText, { color: shop.open_now ? colors.success : colors.muted }]}>
                {shop.open_now ? t("common.open") : t("common.closed")}
              </Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: "row", backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, overflow: "hidden", minHeight: 104, ...shadow.card },
  img: { width: 96, alignSelf: "stretch", minHeight: 104, backgroundColor: colors.surfaceTertiary },
  body: { flex: 1, padding: spacing.md, justifyContent: "center" },
  rowTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.sm },
  name: { fontSize: 16, fontWeight: "800", color: colors.onSurface, flex: 1, lineHeight: 20 },
  addr: { fontSize: 13, color: colors.muted, marginTop: 2 },
  metaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.sm, gap: spacing.xs },
  tag: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.pill, flexShrink: 1 },
  tagText: { fontSize: 11, fontWeight: "800" },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 3, flexShrink: 0, marginTop: 1 },
  rating: { fontSize: 14, fontWeight: "800", color: colors.onSurface },
  count: { fontSize: 12, color: colors.muted },
  badge: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.pill, flexShrink: 0 },
  badgeText: { fontSize: 11, fontWeight: "800" },
});
