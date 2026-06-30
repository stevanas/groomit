import React from "react";
import { View, Text, StyleSheet, Pressable, KeyboardAvoidingView, Platform } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/src/auth";
import { colors, spacing, radius } from "@/src/theme";

export default function Login() {
  const { login } = useAuth();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container} testID="login-screen">
      <Image
        source={{ uri: "https://images.unsplash.com/photo-1719464454959-9cf304ef4774?crop=entropy&cs=srgb&fm=jpg&q=85&w=1000" }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
      />
      <LinearGradient
        colors={["rgba(43,48,40,0.1)", "rgba(43,48,40,0.55)", "rgba(43,48,40,0.95)"]}
        style={StyleSheet.absoluteFill}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={[styles.content, { paddingBottom: insets.bottom + spacing.xl, paddingTop: insets.top }]}
      >
        <View style={styles.brandRow}>
          <View style={styles.logo}>
            <Ionicons name="paw" size={28} color={colors.onBrand} />
          </View>
          <Text style={styles.brandName}>PawFind</Text>
        </View>

        <View style={styles.bottom}>
          <Text style={styles.title}>Find the best pet shops & groomers near you</Text>
          <Text style={styles.subtitle}>Discover, review and save your favourite pet care spots.</Text>

          <Pressable style={styles.googleBtn} onPress={login} testID="google-login-button">
            <Ionicons name="logo-google" size={20} color={colors.onSurface} />
            <Text style={styles.googleText}>Continue with Google</Text>
          </Pressable>
          <Text style={styles.terms}>By continuing you agree to our Terms & Privacy Policy.</Text>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surfaceInverse },
  content: { flex: 1, justifyContent: "space-between", padding: spacing.xl },
  brandRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  logo: { width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  brandName: { fontSize: 24, fontWeight: "900", color: "#fff" },
  bottom: { gap: spacing.sm },
  title: { fontSize: 32, fontWeight: "900", color: "#fff", lineHeight: 38 },
  subtitle: { fontSize: 15, color: "rgba(255,255,255,0.85)", marginBottom: spacing.lg },
  googleBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: "#fff", height: 56, borderRadius: radius.pill },
  googleText: { fontSize: 16, fontWeight: "800", color: colors.onSurface },
  terms: { fontSize: 12, color: "rgba(255,255,255,0.7)", textAlign: "center", marginTop: spacing.md },
});
