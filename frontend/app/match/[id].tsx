import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";

import { api } from "../../src/api";
import { COLORS, SP, R } from "../../src/theme";

export default function MatchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [match, setMatch] = useState<any>(null);
  const [me, setMe] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [m, p] = await Promise.all([
          api(`/matches/${id}`),
          api("/profile/me"),
        ]);
        setMatch(m);
        setMe(p.profile);
      } catch {}
      setLoading(false);
    })();
  }, [id]);

  if (loading) {
    return (
      <View style={styles.root}>
        <ActivityIndicator color={COLORS.onBrandPrimary} />
      </View>
    );
  }

  const other = match?.other;
  const myPhoto = me?.photo_base64 || me?.photo_url;
  const otherPhoto = other?.photo_base64 || other?.photo_url;

  return (
    <View style={styles.root}>
      <LinearGradient colors={[COLORS.brandPrimary, COLORS.brandSecondary]} style={StyleSheet.absoluteFill} />
      <View style={styles.content}>
        <Text style={styles.title}>It's a Match!</Text>
        <Text style={styles.sub}>You and {other?.name} both said yes.</Text>

        <View style={styles.avatarsRow}>
          <Image source={{ uri: myPhoto }} style={[styles.avatar, { marginRight: -24 }]} contentFit="cover" />
          <Image source={{ uri: otherPhoto }} style={[styles.avatar, { marginLeft: -24 }]} contentFit="cover" />
        </View>

        <Pressable
          testID="match-chat-btn"
          onPress={() => router.replace(`/chat/${id}`)}
          style={({ pressed }) => [styles.primary, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.primaryText}>Send a message</Text>
        </Pressable>
        <Pressable
          testID="match-keep-swiping-btn"
          onPress={() => router.replace("/(tabs)")}
          style={styles.secondary}
        >
          <Text style={styles.secondaryText}>Keep swiping</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.brandPrimary },
  content: { alignItems: "center", padding: SP.xl, gap: SP.lg, width: "100%" },
  title: { color: COLORS.onBrandPrimary, fontSize: 44, fontWeight: "500", letterSpacing: -1 },
  sub: { color: COLORS.onBrandPrimary, fontSize: 16, opacity: 0.9, textAlign: "center" },
  avatarsRow: { flexDirection: "row", marginVertical: SP.xl },
  avatar: {
    width: 140, height: 140, borderRadius: 70,
    borderWidth: 4, borderColor: COLORS.onBrandPrimary,
    backgroundColor: COLORS.surfaceTertiary,
  },
  primary: {
    backgroundColor: COLORS.surfaceInverse,
    paddingVertical: SP.lg,
    paddingHorizontal: SP.xxl,
    borderRadius: R.pill,
    minWidth: 240,
    alignItems: "center",
  },
  primaryText: { color: COLORS.onSurfaceInverse, fontSize: 16, fontWeight: "500" },
  secondary: {
    paddingVertical: SP.md,
    paddingHorizontal: SP.xxl,
    borderRadius: R.pill,
    borderWidth: 1.5,
    borderColor: COLORS.onBrandPrimary,
    minWidth: 240,
    alignItems: "center",
  },
  secondaryText: { color: COLORS.onBrandPrimary, fontSize: 16, fontWeight: "500" },
});
