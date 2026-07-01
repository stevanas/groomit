import React from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useI18n, Lang } from "@/src/i18n";
import RemoveAdsCard from "@/src/components/RemoveAdsCard";
import { spacing, radius, shadow, fonts, ThemeColors } from "@/src/theme";
import { useTheme, useThemedStyles, ThemeMode } from "@/src/theme-context";

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { t, lang, setLang } = useI18n();
  const { colors, mode, setMode } = useTheme();
  const styles = useThemedStyles(makeStyles);

  const langs: { code: Lang; label: string }[] = [
    { code: "el", label: "Ελληνικά" },
    { code: "en", label: "English" },
  ];

  const themes: { code: ThemeMode; label: string; icon: any }[] = [
    { code: "light", label: t("theme.light"), icon: "sunny" },
    { code: "dark", label: t("theme.dark"), icon: "moon" },
  ];

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top + spacing.md }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      testID="profile-screen"
    >
      <Text style={styles.title}>{t("profile.title")}</Text>

      <View style={styles.card}>
        <Image source={require("../../assets/images/groomit-logo-circle.png")} style={styles.logo} contentFit="contain" />
        <Text style={styles.welcomeSmall}>{t("profile.welcome")}</Text>
        <Text style={styles.name} numberOfLines={1} adjustsFontSizeToFit>{t("appName")}</Text>
        <Text style={styles.email}>{t("profile.guest")}</Text>
      </View>

      <Text style={styles.sectionLabel}>{t("profile.language")}</Text>
      <View style={styles.langRow}>
        {langs.map((l) => {
          const active = lang === l.code;
          return (
            <Pressable
              key={l.code}
              style={[styles.langBtn, active && styles.langBtnActive]}
              onPress={() => setLang(l.code)}
              testID={`lang-${l.code}`}
            >
              <Text style={[styles.langText, active && styles.langTextActive]}>{l.label}</Text>
              {active && <Ionicons name="checkmark-circle" size={18} color={colors.onBrand} />}
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.sectionLabel}>{t("theme.title")}</Text>
      <View style={styles.langRow}>
        {themes.map((th) => {
          const active = mode === th.code;
          return (
            <Pressable
              key={th.code}
              style={[styles.langBtn, active && styles.langBtnActive]}
              onPress={() => setMode(th.code)}
              testID={`theme-${th.code}`}
            >
              <Ionicons name={th.icon} size={17} color={active ? colors.onBrand : colors.onSurfaceTertiary} />
              <Text style={[styles.langText, active && styles.langTextActive]}>{th.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.sectionLabel}>{t("support.title")}</Text>
      <RemoveAdsCard />

      <View style={styles.menu}>
        <View style={styles.menuItem}>
          <Ionicons name="heart" size={20} color={colors.brand} />
          <Text style={styles.menuText}>{t("profile.savedNote")}</Text>
        </View>
      </View>

      <Text style={styles.footer}>{t("profile.footer")}</Text>
    </ScrollView>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl, flexGrow: 1 },
  title: { fontSize: 28, fontWeight: "800", color: colors.onSurface, fontFamily: fonts.display, marginBottom: spacing.lg },
  card: { alignItems: "center", backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.xl, gap: spacing.xs, ...shadow.card },
  logo: { width: 72, height: 72, marginBottom: spacing.sm },
  welcomeSmall: { fontSize: 14, color: colors.muted },
  name: { fontSize: 24, fontWeight: "800", color: colors.onSurface, fontFamily: fonts.display, textAlign: "center" },
  email: { fontSize: 14, color: colors.muted },
  sectionLabel: { fontSize: 13, fontWeight: "800", color: colors.onSurfaceTertiary, marginTop: spacing.xl, marginBottom: spacing.sm, textTransform: "uppercase", letterSpacing: 0.5 },
  langRow: { flexDirection: "row", gap: spacing.md },
  langBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, height: 52, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, borderWidth: 1.5, borderColor: colors.border },
  langBtnActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  langText: { fontSize: 15, fontWeight: "800", color: colors.onSurfaceTertiary },
  langTextActive: { color: colors.onBrand },
  menu: { marginTop: spacing.xl, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, ...shadow.card },
  menuItem: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg },
  menuText: { fontSize: 14, color: colors.onSurfaceTertiary, fontWeight: "600", flex: 1 },
  footer: { marginTop: "auto", paddingTop: spacing.xl, marginBottom: spacing.xl, textAlign: "center", color: colors.muted, fontSize: 13 },
});
