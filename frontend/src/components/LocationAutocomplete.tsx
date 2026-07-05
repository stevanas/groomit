import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, TextInput, Pressable, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { apiGet } from "@/src/api";
import { useI18n } from "@/src/i18n";
import { spacing, radius, shadow, ThemeColors } from "@/src/theme";
import { useTheme, useThemedStyles } from "@/src/theme-context";

type Suggestion = {
  place_id?: string;
  description?: string;
  main?: string;
  secondary?: string;
  kind?: "location" | "current";
};

const AUTOCOMPLETE_DEBOUNCE_MS = 280;
const AUTOCOMPLETE_CACHE_TTL_MS = 10 * 60 * 1000;
const AUTOCOMPLETE_MIN_CHARS = 2;
const LOCAL_CACHE = new Map<string, { ts: number; suggestions: Suggestion[] }>();

export default function LocationAutocomplete({
  value,
  onChangeText,
  onSelect,
  onUseMyLocation,
  showUseMyLocation = true,
  testID,
}: {
  value: string;
  onChangeText: (v: string) => void;
  onSelect: (description: string) => void;
  onUseMyLocation: () => void;
  showUseMyLocation?: boolean;
  testID?: string;
}) {
  const { t, lang } = useI18n();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const requestSeq = useRef(0);

  const normalized = useMemo(() => value.trim().toLowerCase(), [value]);

  useEffect(() => {
    if (normalized.length < AUTOCOMPLETE_MIN_CHARS) {
      setSuggestions([]);
      setLoading(false);
      setOpen(false);
      return;
    }

    const seq = ++requestSeq.current;
    const key = `${lang}:${normalized.slice(0, 80)}`;
    const cached = LOCAL_CACHE.get(key);
    if (cached && Date.now() - cached.ts < AUTOCOMPLETE_CACHE_TTL_MS) {
      setSuggestions(cached.suggestions);
      setOpen(cached.suggestions.length > 0);
      setLoading(false);
      return;
    }

    const handle = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await apiGet(`/places/autocomplete?input=${encodeURIComponent(value.trim())}&lang=${lang}`);
        if (requestSeq.current !== seq) return;
        const next = (data?.suggestions || []).slice(0, 6);
        LOCAL_CACHE.set(key, { ts: Date.now(), suggestions: next });
        setSuggestions(next);
        setOpen(next.length > 0);
      } catch {
        if (requestSeq.current !== seq) return;
        setSuggestions([]);
        setOpen(false);
      } finally {
        if (requestSeq.current === seq) setLoading(false);
      }
    }, AUTOCOMPLETE_DEBOUNCE_MS);

    return () => clearTimeout(handle);
  }, [normalized, value, lang]);

  const displayedSuggestions = useMemo(() => {
    if (normalized.length >= AUTOCOMPLETE_MIN_CHARS) return suggestions;
    return [{
      place_id: "__current_location__",
      description: t("find.useMyLocation"),
      main: t("find.useMyLocation"),
      secondary: "",
      kind: "current",
    }];
  }, [normalized, suggestions, t]);

  const pickSuggestion = (s: Suggestion) => {
    if (s.kind === "current") {
      onUseMyLocation();
      setOpen(false);
      return;
    }
    const label = (s.description || s.main || "").trim();
    onSelect(label);
    onChangeText(label);
    setOpen(false);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.field}>
        <Ionicons name="location" size={20} color={colors.brand} />
        <TextInput
          style={styles.input}
          placeholder={t("find.locationPlaceholder")}
          placeholderTextColor={colors.muted}
          value={value}
          onChangeText={(txt) => {
            onChangeText(txt);
            setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
          }}
          testID={testID}
        />
        {loading ? <ActivityIndicator size="small" color={colors.brand} /> : null}
        {value.length > 0 ? (
          <Pressable
            onPress={() => {
              onChangeText("");
              setSuggestions([]);
              setOpen(false);
            }}
            testID="location-clear"
          >
            <Ionicons name="close-circle" size={20} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>

      {open && displayedSuggestions.length > 0 && (
        <View style={styles.menu} testID="location-suggestions">
          {displayedSuggestions.map((s, idx) => {
            const main = (s.main || s.description || "").trim();
            const secondary = (s.secondary || "").trim();
            const key = s.place_id || `${main}-${secondary}-${idx}`;
            return (
              <Pressable key={key} style={styles.suggestionRow} onPress={() => pickSuggestion(s)} testID={`location-suggestion-${idx}`}>
                <Ionicons name={s.kind === "current" ? "navigate" : "location-outline"} size={16} color={colors.brand} />
                <View style={styles.suggestionTextWrap}>
                  <Text style={styles.suggestionMain} numberOfLines={1}>{main}</Text>
                  {secondary ? <Text style={styles.suggestionSecondary} numberOfLines={1}>{secondary}</Text> : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      )}

      {showUseMyLocation && (
        <Pressable style={styles.locationHint} onPress={onUseMyLocation} testID="use-my-location">
          <Ionicons name="navigate" size={16} color={colors.brand} />
          <Text style={styles.rowMain}>{t("find.useMyLocation")}</Text>
        </Pressable>
      )}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  wrap: { position: "relative", zIndex: 20 },
  field: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: spacing.lg, height: 60 },
  input: { flex: 1, fontSize: 18, color: colors.onSurface },
  menu: { marginTop: 6, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, overflow: "hidden", ...shadow.card },
  suggestionRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  suggestionTextWrap: { flex: 1, minWidth: 0 },
  suggestionMain: { fontSize: 14, fontWeight: "700", color: colors.onSurface },
  suggestionSecondary: { fontSize: 12, color: colors.muted, marginTop: 1 },
  locationHint: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.sm, paddingTop: spacing.xs },
  rowMain: { fontSize: 15, fontWeight: "700", color: colors.onSurface },
});
