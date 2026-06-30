import React from "react";
import { Text, StyleSheet, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { usePremium } from "@/src/premium";
import { useI18n } from "@/src/i18n";
import { spacing, radius, ThemeColors } from "@/src/theme";
import { useTheme, useThemedStyles } from "@/src/theme-context";

// Discreet upsell strip shown above the ad banner; deep-links to the Support card.
export default function AdUpsell() {
  const { isPremium, loading } = usePremium();
  const router = useRouter();
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);

  if (loading || isPremium) return null;

  return (
    <Pressable style={styles.wrap} onPress={() => router.push("/(tabs)/profile")} testID="ad-upsell">
      <Ionicons name="sparkles" size={13} color={colors.brand} />
      <Text style={styles.text}>{t("support.upsell")}</Text>
      <Ionicons name="chevron-forward" size={13} color={colors.brand} />
    </Pressable>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrap: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 5,
      alignSelf: "center",
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
      borderRadius: radius.pill,
      backgroundColor: colors.brandTertiary,
      marginVertical: spacing.sm,
    },
    text: { fontSize: 12, fontWeight: "800", color: colors.onBrandTertiary },
  });
