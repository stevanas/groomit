import React from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { colors, spacing, radius } from "@/src/theme";

const CATS = [
  { key: "all", label: "All" },
  { key: "groomer", label: "Groomers" },
  { key: "shop", label: "Pet Shops" },
] as const;

export default function CategoryChips({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={styles.rowWrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {CATS.map((c) => {
          const active = value === c.key;
          return (
            <Pressable
              key={c.key}
              onPress={() => onChange(c.key)}
              style={[styles.chip, active && styles.chipActive]}
              testID={`chip-${c.key}`}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{c.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  rowWrap: { height: 56, justifyContent: "center" },
  content: { gap: spacing.sm, paddingHorizontal: spacing.lg, alignItems: "center" },
  chip: {
    height: 36,
    flexShrink: 0,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  chipActive: { backgroundColor: colors.surfaceInverse, borderColor: colors.surfaceInverse },
  chipText: { fontSize: 14, fontWeight: "700", color: colors.onSurfaceTertiary },
  chipTextActive: { color: colors.onSurfaceInverse },
});
