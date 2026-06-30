import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { usePremium } from "@/src/premium";
import { useI18n } from "@/src/i18n";
import { colors, spacing, radius, shadow } from "@/src/theme";

export default function RemoveAdsCard() {
  const { t } = useI18n();
  const { isPremium, available, buy, restore } = usePremium();
  const [busy, setBusy] = useState<null | "buy" | "restore">(null);

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
      </View>

      <Pressable style={styles.buyBtn} onPress={onBuy} disabled={busy !== null} testID="buy-remove-ads">
        {busy === "buy" ? (
          <ActivityIndicator color={colors.onBrand} />
        ) : (
          <>
            <Ionicons name="sparkles" size={18} color={colors.onBrand} />
            <Text style={styles.buyText}>{t("support.buy")}</Text>
          </>
        )}
      </Pressable>

      <Pressable style={styles.restoreBtn} onPress={onRestore} disabled={busy !== null} testID="restore-purchase">
        <Text style={styles.restoreText}>{busy === "restore" ? t("support.processing") : t("support.restore")}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.lg, gap: spacing.md, ...shadow.card },
  thanksCard: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  thanksText: { flex: 1, fontSize: 14, fontWeight: "700", color: colors.onSurface },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  icon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 16, fontWeight: "800", color: colors.onSurface },
  desc: { fontSize: 13, color: colors.muted, marginTop: 2, lineHeight: 18 },
  buyBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, height: 50, borderRadius: radius.pill, backgroundColor: colors.brand },
  buyText: { color: colors.onBrand, fontSize: 15, fontWeight: "800" },
  restoreBtn: { alignItems: "center", justifyContent: "center", height: 36 },
  restoreText: { color: colors.muted, fontSize: 14, fontWeight: "700" },
});
