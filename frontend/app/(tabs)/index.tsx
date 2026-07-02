import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, Modal, Platform, KeyboardAvoidingView,
} from "react-native";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { spacing, radius, shadow, fonts, ThemeColors } from "@/src/theme";
import { useTheme, useThemedStyles } from "@/src/theme-context";
import { useI18n } from "@/src/i18n";
import WhenPicker, { WhenValue, whenToDay } from "@/src/components/WhenPicker";
import MapPreview from "@/src/components/MapPreview";
import LocationAutocomplete from "@/src/components/LocationAutocomplete";
import { useShops } from "@/src/useShops";

type Option = { value: string; label: string };

function PickerField({
  icon, value, options, onSelect, testID,
}: { icon: any; value: string; options: Option[]; onSelect: (v: string) => void; testID: string }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  return (
    <>
      <Pressable style={styles.field} onPress={() => setOpen(true)} testID={testID}>
        <Ionicons name={icon} size={18} color={colors.brand} />
        <Text style={styles.fieldValue} numberOfLines={1}>{current?.label}</Text>
        <Ionicons name="chevron-down" size={18} color={colors.muted} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={styles.sheet}>
            <ScrollView>
              {options.map((o) => (
                <Pressable
                  key={o.value}
                  style={styles.optionRow}
                  onPress={() => { onSelect(o.value); setOpen(false); }}
                  testID={`option-${o.value}`}
                >
                  <Text style={[styles.optionText, o.value === value && styles.optionTextActive]}>{o.label}</Text>
                  {o.value === value && <Ionicons name="checkmark" size={20} color={colors.brand} />}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

export default function FindScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t, lang } = useI18n();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);

  const [type, setType] = useState("all");
  const [location, setLocation] = useState("");
  const [when, setWhen] = useState<WhenValue>({ type: "any" });

  const { shops, region } = useShops("all", { lang });

  const typeOptions: Option[] = [
    { value: "groomer", label: t("type.groomer") },
    { value: "shop", label: t("type.shop") },
    { value: "both", label: t("type.both") },
    { value: "all", label: t("type.all") },
  ];

  const search = () => {
    router.push({
      pathname: "/(tabs)/browse",
      params: { category: type, location: location.trim(), day: String(whenToDay(when)) },
    });
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={[styles.container, { paddingTop: insets.top }]}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" testID="find-screen">
        <View style={styles.brandRow}>
          <Image source={require("../../assets/images/groomit-logo-circle.png")} style={styles.logo} contentFit="contain" />
          <Text style={styles.brand} numberOfLines={1}>{t("appName")}</Text>
        </View>

        <Text style={styles.heading}>{t("find.heading")}</Text>
        <Text style={styles.sub}>{t("find.sub")}</Text>

        <View style={styles.card}>
          <Text style={styles.label}>{t("find.need")}</Text>
          <PickerField icon="paw" value={type} options={typeOptions} onSelect={setType} testID="picker-type" />

          <Text style={styles.label}>{t("find.in")}</Text>
          <LocationAutocomplete
            value={location}
            onChangeText={setLocation}
            onSelect={() => {}}
            onUseMyLocation={() => setLocation("")}
            testID="location-input"
          />

          <Text style={styles.label}>{t("find.when")}</Text>
          <WhenPicker value={when} onChange={setWhen} testID="picker-when" />

          <Pressable style={styles.searchBtn} onPress={search} testID="find-search-button">
            <Ionicons name="search" size={20} color={colors.onBrand} />
            <Text style={styles.searchText}>{t("find.search")}</Text>
          </Pressable>
        </View>

        <Text style={styles.quick}>{t("map.near")}</Text>
        <MapPreview
          shops={shops}
          region={region}
          onPress={() =>
            router.push({
              pathname: "/map",
              params: { lat: String(region.latitude), lng: String(region.longitude) },
            })
          }
          testID="home-map-preview"
        />

        <Text style={styles.quick}>{t("find.quick")}</Text>
        <View style={styles.quickRow}>
          <Pressable style={styles.quickCard} onPress={() => router.push({ pathname: "/(tabs)/browse", params: { category: "groomer" } })} testID="quick-groomer">
            <Ionicons name="cut" size={26} color={colors.brand} />
            <Text style={styles.quickText}>{t("cat.groomer")}</Text>
          </Pressable>
          <Pressable style={styles.quickCard} onPress={() => router.push({ pathname: "/(tabs)/browse", params: { category: "shop" } })} testID="quick-shop">
            <Ionicons name="storefront" size={26} color={colors.accent} />
            <Text style={styles.quickText}>{t("cat.shop")}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.sm },
  brandRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm },
  logo: { width: 40, height: 40 },
  brand: { fontSize: 26, color: colors.onSurface, fontFamily: fonts.display, fontWeight: "700" },
  heading: { fontSize: 28, fontWeight: "800", color: colors.onSurface, fontFamily: fonts.display, marginTop: spacing.md },
  sub: { fontSize: 15, color: colors.muted, marginBottom: spacing.md, lineHeight: 21 },
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm, ...shadow.card },
  label: { fontSize: 13, fontWeight: "800", color: colors.onSurfaceTertiary, marginTop: spacing.xs },
  field: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: spacing.md, height: 52 },
  fieldValue: { flex: 1, fontSize: 16, fontWeight: "700", color: colors.onSurface },
  input: { flex: 1, fontSize: 16, color: colors.onSurface },
  searchBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.brand, height: 56, borderRadius: radius.pill, marginTop: spacing.md },
  searchText: { color: colors.onBrand, fontSize: 17, fontWeight: "800" },
  quick: { fontSize: 15, fontWeight: "800", color: colors.onSurface, marginTop: spacing.xl },
  quickRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.sm },
  quickCard: { flex: 1, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.lg, alignItems: "center", gap: spacing.sm, ...shadow.card },
  quickText: { fontSize: 14, fontWeight: "800", color: colors.onSurface },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.surfaceSecondary, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, maxHeight: "60%", paddingVertical: spacing.sm },
  optionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.xl, paddingVertical: spacing.lg },
  optionText: { fontSize: 16, color: colors.onSurface },
  optionTextActive: { fontWeight: "800", color: colors.brand },
});
