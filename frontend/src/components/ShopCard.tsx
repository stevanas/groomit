import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, radius, shadow } from "@/src/theme";
import { photoUrl } from "@/src/api";
import { useI18n } from "@/src/i18n";

export default function ShopCard({ shop, onPress }: { shop: any; onPress: () => void }) {
  const { t } = useI18n();
  const uri = photoUrl(shop);
  return (
    <Pressable style={styles.card} onPress={onPress} testID={`shop-card-${shop.id}`}>
      <Image source={{ uri: uri || undefined }} style={styles.img} contentFit="cover" transition={200} />
      <View style={styles.body}>
        <View style={styles.rowBetween}>
          <Text style={styles.name} numberOfLines={1}>{shop.name}</Text>
          {shop.open_now != null && (
            <View style={[styles.badge, { backgroundColor: shop.open_now ? colors.brandTertiary : colors.surfaceTertiary }]}>
              <Text style={[styles.badgeText, { color: shop.open_now ? colors.onBrandTertiary : colors.muted }]}>
                {shop.open_now ? t("common.open") : t("common.closed")}
              </Text>
            </View>
          )}
        </View>
        <Text style={styles.addr} numberOfLines={1}>{shop.address}</Text>
        <View style={styles.metaRow}>
          <View style={styles.tag}>
            <Ionicons name={shop.category === "groomer" ? "cut" : "storefront"} size={12} color={colors.onBrandSecondary} />
            <Text style={styles.tagText}>{shop.category === "groomer" ? t("common.groomer") : t("common.shop")}</Text>
          </View>
          <View style={styles.ratingRow}>
            <Ionicons name="star" size={14} color={colors.warning} />
            <Text style={styles.rating}>{shop.rating ?? "–"}</Text>
            {shop.user_rating_count ? <Text style={styles.count}>({shop.user_rating_count})</Text> : null}
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: "row", backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, overflow: "hidden", ...shadow.card },
  img: { width: 104, height: 104, backgroundColor: colors.surfaceTertiary },
  body: { flex: 1, padding: spacing.md, justifyContent: "center" },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  name: { fontSize: 16, fontWeight: "800", color: colors.onSurface, flex: 1 },
  addr: { fontSize: 13, color: colors.muted, marginTop: 2 },
  metaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.sm },
  tag: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.brandSecondary, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.pill },
  tagText: { fontSize: 11, fontWeight: "700", color: colors.onBrandSecondary },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  rating: { fontSize: 14, fontWeight: "800", color: colors.onSurface },
  count: { fontSize: 12, color: colors.muted },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.pill },
  badgeText: { fontSize: 11, fontWeight: "700" },
});
