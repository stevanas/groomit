import React, { useState, useRef, useEffect } from "react";
import { View, Text, StyleSheet, TextInput, Pressable, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { apiGet } from "@/src/api";
import { useI18n } from "@/src/i18n";
import { spacing, radius, shadow, ThemeColors } from "@/src/theme";
import { useTheme, useThemedStyles } from "@/src/theme-context";

type Suggestion = { place_id: string; description: string; main: string; secondary: string };

export default function LocationAutocomplete({
  value,
  onChangeText,
  onSelect,
  onUseMyLocation,
  testID,
}: {
  value: string;
  onChangeText: (v: string) => void;
  onSelect: (description: string) => void;
  onUseMyLocation: () => void;
  testID?: string;
}) {
  const { t, lang } = useI18n();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const justSelected = useRef(false);

  useEffect(() => {
    if (justSelected.current) {
      justSelected.current = false;
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = value.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await apiGet(`/places/autocomplete?input=${encodeURIComponent(q)}&lang=${lang}`);
        setSuggestions(data.suggestions || []);
        setOpen(true);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value, lang]);

  const pick = (s: Suggestion) => {
    justSelected.current = true;
    onChangeText(s.description);
    setOpen(false);
    setSuggestions([]);
    onSelect(s.description);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.field}>
        <Ionicons name="location" size={18} color={colors.brand} />
        <TextInput
          style={styles.input}
          placeholder={t("find.locationPlaceholder")}
          placeholderTextColor={colors.muted}
          value={value}
          onChangeText={onChangeText}
          testID={testID}
        />
        {loading ? (
          <ActivityIndicator size="small" color={colors.muted} />
        ) : value.length > 0 ? (
          <Pressable onPress={() => { onChangeText(""); setOpen(false); }} testID="location-clear">
            <Ionicons name="close-circle" size={18} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>

      {open && (
        <View style={styles.dropdown}>
          <Pressable style={styles.row} onPress={() => { onChangeText(""); setOpen(false); onUseMyLocation(); }} testID="use-my-location">
            <Ionicons name="navigate" size={18} color={colors.brand} />
            <Text style={styles.rowMain}>{t("find.useMyLocation")}</Text>
          </Pressable>
          {suggestions.map((s) => (
            <Pressable key={s.place_id} style={styles.row} onPress={() => pick(s)} testID={`suggestion-${s.place_id}`}>
              <Ionicons name="location-outline" size={18} color={colors.muted} />
              <View style={{ flex: 1 }}>
                <Text style={styles.rowMain} numberOfLines={1}>{s.main || s.description}</Text>
                {s.secondary ? <Text style={styles.rowSub} numberOfLines={1}>{s.secondary}</Text> : null}
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  wrap: { position: "relative", zIndex: 20 },
  field: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: spacing.md, height: 52 },
  input: { flex: 1, fontSize: 16, color: colors.onSurface },
  dropdown: { position: "absolute", top: 56, left: 0, right: 0, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, paddingVertical: spacing.xs, ...shadow.float, zIndex: 30 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  rowMain: { fontSize: 15, fontWeight: "700", color: colors.onSurface },
  rowSub: { fontSize: 13, color: colors.muted, marginTop: 1 },
});
