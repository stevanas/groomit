import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator,
  Linking, Modal, TextInput, KeyboardAvoidingView, Platform,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiGet, apiPost, photoUrl } from "@/src/api";
import { useAuth } from "@/src/auth";
import { colors, spacing, radius, shadow } from "@/src/theme";

function Stars({ value, size = 14 }: { value: number; size?: number }) {
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
  const { user } = useAuth();

  const [shop, setShop] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [fav, setFav] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [myRating, setMyRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await apiGet(`/places/${id}`);
      setShop(data);
      if (user) {
        try {
          const f = await apiGet("/favorites", true);
          setFav((f.favorites || []).some((x: any) => x.place_id === id));
        } catch {}
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [id, user]);

  useEffect(() => { load(); }, [load]);

  const toggleFav = async () => {
    if (!shop) return;
    setFav((v) => !v);
    try {
      await apiPost("/favorites", {
        place_id: shop.id, name: shop.name, address: shop.address,
        category: shop.category, rating: shop.rating,
        image_url: shop.image_url, photo_name: shop.photos?.[0] && !shop.image_url ? shop.photos[0] : null,
      }, true);
    } catch { setFav((v) => !v); }
  };

  const submitReview = async () => {
    setSubmitting(true);
    try {
      await apiPost("/reviews", { place_id: shop.id, place_name: shop.name, rating: myRating, comment }, true);
      setModalOpen(false);
      setComment("");
      setMyRating(5);
      await load();
    } catch {} finally { setSubmitting(false); }
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.brand} /></View>;
  }
  if (error || !shop) {
    return (
      <View style={styles.center}>
        <Text style={styles.errTitle}>Failed to load shop details</Text>
        <Pressable style={styles.retryBtn} onPress={load}><Text style={styles.retryText}>Retry</Text></Pressable>
      </View>
    );
  }

  const heroUri = photoUrl(shop) || (shop.photos?.[0] ? photoUrl({ photo_name: shop.photos[0] }) : null);
  const appReviews = shop.app_reviews || [];
  const googleReviews = shop.google_reviews || [];

  return (
    <View style={styles.container} testID="shop-detail">
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Image source={{ uri: heroUri || undefined }} style={StyleSheet.absoluteFill} contentFit="cover" />
          <LinearGradient colors={["rgba(43,48,40,0.4)", "transparent", "rgba(43,48,40,0.6)"]} style={StyleSheet.absoluteFill} />
          <View style={[styles.heroTop, { paddingTop: insets.top + spacing.sm }]}>
            <Pressable style={styles.iconBtn} onPress={() => router.back()} testID="back-button">
              <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
            </Pressable>
            <Pressable style={styles.iconBtn} onPress={toggleFav} testID="favorite-toggle">
              <Ionicons name={fav ? "heart" : "heart-outline"} size={24} color={fav ? colors.error : colors.onSurface} />
            </Pressable>
          </View>
        </View>

        <View style={styles.sheet}>
          <View style={styles.titleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{shop.name}</Text>
              <Text style={styles.addr}>{shop.address}</Text>
            </View>
            <View style={[styles.catBadge, { backgroundColor: shop.category === "groomer" ? colors.brand : colors.warning }]}>
              <Ionicons name={shop.category === "groomer" ? "cut" : "storefront"} size={14} color="#fff" />
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statNum}>{shop.rating ?? "–"}</Text>
              <Stars value={shop.rating || 0} />
              <Text style={styles.statLabel}>{shop.user_rating_count || 0} ratings</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.stat}>
              <Text style={styles.statNum}>{shop.app_rating ?? "–"}</Text>
              <Text style={styles.statLabel}>App reviews ({shop.app_review_count})</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.stat}>
              <Ionicons name={shop.open_now ? "time" : "time-outline"} size={20} color={shop.open_now ? colors.success : colors.muted} />
              <Text style={[styles.statLabel, { color: shop.open_now ? colors.success : colors.muted, fontWeight: "800" }]}>
                {shop.open_now == null ? "Hours n/a" : shop.open_now ? "Open now" : "Closed"}
              </Text>
            </View>
          </View>

          {/* Reviews */}
          <View style={styles.reviewHeader}>
            <Text style={styles.sectionTitle}>Reviews</Text>
            <Pressable style={styles.writeBtn} onPress={() => setModalOpen(true)} testID="write-review-button">
              <Ionicons name="create-outline" size={16} color={colors.brand} />
              <Text style={styles.writeText}>Write</Text>
            </Pressable>
          </View>

          {appReviews.length === 0 && googleReviews.length === 0 && (
            <Text style={styles.noReviews}>No reviews yet. Be the first to review!</Text>
          )}

          {appReviews.map((r: any) => (
            <View key={r.id} style={styles.reviewCard} testID={`app-review-${r.id}`}>
              <View style={styles.reviewTop}>
                <Text style={styles.reviewAuthor}>{r.author}</Text>
                <Stars value={r.rating} size={13} />
              </View>
              {r.comment ? <Text style={styles.reviewText}>{r.comment}</Text> : null}
            </View>
          ))}

          {googleReviews.map((r: any, i: number) => (
            <View key={`g${i}`} style={styles.reviewCard}>
              <View style={styles.reviewTop}>
                <Text style={styles.reviewAuthor}>{r.author}</Text>
                <Stars value={r.rating || 0} size={13} />
              </View>
              {r.text ? <Text style={styles.reviewText} numberOfLines={4}>{r.text}</Text> : null}
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Sticky bottom CTA */}
      <View style={[styles.ctaBar, { paddingBottom: insets.bottom + spacing.sm }]}>
        <Pressable
          style={styles.callBtn}
          testID="call-button"
          onPress={() => shop.phone && Linking.openURL(`tel:${shop.phone}`)}
        >
          <Ionicons name="call" size={20} color={colors.brand} />
          <Text style={styles.callText}>Call</Text>
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
          <Text style={styles.bookText}>Get Directions</Text>
        </Pressable>
      </View>

      {/* Review modal */}
      <Modal visible={modalOpen} transparent animationType="slide" onRequestClose={() => setModalOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalWrap}>
          <Pressable style={styles.backdrop} onPress={() => setModalOpen(false)} />
          <View style={[styles.modalCard, { paddingBottom: insets.bottom + spacing.lg }]}>
            <Text style={styles.modalTitle}>Rate {shop.name}</Text>
            <View style={styles.starPick}>
              {[1, 2, 3, 4, 5].map((i) => (
                <Pressable key={i} onPress={() => setMyRating(i)} testID={`star-${i}`}>
                  <Ionicons name={i <= myRating ? "star" : "star-outline"} size={36} color={colors.warning} />
                </Pressable>
              ))}
            </View>
            <TextInput
              style={styles.input}
              placeholder="Share your experience…"
              placeholderTextColor={colors.muted}
              value={comment}
              onChangeText={setComment}
              multiline
              testID="review-input"
            />
            <Pressable style={styles.submitBtn} onPress={submitReview} disabled={submitting} testID="submit-review-button">
              {submitting ? <ActivityIndicator color={colors.onBrand} /> : <Text style={styles.submitText}>Post Review</Text>}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, backgroundColor: colors.surface },
  errTitle: { fontSize: 16, fontWeight: "700", color: colors.onSurface },
  retryBtn: { backgroundColor: colors.brand, paddingHorizontal: spacing.xl, paddingVertical: spacing.sm, borderRadius: radius.pill },
  retryText: { color: colors.onBrand, fontWeight: "800" },
  hero: { height: 300 },
  heroTop: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: spacing.lg },
  iconBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.92)", alignItems: "center", justifyContent: "center", ...shadow.card },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, marginTop: -24, padding: spacing.lg, gap: spacing.md },
  titleRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  name: { fontSize: 24, fontWeight: "900", color: colors.onSurface },
  addr: { fontSize: 14, color: colors.muted, marginTop: 4 },
  catBadge: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  statsRow: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, ...shadow.card },
  stat: { flex: 1, alignItems: "center", gap: 3 },
  statNum: { fontSize: 20, fontWeight: "900", color: colors.onSurface },
  statLabel: { fontSize: 11, color: colors.muted, textAlign: "center" },
  divider: { width: 1, height: 36, backgroundColor: colors.border },
  reviewHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.sm },
  sectionTitle: { fontSize: 18, fontWeight: "900", color: colors.onSurface },
  writeBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.brandTertiary, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill },
  writeText: { color: colors.brand, fontWeight: "800", fontSize: 13 },
  noReviews: { color: colors.muted, fontStyle: "italic", paddingVertical: spacing.md },
  reviewCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, gap: spacing.xs, ...shadow.card },
  reviewTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  reviewAuthor: { fontSize: 14, fontWeight: "800", color: colors.onSurface },
  reviewText: { fontSize: 14, color: colors.onSurfaceTertiary, lineHeight: 20 },
  ctaBar: { position: "absolute", bottom: 0, left: 0, right: 0, flexDirection: "row", gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.md, backgroundColor: colors.surfaceSecondary, borderTopWidth: 1, borderTopColor: colors.border },
  callBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingHorizontal: spacing.xl, height: 54, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.brand },
  callText: { color: colors.brand, fontWeight: "800", fontSize: 16 },
  bookBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, height: 54, borderRadius: radius.pill, backgroundColor: colors.brand },
  bookText: { color: colors.onBrand, fontWeight: "800", fontSize: 16 },
  modalWrap: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.4)" },
  modalCard: { backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.xl, gap: spacing.lg },
  modalTitle: { fontSize: 20, fontWeight: "900", color: colors.onSurface, textAlign: "center" },
  starPick: { flexDirection: "row", justifyContent: "center", gap: spacing.sm },
  input: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, minHeight: 90, textAlignVertical: "top", fontSize: 15, color: colors.onSurface },
  submitBtn: { backgroundColor: colors.brand, height: 54, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  submitText: { color: colors.onBrand, fontWeight: "800", fontSize: 16 },
});
