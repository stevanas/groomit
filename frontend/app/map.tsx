import React from "react";
import { View, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MapShops from "@/src/components/MapShops";
import { useShops } from "@/src/useShops";
import { useI18n } from "@/src/i18n";
import { colors, spacing, shadow } from "@/src/theme";

export default function MapScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { lang } = useI18n();
  const params = useLocalSearchParams<{ lat?: string; lng?: string; focusId?: string; category?: string }>();

  const center =
    params.lat && params.lng ? { latitude: Number(params.lat), longitude: Number(params.lng) } : undefined;

  const { shops, region, loading } = useShops(params.category || "all", { lang, center });

  return (
    <View style={styles.container} testID="map-screen">
      <MapShops
        shops={shops}
        region={center || region}
        focusId={params.focusId}
        onSelect={(s) => router.push(`/shop/${s.id}`)}
      />

      <Pressable
        style={[styles.close, { top: insets.top + spacing.sm }]}
        onPress={() => router.back()}
        testID="map-close"
      >
        <Ionicons name="close" size={24} color={colors.onSurface} />
      </Pressable>

      {loading && (
        <View style={styles.loading} pointerEvents="none">
          <ActivityIndicator size="large" color={colors.brand} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
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
});
