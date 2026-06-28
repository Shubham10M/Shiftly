import React, { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, Pressable, Dimensions, ActivityIndicator, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useRouter } from "expo-router";

import { api } from "../../src/api";
import { useAuth } from "../../src/context/auth";
import { COLORS, SP, R } from "../../src/theme";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const SWIPE_THRESHOLD = SCREEN_W * 0.28;

type Profile = {
  user_id: string;
  role: string;
  name: string;
  age?: number;
  gender?: string;
  city?: string;
  bio?: string;
  photo_base64?: string | null;
  photo_url?: string | null;
  qualification?: string;
  skills?: string[];
  available_hours?: string;
  expected_pay?: number;
  shop_name?: string;
  help_needed?: string;
  duration?: string;
  no_of_days?: string;
  pay_offered?: number;
  required_gender?: string;
  required_qualification?: string;
  message?: string;
};

export default function SwipeDeckScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [deck, setDeck] = useState<Profile[]>([]);
  const [idx, setIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const rotation = useSharedValue(0);

  const loadDeck = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api("/swipe/deck");
      setDeck(data.deck || []);
      setIdx(0);
    } catch (e: any) {
      setError(e?.message || "Could not load profiles");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDeck();
  }, [loadDeck]);

  const handleSwipe = async (direction: "like" | "pass", target: Profile) => {
    try {
      const res = await api("/swipe", {
        method: "POST",
        body: JSON.stringify({ target_user_id: target.user_id, direction }),
      });
      if (res?.matched && res?.match?.match_id) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        router.push(`/match/${res.match.match_id}`);
      }
    } catch (e) {
      // swallow; user can retry
    } finally {
      setIdx((i) => i + 1);
      translateX.value = 0;
      translateY.value = 0;
      rotation.value = 0;
    }
  };

  const finishSwipe = (dir: number, target: Profile) => {
    if (dir > 0) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
      handleSwipe("like", target);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      handleSwipe("pass", target);
    }
  };

  const current = deck[idx];

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value = e.translationX;
      translateY.value = e.translationY * 0.4;
      rotation.value = interpolate(e.translationX, [-SCREEN_W, 0, SCREEN_W], [-12, 0, 12], Extrapolation.CLAMP);
    })
    .onEnd((e) => {
      if (!current) return;
      if (e.translationX > SWIPE_THRESHOLD) {
        translateX.value = withTiming(SCREEN_W * 1.2, { duration: 240 });
        runOnJS(finishSwipe)(1, current);
      } else if (e.translationX < -SWIPE_THRESHOLD) {
        translateX.value = withTiming(-SCREEN_W * 1.2, { duration: 240 });
        runOnJS(finishSwipe)(-1, current);
      } else {
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        rotation.value = withSpring(0);
      }
    });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotateZ: `${rotation.value}deg` },
    ],
  }));

  const likeBadgeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, SWIPE_THRESHOLD], [0, 1], Extrapolation.CLAMP),
  }));
  const passBadgeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-SWIPE_THRESHOLD, 0], [1, 0], Extrapolation.CLAMP),
  }));

  const buttonSwipe = (dir: "like" | "pass") => {
    if (!current) return;
    if (dir === "like") {
      translateX.value = withTiming(SCREEN_W * 1.2, { duration: 240 });
      finishSwipe(1, current);
    } else {
      translateX.value = withTiming(-SCREEN_W * 1.2, { duration: 240 });
      finishSwipe(-1, current);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.brand}>Shiftly</Text>
        <Text style={styles.subhead}>{user?.role === "student" ? "Shops looking for you" : "Students ready to work"}</Text>
      </View>

      <View style={styles.deckArea}>
        {loading ? (
          <ActivityIndicator color={COLORS.brandPrimary} size="large" />
        ) : error ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{error}</Text>
            <Pressable onPress={loadDeck} style={styles.refreshBtn}>
              <Text style={styles.refreshBtnText}>Retry</Text>
            </Pressable>
          </View>
        ) : !current ? (
          <View style={styles.empty} testID="deck-empty">
            <Ionicons name="checkmark-done-circle" size={64} color={COLORS.brandPrimary} />
            <Text style={styles.emptyTitle}>You're all caught up!</Text>
            <Text style={styles.emptyText}>Check back later for more matches.</Text>
            <Pressable onPress={loadDeck} style={styles.refreshBtn} testID="deck-refresh">
              <Text style={styles.refreshBtnText}>Refresh</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {deck[idx + 1] && <SwipeCard profile={deck[idx + 1]} behind />}
            <GestureDetector gesture={pan}>
              <Animated.View style={[styles.cardWrap, cardStyle]} testID={`swipe-card-${current.user_id}`}>
                <SwipeCardInner profile={current} likeBadgeStyle={likeBadgeStyle} passBadgeStyle={passBadgeStyle} />
              </Animated.View>
            </GestureDetector>
          </>
        )}
      </View>

      {current && (
        <View style={styles.actions}>
          <Pressable testID="swipe-pass-btn" onPress={() => buttonSwipe("pass")} style={[styles.fab, styles.fabPass]}>
            <Ionicons name="close" size={32} color={COLORS.onSurface} />
          </Pressable>
          <Pressable testID="swipe-like-btn" onPress={() => buttonSwipe("like")} style={[styles.fab, styles.fabLike]}>
            <Ionicons name="heart" size={32} color={COLORS.onBrandPrimary} />
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

function SwipeCard({ profile, behind }: { profile: Profile; behind?: boolean }) {
  return (
    <View style={[styles.cardWrap, behind && { transform: [{ scale: 0.94 }], opacity: 0.7 }]}>
      <SwipeCardInner profile={profile} />
    </View>
  );
}

function SwipeCardInner({
  profile,
  likeBadgeStyle,
  passBadgeStyle,
}: {
  profile: Profile;
  likeBadgeStyle?: any;
  passBadgeStyle?: any;
}) {
  const photo = profile.photo_base64 || profile.photo_url;
  const isShop = profile.role === "shop_owner";
  const pay = isShop ? profile.pay_offered : profile.expected_pay;
  return (
    <View style={styles.card}>
      <View style={styles.photoWrap}>
        {photo ? (
          <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: COLORS.surfaceTertiary }]} />
        )}
        <LinearGradient colors={["transparent", "rgba(41,37,36,0.85)"]} style={styles.scrim} />
        {likeBadgeStyle && (
          <Animated.View style={[styles.likeBadge, likeBadgeStyle]} pointerEvents="none">
            <Text style={styles.likeBadgeText}>LIKE</Text>
          </Animated.View>
        )}
        {passBadgeStyle && (
          <Animated.View style={[styles.passBadge, passBadgeStyle]} pointerEvents="none">
            <Text style={styles.passBadgeText}>PASS</Text>
          </Animated.View>
        )}
        <View style={styles.photoText}>
          <Text style={styles.cardName} numberOfLines={1}>
            {profile.name}{profile.age ? `, ${profile.age}` : ""}
          </Text>
          <Text style={styles.cardRole} numberOfLines={1}>
            {isShop ? profile.shop_name || "Shop Owner" : (profile.qualification || "Student")}
          </Text>
          <View style={styles.metaRow}>
            {profile.city ? (
              <View style={styles.metaChip}>
                <Ionicons name="location-outline" size={12} color={COLORS.onBrandPrimary} />
                <Text style={styles.metaChipText}>{profile.city}</Text>
              </View>
            ) : null}
            {pay ? (
              <View style={styles.metaChip}>
                <Ionicons name="cash-outline" size={12} color={COLORS.onBrandPrimary} />
                <Text style={styles.metaChipText}>₹{pay}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>

      <ScrollView style={styles.details} contentContainerStyle={{ padding: SP.lg, gap: SP.md }}>
        {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}
        {isShop ? (
          <>
            {profile.help_needed ? (
              <InfoRow icon="briefcase-outline" label="Needs help with" value={profile.help_needed} />
            ) : null}
            {profile.duration ? <InfoRow icon="time-outline" label="Duration" value={profile.duration} /> : null}
            {profile.no_of_days ? <InfoRow icon="calendar-outline" label="Schedule" value={profile.no_of_days} /> : null}
            {profile.required_gender && profile.required_gender !== "any" ? (
              <InfoRow icon="people-outline" label="Looking for" value={profile.required_gender} />
            ) : null}
            {profile.required_qualification ? (
              <InfoRow icon="school-outline" label="Qualification" value={profile.required_qualification} />
            ) : null}
            {profile.message ? <InfoRow icon="chatbox-outline" label="Message" value={profile.message} /> : null}
          </>
        ) : (
          <>
            {profile.skills && profile.skills.length > 0 ? (
              <View>
                <Text style={styles.infoLabel}>Skills</Text>
                <View style={styles.skillRow}>
                  {profile.skills.map((s) => (
                    <View key={s} style={styles.skillChip}>
                      <Text style={styles.skillChipText}>{s}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
            {profile.available_hours ? (
              <InfoRow icon="time-outline" label="Available" value={profile.available_hours} />
            ) : null}
            {profile.qualification ? (
              <InfoRow icon="school-outline" label="Qualification" value={profile.qualification} />
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function InfoRow({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={18} color={COLORS.brandPrimary} />
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.surface },
  header: { paddingHorizontal: SP.xl, paddingTop: SP.sm, paddingBottom: SP.md },
  brand: { fontSize: 26, fontWeight: "500", color: COLORS.brandPrimary, letterSpacing: -0.5 },
  subhead: { color: COLORS.onSurfaceSecondary, fontSize: 13, marginTop: 2 },
  deckArea: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: SP.lg },
  cardWrap: { position: "absolute", width: SCREEN_W - SP.lg * 2, height: SCREEN_H * 0.65 },
  card: {
    flex: 1,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: R.lg,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 6,
  },
  photoWrap: { height: "55%", width: "100%", backgroundColor: COLORS.surfaceTertiary },
  scrim: { position: "absolute", left: 0, right: 0, bottom: 0, height: "55%" },
  photoText: { position: "absolute", left: SP.lg, right: SP.lg, bottom: SP.lg },
  cardName: { color: COLORS.onSurfaceInverse, fontSize: 26, fontWeight: "500" },
  cardRole: { color: COLORS.onSurfaceInverse, fontSize: 14, opacity: 0.9, marginTop: 2 },
  metaRow: { flexDirection: "row", gap: SP.sm, marginTop: SP.sm },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.18)",
    paddingHorizontal: SP.sm,
    paddingVertical: 4,
    borderRadius: R.pill,
  },
  metaChipText: { color: COLORS.onSurfaceInverse, fontSize: 12, fontWeight: "500" },
  details: { flex: 1 },
  bio: { fontSize: 15, color: COLORS.onSurface, lineHeight: 21 },
  infoRow: { flexDirection: "row", gap: SP.md, alignItems: "flex-start" },
  infoLabel: { fontSize: 12, color: COLORS.muted, marginBottom: 2 },
  infoValue: { fontSize: 14, color: COLORS.onSurface },
  skillRow: { flexDirection: "row", flexWrap: "wrap", gap: SP.sm, marginTop: SP.xs },
  skillChip: { backgroundColor: COLORS.brandTertiary, paddingHorizontal: SP.md, paddingVertical: 6, borderRadius: R.pill },
  skillChipText: { color: COLORS.onBrandTertiary, fontSize: 12, fontWeight: "500" },
  likeBadge: {
    position: "absolute",
    top: SP.xl,
    left: SP.xl,
    borderWidth: 3,
    borderColor: COLORS.success,
    paddingHorizontal: SP.md,
    paddingVertical: 4,
    borderRadius: R.sm,
    transform: [{ rotate: "-12deg" }],
  },
  likeBadgeText: { color: COLORS.success, fontSize: 28, fontWeight: "500" },
  passBadge: {
    position: "absolute",
    top: SP.xl,
    right: SP.xl,
    borderWidth: 3,
    borderColor: COLORS.error,
    paddingHorizontal: SP.md,
    paddingVertical: 4,
    borderRadius: R.sm,
    transform: [{ rotate: "12deg" }],
  },
  passBadgeText: { color: COLORS.error, fontSize: 28, fontWeight: "500" },
  actions: {
    flexDirection: "row",
    justifyContent: "center",
    gap: SP.xl,
    paddingBottom: SP.md,
  },
  fab: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 4,
  },
  fabPass: { backgroundColor: COLORS.surfaceSecondary, borderWidth: 1, borderColor: COLORS.border },
  fabLike: { backgroundColor: COLORS.brandPrimary },
  empty: { alignItems: "center", padding: SP.xl, gap: SP.md },
  emptyTitle: { fontSize: 20, fontWeight: "500", color: COLORS.onSurface, marginTop: SP.md },
  emptyText: { fontSize: 14, color: COLORS.onSurfaceSecondary, textAlign: "center" },
  refreshBtn: { backgroundColor: COLORS.brandPrimary, paddingHorizontal: SP.xl, paddingVertical: SP.md, borderRadius: R.pill, marginTop: SP.md },
  refreshBtnText: { color: COLORS.onBrandPrimary, fontWeight: "500" },
});
