import React from "react";
import { View, Text, StyleSheet, Pressable, Modal } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme, useThemedStyles, ThemeMode } from "@/src/theme-context";
import { useI18n } from "@/src/i18n";
import { spacing, radius, shadow, ThemeColors, lightColors, darkColors } from "@/src/theme";

// First-launch appearance chooser. Shown until the user picks a theme.
export default function ThemePrompt() {
  const { ready, chosen, setMode } = useTheme();
  const { t } = useI18n();
  const styles = useThemedStyles(makeStyles);

  const options: { mode: ThemeMode; label: string; icon: any; palette: ThemeColors }[] = [
    { mode: "light", label: t("theme.light"), icon: "sunny", palette: lightColors },
    { mode: "dark", label: t("theme.dark"), icon: "moon", palette: darkColors },
  ];

  return (
    <Modal visible={ready && !chosen} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.sheet} testID="theme-prompt">
          <Ionicons name="color-palette" size={34} color={styles._brand.color} />
          <Text style={styles.title}>{t("theme.choose")}</Text>
          <Text style={styles.sub}>{t("theme.sub")}</Text>
          <View style={styles.row}>
            {options.map((o) => (
              <Pressable
                key={o.mode}
                style={[styles.option, { backgroundColor: o.palette.surface, borderColor: o.palette.border }]}
                onPress={() => setMode(o.mode)}
                testID={`theme-choose-${o.mode}`}
              >
                <View style={[styles.preview, { backgroundColor: o.palette.surfaceSecondary, borderColor: o.palette.border }]}>
                  <View style={[styles.dot, { backgroundColor: o.palette.brand }]} />
                  <View style={[styles.line, { backgroundColor: o.palette.onSurfaceTertiary }]} />
                  <View style={[styles.lineShort, { backgroundColor: o.palette.border }]} />
                </View>
                <View style={styles.optLabel}>
                  <Ionicons name={o.icon} size={16} color={o.palette.onSurface} />
                  <Text style={[styles.optText, { color: o.palette.onSurface }]}>{o.label}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    _brand: { color: colors.brand },
    backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center", padding: spacing.xl },
    sheet: { width: "100%", maxWidth: 420, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.xl, alignItems: "center", gap: spacing.sm, ...shadow.float },
    title: { fontSize: 20, fontWeight: "800", color: colors.onSurface, marginTop: spacing.sm },
    sub: { fontSize: 14, color: colors.muted, textAlign: "center", marginBottom: spacing.md },
    row: { flexDirection: "row", gap: spacing.md, width: "100%" },
    option: { flex: 1, borderRadius: radius.md, borderWidth: 2, padding: spacing.md, gap: spacing.sm },
    preview: { height: 80, borderRadius: radius.sm, borderWidth: 1, padding: spacing.sm, gap: 6, justifyContent: "center" },
    dot: { width: 18, height: 18, borderRadius: 9 },
    line: { height: 6, borderRadius: 3, width: "80%" },
    lineShort: { height: 6, borderRadius: 3, width: "50%" },
    optLabel: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
    optText: { fontSize: 15, fontWeight: "800" },
  });
