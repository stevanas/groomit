import React from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { spacing, radius, ThemeColors } from "@/src/theme";
import { useThemedStyles } from "@/src/theme-context";
import { useI18n } from "@/src/i18n";

const KEYS = [
  { key: "all", label: "cat.all" },
  { key: "groomer", label: "cat.groomer" },
  { key: "shop", label: "cat.shop" },
  { key: "both", label: "cat.both" },
] as const;

export default function CategoryChips({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const { t } = useI18n();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.rowWrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.content}>
        {KEYS.map((c) => {
          const active = value === c.key;
          return (
            <Pressable
              key={c.key}
              onPress={() => onChange(c.key)}
              style={[styles.chip, active && styles.chipActive]}
              testID={`chip-${c.key}`}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{t(c.label)}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  rowWrap: { height: 48, justifyContent: "center" },
  content: { gap: spacing.sm, paddingHorizontal: spacing.lg, alignItems: "center" },
  chip: {
    height: 36,
    flexShrink: 0,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  chipActive: { backgroundColor: colors.surfaceInverse, borderColor: colors.surfaceInverse },
  chipText: { fontSize: 13, fontWeight: "700", color: colors.onSurfaceTertiary },
  chipTextActive: { color: colors.onSurfaceInverse },
});
