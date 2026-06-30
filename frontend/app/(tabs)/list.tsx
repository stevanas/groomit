import React, { useState } from "react";
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Pressable, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ShopCard from "@/src/components/ShopCard";
import CategoryChips from "@/src/components/CategoryChips";
import { useShops } from "@/src/useShops";
import { colors, spacing } from "@/src/theme";

export default function ListScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [category, setCategory] = useState("all");
  const { shops, loading, error, reload } = useShops(category);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]} testID="list-screen">
      <View style={styles.header}>
        <Text style={styles.title}>Nearby</Text>
        <Text style={styles.subtitle}>{shops.length} places around you</Text>
      </View>
      <CategoryChips value={category} onChange={setCategory} />

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.brand} /></View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="cloud-offline" size={48} color={colors.muted} />
          <Text style={styles.emptyText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={reload} testID="list-retry">
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : shops.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="sad-outline" size={48} color={colors.muted} />
          <Text style={styles.emptyText}>No shops found with these filters.</Text>
        </View>
      ) : (
        <FlatList
          data={shops}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ShopCard shop={item} onPress={() => router.push(`/shop/${item.id}`)} />}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxxl }}
          refreshControl={<RefreshControl refreshing={false} onRefresh={reload} tintColor={colors.brand} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  title: { fontSize: 28, fontWeight: "900", color: colors.onSurface },
  subtitle: { fontSize: 14, color: colors.muted, marginTop: 2 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.xl },
  emptyText: { color: colors.muted, fontSize: 15, textAlign: "center", fontWeight: "600" },
  retryBtn: { backgroundColor: colors.brand, paddingHorizontal: spacing.xl, paddingVertical: spacing.sm, borderRadius: 999 },
  retryText: { color: colors.onBrand, fontWeight: "800" },
});
