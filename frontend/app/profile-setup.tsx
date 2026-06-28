import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";

import { api } from "../src/api";
import { useAuth } from "../src/context/auth";
import { COLORS, SP, R } from "../src/theme";

const SKILL_OPTIONS = ["Cashier", "Customer service", "Stocking", "Delivery", "Billing", "Tutoring", "Cleaning", "Cooking help"];
const DURATION_OPTIONS = ["2-3 hours", "4-5 hours", "Full day", "Few days/week", "Contract"];
const GENDER_OPTIONS = ["any", "male", "female"];

export default function ProfileSetupScreen() {
  const router = useRouter();
  const { refresh, user, logout } = useAuth();
  const params = useLocalSearchParams<{ role?: string }>();
  const role = (params.role as "student" | "shop_owner") || user?.role || "student";

  const [name, setName] = useState(user?.name || "");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "any">("any");
  const [city, setCity] = useState("");
  const [bio, setBio] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  // student
  const [qualification, setQualification] = useState("");
  const [experience, setExperience] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [availableHours, setAvailableHours] = useState("");
  const [expectedPay, setExpectedPay] = useState("");
  // shop
  const [shopName, setShopName] = useState("");
  const [helpNeeded, setHelpNeeded] = useState("");
  const [duration, setDuration] = useState("");
  const [noOfDays, setNoOfDays] = useState("");
  const [payOffered, setPayOffered] = useState("");
  const [requiredGender, setRequiredGender] = useState<"male" | "female" | "any">("any");
  const [requiredQualification, setRequiredQualification] = useState("");
  const [requiredExperience, setRequiredExperience] = useState("");
  const [message, setMessage] = useState("");

  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.6,
      base64: true,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (!result.canceled && result.assets[0]?.base64) {
      const b64 = result.assets[0].base64;
      setPhoto(`data:image/jpeg;base64,${b64}`);
    }
  };

  const toggleSkill = (s: string) => {
    setSkills((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));
  };

  const aiSuggestBio = async () => {
    setAiLoading(true);
    setError(null);
    try {
      const data = await api("/ai/bio-suggestion", {
        method: "POST",
        body: JSON.stringify({
          role,
          name,
          skills,
          help_needed: helpNeeded,
          qualification,
        }),
      });
      if (data?.bio) setBio(data.bio);
    } catch (e: any) {
      setError(e?.message || "AI suggestion failed");
    } finally {
      setAiLoading(false);
    }
  };

  const submit = async () => {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await api("/profile/setup", {
        method: "POST",
        body: JSON.stringify({
          role,
          name: name.trim(),
          age: age ? parseInt(age, 10) : null,
          gender,
          city: city.trim() || null,
          bio: bio.trim(),
          photo_base64: photo,
          qualification: qualification.trim() || null,
          experience: experience.trim() || null,
          skills,
          available_hours: availableHours.trim() || null,
          expected_pay: expectedPay ? parseInt(expectedPay, 10) : null,
          shop_name: shopName.trim() || null,
          help_needed: helpNeeded.trim() || null,
          duration: duration || null,
          no_of_days: noOfDays.trim() || null,
          pay_offered: payOffered ? parseInt(payOffered, 10) : null,
          required_gender: requiredGender,
          required_qualification: requiredQualification.trim() || null,
          required_experience: requiredExperience.trim() || null,
          message: message.trim(),
        }),
      });
      await refresh();
      router.replace("/(tabs)");
    } catch (e: any) {
      setError(e?.message || "Could not save profile");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.topBar}>
            <Text style={styles.brand}>Shiftly</Text>
            <Pressable
              testID="setup-logout-btn"
              onPress={async () => { await logout(); router.replace("/"); }}
              style={styles.logoutLink}
            >
              <Ionicons name="log-out-outline" size={16} color={COLORS.muted} />
              <Text style={styles.logoutLinkText}>Log out</Text>
            </Pressable>
          </View>
          <Text style={styles.title}>{role === "student" ? "Your student profile" : "Your shop profile"}</Text>
          <Text style={styles.sub}>This is what others will see when matching.</Text>

          {/* Photo */}
          <Pressable testID="pick-photo-btn" style={styles.photoBox} onPress={pickPhoto}>
            {photo ? (
              <Image source={{ uri: photo }} style={styles.photo} contentFit="cover" />
            ) : (
              <View style={styles.photoEmpty}>
                <Ionicons name="camera-outline" size={28} color={COLORS.brandPrimary} />
                <Text style={styles.photoText}>Add photo</Text>
              </View>
            )}
          </Pressable>

          <Field label="Name">
            <TextInput
              testID="name-input"
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor={COLORS.muted}
              style={styles.input}
            />
          </Field>

          <View style={{ flexDirection: "row", gap: SP.md }}>
            <View style={{ flex: 1 }}>
              <Field label="Age">
                <TextInput
                  testID="age-input"
                  value={age}
                  onChangeText={setAge}
                  placeholder="22"
                  placeholderTextColor={COLORS.muted}
                  keyboardType="number-pad"
                  style={styles.input}
                />
              </Field>
            </View>
            <View style={{ flex: 1.4 }}>
              <Field label="Gender">
                <ChipRow
                  options={GENDER_OPTIONS}
                  value={gender}
                  onChange={(v) => setGender(v as any)}
                  testIDPrefix="gender"
                />
              </Field>
            </View>
          </View>

          <Field label="City">
            <TextInput
              testID="city-input"
              value={city}
              onChangeText={setCity}
              placeholder="Bengaluru"
              placeholderTextColor={COLORS.muted}
              style={styles.input}
            />
          </Field>

          {role === "student" ? (
            <>
              <Field label="Qualification">
                <TextInput
                  testID="qual-input"
                  value={qualification}
                  onChangeText={setQualification}
                  placeholder="B.Com, 2nd year"
                  placeholderTextColor={COLORS.muted}
                  style={styles.input}
                />
              </Field>
              <Field label="Experience">
                <TextInput
                  testID="exp-input"
                  value={experience}
                  onChangeText={setExperience}
                  placeholder="fresher / 6 months retail"
                  placeholderTextColor={COLORS.muted}
                  style={styles.input}
                />
              </Field>
              <Field label="Skills">
                <View style={styles.chipWrap}>
                  {SKILL_OPTIONS.map((s) => {
                    const on = skills.includes(s);
                    return (
                      <Pressable
                        key={s}
                        testID={`skill-${s}`}
                        onPress={() => toggleSkill(s)}
                        style={[styles.chip, on && styles.chipOn]}
                      >
                        <Text style={[styles.chipText, on && styles.chipTextOn]}>{s}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </Field>
              <Field label="Available hours">
                <TextInput
                  testID="hours-input"
                  value={availableHours}
                  onChangeText={setAvailableHours}
                  placeholder="Evenings 5-9pm"
                  placeholderTextColor={COLORS.muted}
                  style={styles.input}
                />
              </Field>
              <Field label="Expected pay (₹ / hour)">
                <TextInput
                  testID="expected-pay-input"
                  value={expectedPay}
                  onChangeText={setExpectedPay}
                  placeholder="200"
                  placeholderTextColor={COLORS.muted}
                  keyboardType="number-pad"
                  style={styles.input}
                />
              </Field>
            </>
          ) : (
            <>
              <Field label="Shop name">
                <TextInput
                  testID="shop-name-input"
                  value={shopName}
                  onChangeText={setShopName}
                  placeholder="Sharma Provision Store"
                  placeholderTextColor={COLORS.muted}
                  style={styles.input}
                />
              </Field>
              <Field label="Help needed">
                <TextInput
                  testID="help-needed-input"
                  value={helpNeeded}
                  onChangeText={setHelpNeeded}
                  placeholder="Cashier during evening rush"
                  placeholderTextColor={COLORS.muted}
                  style={[styles.input, styles.textarea]}
                  multiline
                />
              </Field>
              <Field label="Duration">
                <ChipRow
                  options={DURATION_OPTIONS}
                  value={duration}
                  onChange={setDuration}
                  testIDPrefix="duration"
                />
              </Field>
              <Field label="No. of days">
                <TextInput
                  testID="days-input"
                  value={noOfDays}
                  onChangeText={setNoOfDays}
                  placeholder="Mon-Sat"
                  placeholderTextColor={COLORS.muted}
                  style={styles.input}
                />
              </Field>
              <Field label="Pay offered (₹)">
                <TextInput
                  testID="pay-offered-input"
                  value={payOffered}
                  onChangeText={setPayOffered}
                  placeholder="250"
                  placeholderTextColor={COLORS.muted}
                  keyboardType="number-pad"
                  style={styles.input}
                />
              </Field>
              <Field label="Required gender">
                <ChipRow
                  options={GENDER_OPTIONS}
                  value={requiredGender}
                  onChange={(v) => setRequiredGender(v as any)}
                  testIDPrefix="req-gender"
                />
              </Field>
              <Field label="Required qualification">
                <TextInput
                  testID="req-qual-input"
                  value={requiredQualification}
                  onChangeText={setRequiredQualification}
                  placeholder="10th pass / any"
                  placeholderTextColor={COLORS.muted}
                  style={styles.input}
                />
              </Field>
              <Field label="Required experience">
                <TextInput
                  testID="req-exp-input"
                  value={requiredExperience}
                  onChangeText={setRequiredExperience}
                  placeholder="none / preferred"
                  placeholderTextColor={COLORS.muted}
                  style={styles.input}
                />
              </Field>
              <Field label="Message to candidates">
                <TextInput
                  testID="message-input"
                  value={message}
                  onChangeText={setMessage}
                  placeholder="Friendly shop, will train you on the billing software."
                  placeholderTextColor={COLORS.muted}
                  style={[styles.input, styles.textarea]}
                  multiline
                />
              </Field>
            </>
          )}

          <View style={styles.bioHeader}>
            <Text style={styles.label}>Bio</Text>
            <Pressable testID="ai-bio-btn" onPress={aiSuggestBio} style={styles.aiBtn} disabled={aiLoading}>
              {aiLoading ? (
                <ActivityIndicator size="small" color={COLORS.brandPrimary} />
              ) : (
                <>
                  <Ionicons name="sparkles" size={14} color={COLORS.brandPrimary} />
                  <Text style={styles.aiBtnText}>AI suggest</Text>
                </>
              )}
            </Pressable>
          </View>
          <TextInput
            testID="bio-input"
            value={bio}
            onChangeText={setBio}
            placeholder="Tell us a bit about yourself..."
            placeholderTextColor={COLORS.muted}
            multiline
            style={[styles.input, styles.textarea]}
          />

          {error && <Text testID="setup-error" style={styles.error}>{error}</Text>}

          <Pressable
            testID="save-profile-btn"
            onPress={submit}
            disabled={loading}
            style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}
          >
            {loading ? <ActivityIndicator color={COLORS.onBrandPrimary} /> : <Text style={styles.ctaText}>Save & continue</Text>}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: SP.md }}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

function ChipRow({
  options,
  value,
  onChange,
  testIDPrefix,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
  testIDPrefix: string;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: SP.sm }}>
      {options.map((o) => {
        const on = value === o;
        return (
          <Pressable
            key={o}
            testID={`${testIDPrefix}-${o}`}
            onPress={() => onChange(o)}
            style={[styles.chip, on && styles.chipOn, { flexShrink: 0 }]}
          >
            <Text style={[styles.chipText, on && styles.chipTextOn]}>{o}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.surface },
  scroll: { padding: SP.xl, paddingBottom: SP.xxxl },
  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: SP.md },
  brand: { fontSize: 22, fontWeight: "500", color: COLORS.brandPrimary, letterSpacing: -0.5 },
  logoutLink: { flexDirection: "row", alignItems: "center", gap: 4, padding: SP.xs },
  logoutLinkText: { color: COLORS.muted, fontSize: 13, fontWeight: "500" },
  title: { fontSize: 26, fontWeight: "500", color: COLORS.onSurface },
  sub: { fontSize: 14, color: COLORS.onSurfaceSecondary, marginTop: SP.xs, marginBottom: SP.lg },
  photoBox: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignSelf: "center",
    backgroundColor: COLORS.surfaceTertiary,
    overflow: "hidden",
    marginBottom: SP.lg,
    borderWidth: 2,
    borderColor: COLORS.brandTertiary,
    borderStyle: "dashed",
  },
  photo: { width: "100%", height: "100%" },
  photoEmpty: { flex: 1, alignItems: "center", justifyContent: "center" },
  photoText: { color: COLORS.brandPrimary, marginTop: SP.xs, fontSize: 13 },
  label: { fontSize: 13, fontWeight: "500", color: COLORS.onSurfaceSecondary, marginBottom: SP.xs },
  input: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SP.md,
    paddingVertical: SP.md,
    fontSize: 15,
    color: COLORS.onSurface,
  },
  textarea: { minHeight: 90, textAlignVertical: "top" },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: SP.sm },
  chip: {
    paddingHorizontal: SP.md,
    paddingVertical: SP.sm,
    borderRadius: R.pill,
    backgroundColor: COLORS.surfaceSecondary,
    borderWidth: 1,
    borderColor: COLORS.border,
    height: 36,
    justifyContent: "center",
  },
  chipOn: { backgroundColor: COLORS.brandPrimary, borderColor: COLORS.brandPrimary },
  chipText: { color: COLORS.onSurface, fontSize: 13 },
  chipTextOn: { color: COLORS.onBrandPrimary, fontWeight: "500" },
  bioHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: SP.xs },
  aiBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: SP.sm,
    paddingVertical: 4,
    borderRadius: R.pill,
    backgroundColor: COLORS.brandTertiary,
  },
  aiBtnText: { color: COLORS.onBrandTertiary, fontSize: 12, fontWeight: "500" },
  cta: {
    backgroundColor: COLORS.brandPrimary,
    borderRadius: R.pill,
    paddingVertical: SP.lg,
    alignItems: "center",
    marginTop: SP.lg,
  },
  ctaText: { color: COLORS.onBrandPrimary, fontSize: 16, fontWeight: "500" },
  error: { color: COLORS.error, marginTop: SP.md, textAlign: "center" },
});
