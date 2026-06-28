import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { api } from "../src/api";
import { useAuth } from "../src/context/auth";
import { COLORS, SP, R } from "../src/theme";

export default function RoleSelectScreen() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [role, setRole] = useState<"student" | "shop_owner" | null>(null);
  const [loading, setLoading] = useState(false);

  const cont = async () => {
    if (!role) return;
    setLoading(true);
    try {
      // Save role intent by routing to profile setup with role pre-selected
      router.replace({ pathname: "/profile-setup", params: { role } });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>I am a...</Text>
        <Text style={styles.sub}>Choose how you want to use ShiftPe.</Text>
      </View>

      <View style={styles.cards}>
        <RoleCard
          testID="role-student"
          selected={role === "student"}
          onPress={() => setRole("student")}
          icon="school-outline"
          title="Student"
          desc="Looking for part-time work, gigs, or contract shifts."
        />
        <RoleCard
          testID="role-shop"
          selected={role === "shop_owner"}
          onPress={() => setRole("shop_owner")}
          icon="storefront-outline"
          title="Shop Owner"
          desc="Need extra hands at the shop for a few hours or days."
        />
      </View>

      <Pressable
        testID="role-continue-btn"
        onPress={cont}
        disabled={!role || loading}
        style={({ pressed }) => [
          styles.cta,
          { opacity: !role ? 0.45 : pressed ? 0.85 : 1 },
        ]}
      >
        {loading ? (
          <ActivityIndicator color={COLORS.onBrandPrimary} />
        ) : (
          <Text style={styles.ctaText}>Continue</Text>
        )}
      </Pressable>
    </SafeAreaView>
  );
}

function RoleCard({
  testID,
  selected,
  onPress,
  icon,
  title,
  desc,
}: {
  testID: string;
  selected: boolean;
  onPress: () => void;
  icon: any;
  title: string;
  desc: string;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={[styles.card, selected && styles.cardSelected]}
    >
      <View style={[styles.iconWrap, selected && { backgroundColor: COLORS.brandPrimary }]}>
        <Ionicons name={icon} size={28} color={selected ? COLORS.onBrandPrimary : COLORS.brandPrimary} />
      </View>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardDesc}>{desc}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.surface, paddingHorizontal: SP.xl },
  header: { marginTop: SP.xl, marginBottom: SP.xl },
  title: { fontSize: 32, fontWeight: "500", color: COLORS.onSurface },
  sub: { fontSize: 15, color: COLORS.onSurfaceSecondary, marginTop: SP.xs },
  cards: { flex: 1, gap: SP.lg, paddingTop: SP.md },
  card: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: R.lg,
    padding: SP.xl,
    borderWidth: 2,
    borderColor: COLORS.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardSelected: { backgroundColor: COLORS.brandTertiary, borderColor: COLORS.brandPrimary },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: R.md,
    backgroundColor: COLORS.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SP.md,
  },
  cardTitle: { fontSize: 22, fontWeight: "500", color: COLORS.onSurface },
  cardDesc: { fontSize: 14, color: COLORS.onSurfaceSecondary, marginTop: SP.xs },
  cta: {
    backgroundColor: COLORS.brandPrimary,
    paddingVertical: SP.lg,
    borderRadius: R.pill,
    alignItems: "center",
    marginBottom: SP.lg,
  },
  ctaText: { color: COLORS.onBrandPrimary, fontSize: 16, fontWeight: "500" },
});
