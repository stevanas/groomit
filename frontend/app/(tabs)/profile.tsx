import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, radius, shadow } from "@/src/theme";

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.md }]} testID="profile-screen">
      <Text style={styles.title}>Profile</Text>

      <View style={styles.card}>
        <View style={styles.logo}>
          <Ionicons name="paw" size={32} color={colors.onBrand} />
        </View>
        <Text style={styles.name}>Welcome to PawFind</Text>
        <Text style={styles.email}>Browsing as guest</Text>
      </View>

      <View style={styles.menu}>
        <View style={styles.menuItem}>
          <Ionicons name="heart" size={20} color={colors.brand} />
          <Text style={styles.menuText}>Your saved spots are kept on this device</Text>
        </View>
        <View style={styles.sep} />
        <View style={styles.menuItem}>
          <Ionicons name="lock-closed-outline" size={20} color={colors.muted} />
          <Text style={styles.menuText}>Sign in (coming soon) to sync across devices</Text>
        </View>
      </View>

      <Text style={styles.footer}>PawFind · find the best pet care nearby</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface, padding: spacing.lg },
  title: { fontSize: 28, fontWeight: "900", color: colors.onSurface, marginBottom: spacing.lg },
  card: { alignItems: "center", backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.xl, gap: spacing.xs, ...shadow.card },
  logo: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center", marginBottom: spacing.sm },
  name: { fontSize: 20, fontWeight: "900", color: colors.onSurface },
  email: { fontSize: 14, color: colors.muted },
  menu: { marginTop: spacing.lg, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, ...shadow.card },
  menuItem: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg },
  menuText: { fontSize: 14, color: colors.onSurfaceTertiary, fontWeight: "600", flex: 1 },
  sep: { height: 1, backgroundColor: colors.border, marginHorizontal: spacing.lg },
  footer: { marginTop: "auto", marginBottom: spacing.xl, textAlign: "center", color: colors.muted, fontSize: 13 },
});
