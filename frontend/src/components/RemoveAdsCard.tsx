import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { usePremium } from "@/src/premium";
import { useI18n } from "@/src/i18n";
import { spacing, radius, shadow, ThemeColors } from "@/src/theme";
import { useTheme, useThemedStyles } from "@/src/theme-context";

export default function RemoveAdsCard() {
  const { t } = useI18n();
  const { isPremium, available, price, buy, restore } = usePremium();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [busy, setBusy] = useState<null | "buy" | "restore">(null);
  const displayPrice = price || "€1.99";

  const onBuy = async () => {
    if (!available) {
      Alert.alert(t("support.title"), t("support.unavailable"));
      return;
    }
    setBusy("buy");
    try {
      await buy();
    } catch {
      Alert.alert(t("support.title"), t("support.failed"));
    } finally {
      setBusy(null);
    }
  };

  const onRestore = async () => {
    if (!available) {
      Alert.alert(t("support.title"), t("support.unavailable"));
      return;
    }
    setBusy("restore");
    try {
      const ok = await restore();
      if (!ok) Alert.alert(t("support.title"), t("support.noPurchases"));
    } finally {
      setBusy(null);
    }
  };

  if (isPremium) {
    return (
      <View style={[styles.card, styles.thanksCard]} testID="premium-thanks">
        <Ionicons name="heart" size={22} color={colors.error} />
        <Text style={styles.thanksText}>{t("support.thanks")}</Text>
      </View>
    );
  }

  return (
    <View style={styles.card} testID="remove-ads-card">
      <View style={styles.header}>
        <View style={styles.icon}><Ionicons name="heart" size={20} color={colors.onBrand} /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{t("support.removeAdsTitle")}</Text>
          <Text style={styles.desc}>{t("support.desc")}</Text>
        </View>
        <View style={styles.priceBadge}><Text style={styles.priceText}>{displayPrice}</Text></View>
      </View>

      <Pressable style={styles.buyBtn} onPress={onBuy} disabled={busy !== null} testID="buy-remove-ads">
        {busy === "buy" ? (
          <ActivityIndicator color={colors.onBrand} />
        ) : (
          <>
            <Ionicons name="sparkles" size={18} color={colors.onBrand} />
            <Text style={styles.buyText} numberOfLines={1}>{t("support.buy")}</Text>
          </>
        )}
      </Pressable>

      <Pressable style={styles.restoreBtn} onPress={onRestore} disabled={busy !== null} testID="restore-purchase">
        <Text style={styles.restoreText}>{busy === "restore" ? t("support.processing") : t("support.restore")}</Text>
      </Pressable>

      <Text style={styles.thanksAdvance}>{t("support.thanksAdvance")}</Text>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.lg, gap: spacing.md, ...shadow.card },
  thanksCard: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  thanksText: { flex: 1, fontSize: 14, fontWeight: "700", color: colors.onSurface },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  icon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 16, fontWeight: "800", color: colors.onSurface },
  desc: { fontSize: 13, color: colors.muted, marginTop: 2, lineHeight: 18 },
  priceBadge: { backgroundColor: colors.brandTertiary, paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill },
  priceText: { fontSize: 15, fontWeight: "900", color: colors.onBrandTertiary },
  buyBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, height: 52, borderRadius: radius.pill, backgroundColor: colors.brand, paddingHorizontal: spacing.md },
  buyText: { color: colors.onBrand, fontSize: 15, fontWeight: "800", flexShrink: 1 },
  restoreBtn: { alignItems: "center", justifyContent: "center", height: 32 },
  restoreText: { color: colors.muted, fontSize: 14, fontWeight: "700" },
  thanksAdvance: { textAlign: "center", color: colors.muted, fontSize: 12, fontWeight: "600", marginTop: 2 },
});
