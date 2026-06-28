import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { api } from "../../src/api";
import { useAuth } from "../../src/context/auth";
import { COLORS, SP, R } from "../../src/theme";

export default function ProfileTab() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await api("/profile/me");
      setProfile(data.profile);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleLogout = async () => {
    try {
      await logout();
    } catch {}
    // Gate will detect user===null and redirect to '/'
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.root}>
        <ActivityIndicator color={COLORS.brandPrimary} style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  const photo = profile?.photo_base64 || profile?.photo_url;
  const isShop = profile?.role === "shop_owner";

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: SP.xl, paddingBottom: SP.xxxl }}>
        <View style={styles.head}>
          {photo ? (
            <Image source={{ uri: photo }} style={styles.avatar} contentFit="cover" />
          ) : (
            <View style={[styles.avatar, { alignItems: "center", justifyContent: "center" }]}>
              <Ionicons name="person" size={56} color={COLORS.brandPrimary} />
            </View>
          )}
          <Text style={styles.name} testID="profile-name">{profile?.name}</Text>
          <Text style={styles.role}>{isShop ? (profile?.shop_name || "Shop Owner") : "Student"}</Text>
          {profile?.city ? <Text style={styles.city}>{profile.city}</Text> : null}
        </View>

        <Section title="About">
          <Text style={styles.body}>{profile?.bio || "—"}</Text>
        </Section>

        {isShop ? (
          <>
            <Section title="Help needed"><Text style={styles.body}>{profile?.help_needed || "—"}</Text></Section>
            <Row label="Duration" value={profile?.duration} />
            <Row label="Schedule" value={profile?.no_of_days} />
            <Row label="Pay" value={profile?.pay_offered ? `₹${profile.pay_offered}` : null} />
            <Row label="Required gender" value={profile?.required_gender} />
            <Row label="Required qualification" value={profile?.required_qualification} />
            {profile?.message ? <Section title="Message"><Text style={styles.body}>{profile.message}</Text></Section> : null}
          </>
        ) : (
          <>
            <Row label="Qualification" value={profile?.qualification} />
            <Row label="Experience" value={profile?.experience} />
            <Row label="Available" value={profile?.available_hours} />
            <Row label="Expected pay" value={profile?.expected_pay ? `₹${profile.expected_pay}` : null} />
            {profile?.skills?.length ? (
              <Section title="Skills">
                <View style={styles.skillRow}>
                  {profile.skills.map((s: string) => (
                    <View key={s} style={styles.skillChip}><Text style={styles.skillChipText}>{s}</Text></View>
                  ))}
                </View>
              </Section>
            ) : null}
          </>
        )}

        <Pressable
          testID="edit-profile-btn"
          onPress={() => router.push({ pathname: "/profile-setup", params: { role: profile?.role } })}
          style={styles.editBtn}
        >
          <Ionicons name="create-outline" size={18} color={COLORS.onSurface} />
          <Text style={styles.editBtnText}>Edit profile</Text>
        </Pressable>

        <Pressable testID="logout-btn" onPress={handleLogout} style={styles.logoutBtn}>
          <Ionicons name="log-out-outline" size={18} color={COLORS.error} />
          <Text style={styles.logoutText}>Log out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: SP.lg }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.surface },
  head: { alignItems: "center", marginTop: SP.md },
  avatar: { width: 120, height: 120, borderRadius: 60, backgroundColor: COLORS.surfaceTertiary, borderWidth: 3, borderColor: COLORS.brandTertiary },
  name: { fontSize: 24, fontWeight: "500", color: COLORS.onSurface, marginTop: SP.md },
  role: { fontSize: 14, color: COLORS.brandPrimary, fontWeight: "500", marginTop: 2 },
  city: { fontSize: 13, color: COLORS.muted, marginTop: 2 },
  sectionTitle: { fontSize: 12, fontWeight: "500", color: COLORS.muted, textTransform: "uppercase", letterSpacing: 0.6 },
  sectionBody: { backgroundColor: COLORS.surfaceSecondary, borderRadius: R.md, padding: SP.md, marginTop: SP.xs, borderWidth: 1, borderColor: COLORS.border },
  body: { color: COLORS.onSurface, fontSize: 14, lineHeight: 20 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: SP.sm, borderBottomColor: COLORS.divider, borderBottomWidth: 1 },
  rowLabel: { color: COLORS.muted, fontSize: 13 },
  rowValue: { color: COLORS.onSurface, fontSize: 14, fontWeight: "500", flexShrink: 1, textAlign: "right", marginLeft: SP.md },
  skillRow: { flexDirection: "row", flexWrap: "wrap", gap: SP.sm },
  skillChip: { backgroundColor: COLORS.brandTertiary, paddingHorizontal: SP.md, paddingVertical: 6, borderRadius: R.pill },
  skillChipText: { color: COLORS.onBrandTertiary, fontSize: 12, fontWeight: "500" },
  editBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SP.sm,
    marginTop: SP.xl, paddingVertical: SP.md, borderRadius: R.pill, backgroundColor: COLORS.surfaceSecondary, borderWidth: 1, borderColor: COLORS.borderStrong,
  },
  editBtnText: { color: COLORS.onSurface, fontWeight: "500", fontSize: 15 },
  logoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SP.sm, marginTop: SP.md, paddingVertical: SP.md, borderRadius: R.pill },
  logoutText: { color: COLORS.error, fontWeight: "500", fontSize: 15 },
});
