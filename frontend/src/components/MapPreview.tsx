import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import MapShops from "@/src/components/MapShops";
import { useI18n } from "@/src/i18n";
import { colors, spacing, radius, shadow } from "@/src/theme";

// A non-interactive map card that expands to the full /map screen on tap.
export default function MapPreview({
  shops,
  region,
  focusId,
  onPress,
  testID,
}: {
  shops: any[];
  region?: { latitude: number; longitude: number };
  focusId?: string;
  onPress: () => void;
  testID?: string;
}) {
  const { t } = useI18n();
  return (
    <View style={styles.card}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <MapShops shops={shops} region={region} focusId={focusId} interactive={false} />
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

const styles = StyleSheet.create({
  card: {
    height: 180,
    borderRadius: radius.md,
    overflow: "hidden",
    backgroundColor: colors.surfaceTertiary,
    ...shadow.card,
  },
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
