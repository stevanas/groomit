import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, Modal, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, radius } from "@/src/theme";
import { useI18n } from "@/src/i18n";

export type WhenValue = { type: "any" | "today" | "tomorrow" | "date"; date?: string };

const mondayIdx = (d: Date) => (d.getDay() + 6) % 7;

export function whenToDay(v: WhenValue): number {
  if (v.type === "today") return mondayIdx(new Date());
  if (v.type === "tomorrow") {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return mondayIdx(d);
  }
  if (v.type === "date" && v.date) return mondayIdx(new Date(v.date));
  return -1;
}

const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export default function WhenPicker({
  value,
  onChange,
  testID,
}: {
  value: WhenValue;
  onChange: (v: WhenValue) => void;
  testID?: string;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [cal, setCal] = useState(false);
  const [viewMonth, setViewMonth] = useState(startOfMonth(new Date()));

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const label = () => {
    if (value.type === "date" && value.date) {
      const d = new Date(value.date);
      return `${t("wshort." + mondayIdx(d))} ${d.getDate()}/${d.getMonth() + 1}`;
    }
    return t(value.type === "any" ? "day.any" : value.type === "today" ? "day.today" : "day.tomorrow");
  };

  const pick = (v: WhenValue) => {
    onChange(v);
    setOpen(false);
    setCal(false);
  };

  // Build calendar grid (Monday-first)
  const firstDow = mondayIdx(viewMonth);
  const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), d));

  const canGoPrev = startOfMonth(viewMonth) > startOfMonth(today);
  const shiftMonth = (n: number) => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + n, 1));

  const quick = [
    { type: "today" as const, icon: "today" },
    { type: "tomorrow" as const, icon: "arrow-forward-circle" },
    { type: "any" as const, icon: "infinite" },
  ];

  return (
    <>
      <Pressable style={styles.field} onPress={() => setOpen(true)} testID={testID}>
        <Ionicons name="calendar" size={18} color={colors.brand} />
        <Text style={styles.fieldValue} numberOfLines={1}>{label()}</Text>
        <Ionicons name="chevron-down" size={18} color={colors.muted} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => { setOpen(false); setCal(false); }}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            {!cal ? (
              <ScrollView>
                {quick.map((q) => (
                  <Pressable key={q.type} style={styles.optionRow} onPress={() => pick({ type: q.type })} testID={`when-${q.type}`}>
                    <Ionicons name={q.icon as any} size={20} color={colors.brand} />
                    <Text style={[styles.optionText, value.type === q.type && styles.optionTextActive]}>
                      {t(q.type === "any" ? "day.any" : q.type === "today" ? "day.today" : "day.tomorrow")}
                    </Text>
                    {value.type === q.type && <Ionicons name="checkmark" size={20} color={colors.brand} />}
                  </Pressable>
                ))}
                <Pressable style={styles.optionRow} onPress={() => setCal(true)} testID="when-calendar">
                  <Ionicons name="calendar-outline" size={20} color={colors.brand} />
                  <Text style={[styles.optionText, value.type === "date" && styles.optionTextActive]}>{t("find.pickDate")}</Text>
                  <Ionicons name="chevron-forward" size={20} color={colors.muted} />
                </Pressable>
              </ScrollView>
            ) : (
              <View style={styles.cal}>
                <View style={styles.calHeader}>
                  <Pressable onPress={() => canGoPrev && shiftMonth(-1)} style={styles.navBtn} testID="cal-prev">
                    <Ionicons name="chevron-back" size={22} color={canGoPrev ? colors.onSurface : colors.border} />
                  </Pressable>
                  <Text style={styles.calTitle}>{t("month." + viewMonth.getMonth())} {viewMonth.getFullYear()}</Text>
                  <Pressable onPress={() => shiftMonth(1)} style={styles.navBtn} testID="cal-next">
                    <Ionicons name="chevron-forward" size={22} color={colors.onSurface} />
                  </Pressable>
                </View>
                <View style={styles.weekRow}>
                  {[0, 1, 2, 3, 4, 5, 6].map((w) => (
                    <Text key={w} style={styles.weekday}>{t("wshort." + w)}</Text>
                  ))}
                </View>
                <View style={styles.grid}>
                  {cells.map((d, i) => {
                    if (!d) return <View key={i} style={styles.dayCell} />;
                    const past = d < today;
                    const selected = value.type === "date" && value.date && sameDay(new Date(value.date), d);
                    return (
                      <Pressable
                        key={i}
                        style={styles.dayCell}
                        disabled={past}
                        onPress={() => pick({ type: "date", date: d.toISOString() })}
                        testID={`cal-day-${d.getDate()}`}
                      >
                        <View style={[styles.dayInner, selected && styles.daySelected]}>
                          <Text style={[styles.dayText, past && styles.dayPast, selected && styles.daySelectedText]}>{d.getDate()}</Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
                <Pressable style={styles.backToOptions} onPress={() => setCal(false)}>
                  <Ionicons name="chevron-back" size={16} color={colors.brand} />
                  <Text style={styles.backToText}>{t("day.today")} / {t("day.tomorrow")}</Text>
                </Pressable>
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  field: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: spacing.md, height: 52 },
  fieldValue: { flex: 1, fontSize: 16, fontWeight: "700", color: colors.onSurface },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.surfaceSecondary, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, maxHeight: "70%", paddingVertical: spacing.sm },
  optionRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.xl, paddingVertical: spacing.lg },
  optionText: { flex: 1, fontSize: 16, color: colors.onSurface },
  optionTextActive: { fontWeight: "800", color: colors.brand },
  cal: { padding: spacing.lg },
  calHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md },
  navBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  calTitle: { fontSize: 17, fontWeight: "800", color: colors.onSurface },
  weekRow: { flexDirection: "row" },
  weekday: { flex: 1, textAlign: "center", fontSize: 12, fontWeight: "700", color: colors.muted, marginBottom: spacing.xs },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  dayCell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: "center", justifyContent: "center", padding: 3 },
  dayInner: { width: "100%", height: "100%", maxWidth: 42, maxHeight: 42, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  daySelected: { backgroundColor: colors.brand },
  dayText: { fontSize: 15, fontWeight: "700", color: colors.onSurface },
  dayPast: { color: colors.border },
  daySelectedText: { color: colors.onBrand },
  backToOptions: { flexDirection: "row", alignItems: "center", gap: 4, justifyContent: "center", paddingVertical: spacing.md, marginTop: spacing.sm },
  backToText: { color: colors.brand, fontWeight: "700", fontSize: 14 },
});
