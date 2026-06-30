import React, { useState } from "react";
import { Text, StyleSheet, Pressable, Modal, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { spacing, radius, ThemeColors } from "@/src/theme";
import { useTheme, useThemedStyles } from "@/src/theme-context";
import { useI18n } from "@/src/i18n";

export default function TimePicker({
  value,
  onChange,
  options,
  has24h,
  fill,
  testID,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  options: string[];
  has24h?: boolean;
  fill?: boolean;
  testID?: string;
}) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [open, setOpen] = useState(false);
  const active = !!value;

  const label = value === "24h" ? t("filter.open24") : value ? `${t("filter.until")} ${value}` : `${t("filter.until")}…`;

  return (
    <>
      <Pressable style={[styles.chip, fill && styles.chipFill, active && styles.chipActive]} onPress={() => setOpen(true)} testID={testID}>
        <Ionicons name="hourglass-outline" size={15} color={active ? colors.onAccent : colors.accent} />
        <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>{label}</Text>
        <Ionicons name="chevron-down" size={13} color={active ? colors.onAccent : colors.accent} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.title}>{t("filter.until")}</Text>
            <ScrollView>
              <Pressable style={styles.row} onPress={() => { onChange(null); setOpen(false); }} testID="time-any">
                <Text style={[styles.rowText, !value && styles.rowActive]}>{t("filter.any")}</Text>
                {!value && <Ionicons name="checkmark" size={20} color={colors.brand} />}
              </Pressable>
              {options.map((tm) => (
                <Pressable key={tm} style={styles.row} onPress={() => { onChange(tm); setOpen(false); }} testID={`time-${tm}`}>
                  <Text style={[styles.rowText, value === tm && styles.rowActive]}>{tm}</Text>
                  {value === tm && <Ionicons name="checkmark" size={20} color={colors.brand} />}
                </Pressable>
              ))}
              <Pressable
                style={styles.row}
                disabled={!has24h}
                onPress={() => { onChange("24h"); setOpen(false); }}
                testID="time-24h"
              >
                <Text style={[styles.rowText, !has24h && styles.rowDisabled, value === "24h" && styles.rowActive]}>
                  {t("filter.open24")}
                </Text>
                {value === "24h" && <Ionicons name="checkmark" size={20} color={colors.brand} />}
              </Pressable>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  chip: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingHorizontal: spacing.md, height: 40, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  chipFill: { flex: 1 },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { fontSize: 13, fontWeight: "800", color: colors.accent, flexShrink: 1 },
  chipTextActive: { color: colors.onAccent },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.surfaceSecondary, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, maxHeight: "65%", paddingVertical: spacing.md, paddingTop: spacing.lg },
  title: { fontSize: 13, fontWeight: "800", color: colors.muted, textTransform: "uppercase", letterSpacing: 0.5, paddingHorizontal: spacing.xl, marginBottom: spacing.xs },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  rowText: { fontSize: 16, color: colors.onSurface },
  rowActive: { fontWeight: "800", color: colors.brand },
  rowDisabled: { color: colors.border },
});
