import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/src/auth";
import { colors, spacing, radius, shadow } from "@/src/theme";

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.md }]} testID="profile-screen">
      <Text style={styles.title}>Profile</Text>

      <View style={styles.card}>
        {user?.picture ? (
          <Image source={{ uri: user.picture }} style={styles.avatar} contentFit="cover" />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarInitial}>{(user?.name || user?.email || "?")[0]?.toUpperCase()}</Text>
          </View>
        )}
        <Text style={styles.name}>{user?.name || "Pet Lover"}</Text>
        <Text style={styles.email}>{user?.email}</Text>
      </View>

      <View style={styles.menu}>
        <View style={styles.menuItem}>
          <Ionicons name="paw" size={20} color={colors.brand} />
          <Text style={styles.menuText}>Helping you find the best pet care nearby</Text>
        </View>
      </View>

      <Pressable style={styles.logoutBtn} onPress={logout} testID="logout-button">
        <Ionicons name="log-out-outline" size={20} color={colors.error} />
        <Text style={styles.logoutText}>Log out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface, padding: spacing.lg },
  title: { fontSize: 28, fontWeight: "900", color: colors.onSurface, marginBottom: spacing.lg },
  card: { alignItems: "center", backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.xl, gap: spacing.xs, ...shadow.card },
  avatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.brandSecondary, marginBottom: spacing.sm },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  avatarInitial: { fontSize: 36, fontWeight: "900", color: colors.onBrandSecondary },
  name: { fontSize: 20, fontWeight: "900", color: colors.onSurface },
  email: { fontSize: 14, color: colors.muted },
  menu: { marginTop: spacing.lg, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, ...shadow.card },
  menuItem: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg },
  menuText: { fontSize: 14, color: colors.onSurfaceTertiary, fontWeight: "600", flex: 1 },
  logoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, marginTop: "auto", marginBottom: spacing.xl, paddingVertical: spacing.lg, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.error },
  logoutText: { fontSize: 16, fontWeight: "800", color: colors.error },
});
