import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Linking, Modal, FlatList, Dimensions,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiGet, photoUrl } from "@/src/api";
import { isFavorite, toggleFavorite } from "@/src/favorites";
import { useI18n } from "@/src/i18n";
import StoreMapSection from "@/src/components/StoreMapSection";
import { spacing, radius, shadow, fonts, getCat, ThemeColors } from "@/src/theme";
import { useTheme, useThemedStyles } from "@/src/theme-context";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

function Stars({ value, size = 14 }: { value: number; size?: number }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: 1 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons key={i} name={i <= Math.round(value) ? "star" : "star-outline"} size={size} color={colors.warning} />
      ))}
    </View>
  );
}

export default function ShopDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, lang } = useI18n();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);

  const [shop, setShop] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [fav, setFav] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await apiGet(`/places/${id}?lang=${lang}`);
      setShop(data);
      setFav(await isFavorite(String(id)));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [id, lang]);

  useEffect(() => { load(); }, [load]);

  const toggleFav = async () => {
    if (!shop) return;
    setFav(await toggleFavorite(shop));
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.brand} /></View>;
  }
  if (error || !shop) {
    return (
      <View style={styles.center}>
        <Text style={styles.errTitle}>{t("shop.loadError")}</Text>
        <Pressable style={styles.retryBtn} onPress={load}><Text style={styles.retryText}>{t("common.retry")}</Text></Pressable>
      </View>
    );
  }

  const heroUri = photoUrl(shop) || (shop.photos?.[0] ? photoUrl({ photo_name: shop.photos[0] }) : null);
  const galleryPhotos: string[] = (
    shop.photos && shop.photos.length
      ? shop.photos.map((n: string) => photoUrl({ photo_name: n })).filter(Boolean)
      : [heroUri].filter(Boolean)
  ) as string[];
  const googleReviews = shop.google_reviews || [];
  const cat = getCat(shop.category);
  const catIconName = shop.category === "groomer" ? "cut" : shop.category === "both" ? "ribbon" : "storefront";
  const catLabelKey = shop.category === "groomer" ? "type.groomer" : shop.category === "both" ? "type.bothFull" : "type.shop";
  const todayIdx = (new Date().getDay() + 6) % 7;

  const scheduleRows: { label: string; value: string; today: boolean }[] = [];
  if (shop.schedule) {
    shop.schedule.forEach((d: any, i: number) => {
      scheduleRows.push({
        label: t(`day.${i}`),
        value: d.closed ? t("shop.closedLabel") : `${d.open} – ${d.close}`,
        today: i === todayIdx,
      });
    });
  } else if (shop.schedule_text && shop.schedule_text.length) {
    shop.schedule_text.forEach((line: string) => {
      const [label, ...rest] = line.split(": ");
      scheduleRows.push({ label, value: rest.join(": "), today: false });
    });
  }

  return (
    <View style={styles.container} testID="shop-detail">
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <FlatList
            data={galleryPhotos}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(_, i) => String(i)}
            onMomentumScrollEnd={(e) =>
              setGalleryIndex(Math.round(e.nativeEvent.contentOffset.x / SCREEN_W))
            }
            renderItem={({ item, index }) => (
              <Pressable
                onPress={() => { setViewerIndex(index); setViewerOpen(true); }}
                testID={`gallery-photo-${index}`}
              >
                <Image source={{ uri: item }} style={styles.heroImg} contentFit="cover" />
              </Pressable>
            )}
          />
          <LinearGradient
            colors={["rgba(42,33,28,0.45)", "transparent", "rgba(42,33,28,0.55)"]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          {galleryPhotos.length > 1 && (
            <>
              <View style={styles.dots} pointerEvents="none">
                {galleryPhotos.map((_, i) => (
                  <View key={i} style={[styles.dot, i === galleryIndex && styles.dotActive]} />
                ))}
              </View>
              <View style={styles.countBadge} pointerEvents="none">
                <Ionicons name="images" size={13} color="#fff" />
                <Text style={styles.countText}>{galleryIndex + 1}/{galleryPhotos.length}</Text>
              </View>
            </>
          )}
        </View>

        <View style={styles.sheet}>
          <View style={styles.titleRow}>
            <Text style={styles.name}>{shop.name}</Text>
            <Text style={styles.addr}>{shop.address}</Text>
            <View style={[styles.catPill, { backgroundColor: cat.soft }]}>
              <Ionicons name={catIconName as any} size={15} color={cat.onSoft} />
              <Text style={[styles.catPillText, { color: cat.onSoft }]}>{t(catLabelKey)}</Text>
            </View>
          </View>

          <View style={styles.ratingRow}>
            <Stars value={shop.rating || 0} size={18} />
            <Text style={styles.ratingNum}>{shop.rating ?? "–"}</Text>
            <Text style={styles.ratingCount}>· {shop.user_rating_count || 0} {t("shop.ratings")}</Text>
            {shop.open_now != null && (
              <View style={[styles.openBadge, { backgroundColor: shop.open_now ? colors.brandTertiary : colors.surfaceTertiary }]}>
                <Text style={[styles.openText, { color: shop.open_now ? colors.success : colors.muted }]}>
                  {shop.open_now ? t("shop.openNow") : t("shop.closedNow")}
                </Text>
              </View>
            )}
          </View>

          {/* Contact */}
          <Text style={styles.sectionTitle}>{t("shop.contact")}</Text>
          <View style={styles.infoCard}>
            {shop.phone ? (
              <Pressable style={styles.infoRow} onPress={() => Linking.openURL(`tel:${shop.phone}`)} testID="phone-row">
                <Ionicons name="call" size={18} color={colors.brand} />
                <Text style={styles.infoText}>{shop.phone}</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.muted} />
              </Pressable>
            ) : null}
            {shop.website ? (
              <>
                <View style={styles.infoSep} />
                <Pressable style={styles.infoRow} onPress={() => Linking.openURL(shop.website)} testID="website-row">
                  <Ionicons name="globe" size={18} color={colors.brand} />
                  <Text style={styles.infoText} numberOfLines={1}>{shop.website.replace(/^https?:\/\//, "")}</Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.muted} />
                </Pressable>
              </>
            ) : null}
          </View>

          {/* Hours */}
          {scheduleRows.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>{t("shop.hours")}</Text>
              <View style={styles.infoCard}>
                {scheduleRows.map((r, i) => (
                  <View key={i} style={[styles.hoursRow, i > 0 && styles.hoursBorder]}>
                    <Text style={[styles.hoursDay, r.today && styles.hoursToday]}>{r.label}</Text>
                    <Text style={[styles.hoursVal, r.today && styles.hoursToday]}>{r.value}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* Location */}
          {shop.latitude && shop.longitude ? (
            <>
              <Text style={styles.sectionTitle}>{t("shop.location")}</Text>
              <StoreMapSection shop={shop} />
            </>
          ) : null}

          {/* Reviews */}
          <Text style={styles.sectionTitle}>{t("shop.reviews")}</Text>
          {googleReviews.length === 0 ? (
            <Text style={styles.noReviews}>{t("shop.noReviews")}</Text>
          ) : (
            <>
              {googleReviews.map((r: any, i: number) => (
                <View key={i} style={styles.reviewCard} testID={`review-${i}`}>
                  <View style={styles.reviewTop}>
                    <Text style={styles.reviewAuthor}>{r.author}</Text>
                    <Stars value={r.rating || 0} size={13} />
                  </View>
                  {r.text ? <Text style={styles.reviewText} numberOfLines={5}>{r.text}</Text> : null}
                </View>
              ))}
              <Pressable
                style={styles.moreReviews}
                testID="more-reviews"
                onPress={() => Linking.openURL(`https://search.google.com/local/reviews?placeid=${shop.id}`)}
              >
                <Ionicons name="logo-google" size={16} color={colors.brand} />
                <Text style={styles.moreReviewsText}>{t("shop.moreReviews")}</Text>
                <Ionicons name="open-outline" size={15} color={colors.brand} />
              </Pressable>
            </>
          )}
        </View>
      </ScrollView>

      {/* Floating nav buttons — visible at any scroll level */}
      <View style={[styles.floatNav, { top: insets.top + spacing.sm }]} pointerEvents="box-none">
        <Pressable style={styles.iconBtn} onPress={() => router.back()} testID="back-button">
          <Ionicons name="chevron-back" size={24} color="#2A211C" />
        </Pressable>
        <Pressable style={styles.iconBtn} onPress={toggleFav} testID="favorite-toggle">
          <Ionicons name={fav ? "heart" : "heart-outline"} size={24} color={fav ? colors.error : "#2A211C"} />
        </Pressable>
      </View>

      {/* Sticky CTA */}
      <View style={[styles.ctaBar, { paddingBottom: insets.bottom + spacing.sm }]}>
        <Pressable
          style={styles.callBtn}
          testID="call-button"
          onPress={() => shop.phone && Linking.openURL(`tel:${shop.phone}`)}
        >
          <Ionicons name="call" size={20} color={colors.brand} />
          <Text style={styles.callText}>{t("shop.call")}</Text>
        </Pressable>
        <Pressable
          style={styles.bookBtn}
          testID="directions-button"
          onPress={() => {
            const q = shop.latitude && shop.longitude ? `${shop.latitude},${shop.longitude}` : encodeURIComponent(shop.name);
            Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${q}`);
          }}
        >
          <Ionicons name="navigate" size={20} color={colors.onBrand} />
          <Text style={styles.bookText}>{t("shop.directions")}</Text>
        </Pressable>
      </View>

      {/* Full-screen photo viewer */}
      <Modal visible={viewerOpen} transparent animationType="fade" onRequestClose={() => setViewerOpen(false)}>
        <View style={styles.viewer}>
          <FlatList
            data={galleryPhotos}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={viewerIndex}
            getItemLayout={(_, i) => ({ length: SCREEN_W, offset: SCREEN_W * i, index: i })}
            keyExtractor={(_, i) => String(i)}
            onMomentumScrollEnd={(e) =>
              setViewerIndex(Math.round(e.nativeEvent.contentOffset.x / SCREEN_W))
            }
            renderItem={({ item }) => (
              <View style={styles.viewerPage}>
                <Image source={{ uri: item }} style={styles.viewerImg} contentFit="contain" />
              </View>
            )}
          />
          <Pressable
            style={[styles.viewerClose, { top: insets.top + spacing.sm }]}
            onPress={() => setViewerOpen(false)}
            testID="viewer-close"
          >
            <Ionicons name="close" size={28} color="#fff" />
          </Pressable>
          {galleryPhotos.length > 1 && (
            <View style={[styles.viewerCount, { bottom: insets.bottom + spacing.xl }]} pointerEvents="none">
              <Text style={styles.viewerCountText}>{viewerIndex + 1} / {galleryPhotos.length}</Text>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, backgroundColor: colors.surface },
  errTitle: { fontSize: 16, fontWeight: "700", color: colors.onSurface },
  retryBtn: { backgroundColor: colors.brand, paddingHorizontal: spacing.xl, paddingVertical: spacing.sm, borderRadius: radius.pill },
  retryText: { color: colors.onBrand, fontWeight: "800" },
  hero: { height: 300 },
  heroImg: { width: SCREEN_W, height: 300, backgroundColor: colors.surfaceTertiary },
  dots: { position: "absolute", bottom: 34, left: 0, right: 0, flexDirection: "row", justifyContent: "center", gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.5)" },
  dotActive: { backgroundColor: "#fff", width: 18 },
  countBadge: { position: "absolute", top: spacing.sm, right: spacing.lg, flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(0,0,0,0.5)", paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.pill },
  countText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  viewer: { flex: 1, backgroundColor: "rgba(0,0,0,0.95)" },
  viewerPage: { width: SCREEN_W, height: SCREEN_H, alignItems: "center", justifyContent: "center" },
  viewerImg: { width: SCREEN_W, height: SCREEN_H * 0.85 },
  viewerClose: { position: "absolute", right: spacing.lg, width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" },
  viewerCount: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  viewerCountText: { color: "#fff", fontSize: 14, fontWeight: "800", backgroundColor: "rgba(0,0,0,0.5)", paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.pill, overflow: "hidden" },
  floatNav: { position: "absolute", left: 0, right: 0, flexDirection: "row", justifyContent: "space-between", paddingHorizontal: spacing.lg },
  iconBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.92)", alignItems: "center", justifyContent: "center", ...shadow.float },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, marginTop: -24, padding: spacing.lg, gap: spacing.sm },
  titleRow: { alignItems: "flex-start", gap: spacing.xs },
  name: { fontSize: 24, fontWeight: "800", color: colors.onSurface, fontFamily: fonts.display },
  addr: { fontSize: 14, color: colors.muted, marginTop: 2 },
  catPill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill, marginTop: spacing.xs },
  catPillText: { fontSize: 13, fontWeight: "800" },
  catBadge: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, flexWrap: "wrap", marginTop: spacing.xs },
  ratingNum: { fontSize: 16, fontWeight: "900", color: colors.onSurface, marginLeft: 4 },
  ratingCount: { fontSize: 14, color: colors.muted },
  openBadge: { marginLeft: "auto", paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.pill },
  openText: { fontSize: 12, fontWeight: "800" },
  sectionTitle: { fontSize: 18, fontWeight: "800", color: colors.onSurface, fontFamily: fonts.display, marginTop: spacing.lg },
  infoCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, ...shadow.card },
  infoRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg },
  infoSep: { height: 1, backgroundColor: colors.border, marginHorizontal: spacing.lg },
  infoText: { flex: 1, fontSize: 15, fontWeight: "700", color: colors.onSurface },
  hoursRow: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  hoursBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  hoursDay: { fontSize: 14, color: colors.onSurfaceTertiary },
  hoursVal: { fontSize: 14, color: colors.onSurfaceTertiary, fontWeight: "600" },
  hoursToday: { color: colors.brand, fontWeight: "900" },
  noReviews: { color: colors.muted, fontStyle: "italic", paddingVertical: spacing.sm },
  reviewCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, gap: spacing.xs, ...shadow.card, marginTop: spacing.sm },
  reviewTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  reviewAuthor: { fontSize: 14, fontWeight: "800", color: colors.onSurface },
  reviewText: { fontSize: 14, color: colors.onSurfaceTertiary, lineHeight: 20 },
  moreReviews: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingVertical: spacing.md, marginTop: spacing.sm },
  moreReviewsText: { fontSize: 14, fontWeight: "800", color: colors.brand },
  ctaBar: { position: "absolute", bottom: 0, left: 0, right: 0, flexDirection: "row", gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.md, backgroundColor: colors.surfaceSecondary, borderTopWidth: 1, borderTopColor: colors.border },
  callBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingHorizontal: spacing.xl, height: 54, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.brand },
  callText: { color: colors.brand, fontWeight: "800", fontSize: 16 },
  bookBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, height: 54, borderRadius: radius.pill, backgroundColor: colors.brand },
  bookText: { color: colors.onBrand, fontWeight: "800", fontSize: 16 },
});
