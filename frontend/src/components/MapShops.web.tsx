import React from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, radius, shadow } from "@/src/theme";
import { photoUrl } from "@/src/api";

// Web fallback for react-native-maps (no web support).
// Renders a stylized "map" panel listing shop pins.
export default function MapShops({ shops, onSelect }: { shops: any[]; onSelect: (s: any) => void }) {
  return (
    <View style={styles.wrap} testID="map-web-fallback">
      <View style={styles.bg}>
        <Ionicons name="map" size={64} color={colors.brandSecondary} />
        <Text style={styles.bgText}>Interactive map available on the mobile app</Text>
      </View>
      <ScrollView style={styles.pinList} contentContainerStyle={{ padding: spacing.lg, paddingTop: 140, paddingBottom: 220 }}>
        {shops.map((s) => (
          <Pressable key={s.id} style={styles.pinCard} onPress={() => onSelect(s)} testID={`map-pin-${s.id}`}>
            <Image source={{ uri: photoUrl(s) || undefined }} style={styles.pinImg} contentFit="cover" />
            <View style={{ flex: 1 }}>
              <Text style={styles.pinName} numberOfLines={1}>{s.name}</Text>
              <Text style={styles.pinMeta}>{s.category === "groomer" ? "Groomer" : "Pet Shop"} · ★ {s.rating ?? "–"}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.muted} />
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surfaceTertiary },
  bg: { position: "absolute", top: 0, left: 0, right: 0, height: 220, alignItems: "center", justifyContent: "center", backgroundColor: colors.brandTertiary },
  bgText: { color: colors.onBrandTertiary, marginTop: spacing.sm, fontSize: 13 },
  pinList: { flex: 1 },
  pinCard: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.md, gap: spacing.md, ...shadow.card },
  pinImg: { width: 56, height: 56, borderRadius: radius.sm, backgroundColor: colors.surfaceTertiary },
  pinName: { fontSize: 15, fontWeight: "700", color: colors.onSurface },
  pinMeta: { fontSize: 13, color: colors.muted, marginTop: 2 },
});
