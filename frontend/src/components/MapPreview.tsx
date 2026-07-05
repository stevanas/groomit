import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import MapShops from "@/src/components/MapShops";
import { useI18n } from "@/src/i18n";
import { spacing, radius, shadow, ThemeColors } from "@/src/theme";
import { useTheme, useThemedStyles } from "@/src/theme-context";
import { mapsDisabled } from "@/src/feature-flags";

// A non-interactive map card that expands to the full /map screen on tap.
export default function MapPreview({
  shops,
  region,
  focusId,
  delta,
  onPress,
  testID,
}: {
  shops: any[];
  region?: { latitude: number; longitude: number };
  focusId?: string;
  delta?: number;
  onPress: () => void;
  testID?: string;
}) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);

  if (mapsDisabled) {
    return (
      <View style={styles.card} testID={testID}>
        <View style={styles.disabledCenter}>
          <Ionicons name="map-outline" size={28} color={colors.muted} />
          <Text style={styles.disabledText}>Map preview is off while spend controls are active.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <MapShops shops={shops} region={region} focusId={focusId} interactive={false} delta={delta} />
      </View>
      <Pressable style={StyleSheet.absoluteFill} onPress={onPress} testID={testID}>
        <View style={styles.badge}>
          <Ionicons name="expand" size={14} color={colors.onBrand} />
          <Text style={styles.badgeText}>{t("map.expand")}</Text>
        </View>
      </Pressable>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  card: {
    height: 180,
    borderRadius: radius.md,
    overflow: "hidden",
    backgroundColor: colors.surfaceTertiary,
    ...shadow.card,
  },
  disabledCenter: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, padding: spacing.lg },
  disabledText: { color: colors.muted, fontSize: 13, fontWeight: "700", textAlign: "center" },
  badge: {
    position: "absolute",
    right: spacing.sm,
    bottom: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
  },
  badgeText: { color: colors.onBrand, fontSize: 12, fontWeight: "800" },
});
