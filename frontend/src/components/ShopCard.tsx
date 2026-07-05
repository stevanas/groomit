import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { spacing, radius, shadow, getCat, ThemeColors, categoryColor } from "@/src/theme";
import { useTheme, useThemedStyles } from "@/src/theme-context";
import { useI18n } from "@/src/i18n";
import { photoUrl } from "@/src/api";
import { formatDistance } from "@/src/utils/distance";

const catLabelKey = (c?: string) =>
  c === "groomer" ? "common.groomer" : (c === "groomerShop" || c === "both") ? "common.groomerShop" : c === "vet" ? "common.vet" : c === "pharmacy" ? "common.pharmacy" : "common.shop";
const catIcon = (c?: string) =>
  c === "groomer" ? "cut" : (c === "groomerShop" || c === "both") ? "ribbon" : c === "vet" ? "medkit" : c === "pharmacy" ? "add" : "storefront";

const TODAY_IDX = (new Date().getDay() + 6) % 7;

export default function ShopCard({ shop, onPress }: { shop: any; onPress: () => void }) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  // Photos are served via the backend proxy, which caches each image for 30 days
  // (persistent Mongo cache) + expo-image caches on device — so each photo is paid at most once.
  const uri = photoUrl(shop, { size: "preview" });
  const cat = getCat(shop.category);
  const today = shop.schedule?.[TODAY_IDX];
  const is24h = today && !today.closed && today.open === "00:00" && today.close === "23:59";
  const closesAt = today && !today.closed && today.close && !is24h ? today.close : null;
  const distLabel = formatDistance(shop.distanceKm, t("browse.km"), t("browse.m"));
  const hasPharmacyTag = (shop.tags || []).includes("pharmacy") && shop.category !== "pharmacy";
  return (
    <Pressable style={styles.card} onPress={onPress} testID={`shop-card-${shop.id}`}>
      <View>
        <Image source={{ uri: uri || undefined }} style={styles.img} contentFit="cover" transition={200} />
        {(closesAt || is24h) && (
          <View style={styles.closesPill}>
            <Ionicons name="hourglass-outline" size={10} color={colors.onAccent} />
            <Text style={styles.closesText}>
              {is24h ? t("card.open24") : t("card.closes", { time: closesAt })}
            </Text>
          </View>
        )}
      </View>
      <View style={styles.body}>
        <View style={styles.rowTop}>
          <Text style={styles.name} numberOfLines={2}>{shop.name}</Text>
          <View style={styles.ratingRow}>
            <Ionicons name="star" size={14} color={colors.warning} />
            <Text style={styles.rating}>{shop.rating ?? "–"}</Text>
            {shop.user_rating_count ? <Text style={styles.count}>({shop.user_rating_count})</Text> : null}
          </View>
        </View>
        <Text style={styles.addr} numberOfLines={1}>{shop.address}</Text>
        <View style={styles.metaRow}>
          <View style={styles.metaLeft}>
            <View style={[styles.tag, { backgroundColor: cat.soft }]}>
              <Ionicons name={catIcon(shop.category)} size={12} color={cat.onSoft} />
              <Text style={[styles.tagText, { color: cat.onSoft }]} numberOfLines={1} ellipsizeMode="tail">
                {t(catLabelKey(shop.category))}
              </Text>
              {hasPharmacyTag && (
                <Ionicons name="add" size={12} color={categoryColor.pharmacy.main} />
              )}
            </View>
            {distLabel && (
              <View style={styles.distChip}>
                <Ionicons name="navigate" size={11} color={colors.muted} />
                <Text style={styles.distText} numberOfLines={1} ellipsizeMode="tail">{distLabel}</Text>
              </View>
            )}
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

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  card: { flexDirection: "row", backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, overflow: "hidden", minHeight: 104, ...shadow.card },
  img: { width: 96, alignSelf: "stretch", minHeight: 104, backgroundColor: colors.surfaceTertiary },
  body: { flex: 1, padding: spacing.md, justifyContent: "center" },
  rowTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.sm, minHeight: 40 },
  name: { fontSize: 16, fontWeight: "800", color: colors.onSurface, flex: 1, lineHeight: 20, minHeight: 40 },
  addr: { fontSize: 13, color: colors.muted, marginTop: 2, lineHeight: 16, minHeight: 16 },
  metaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.sm, gap: spacing.xs },
  metaLeft: { flexDirection: "row", alignItems: "center", gap: spacing.xs, flex: 1, minWidth: 0, flexWrap: "nowrap" },
  distChip: { flexDirection: "row", alignItems: "center", gap: 3, flexShrink: 0, minWidth: 0 },
  distText: { fontSize: 12, fontWeight: "700", color: colors.muted, flexShrink: 0 },
  closesPill: { position: "absolute", top: 6, left: 6, flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: colors.accent },
  closesText: { fontSize: 10, fontWeight: "800", color: colors.onAccent },
  tag: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.pill, flexShrink: 1, minWidth: 0, maxWidth: "68%" },
  tagText: { fontSize: 11, fontWeight: "800", flexShrink: 1, minWidth: 0 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 3, flexShrink: 0, marginTop: 1 },
  rating: { fontSize: 14, fontWeight: "800", color: colors.onSurface },
  count: { fontSize: 12, color: colors.muted },
  badge: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.pill, flexShrink: 0, marginLeft: spacing.xs },
  badgeText: { fontSize: 11, fontWeight: "800" },
});
