import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";

import { api } from "../src/api";
import { useAuth } from "../src/context/auth";
import { COLORS, SP, R } from "../src/theme";

export default function AuthScreen() {
  const { setToken } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<"choice" | "phone-input" | "phone-otp">("choice");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hintCode, setHintCode] = useState<string | null>(null);

  const handleGoogle = async () => {
    setLoading(true);
    setError(null);
    try {
      const redirectUrl =
        Platform.OS === "web"
          ? (typeof window !== "undefined" ? window.location.origin + "/" : "/")
          : Linking.createURL("auth");
      const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
      if (Platform.OS === "web") {
        window.location.href = authUrl;
        return;
      }
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
      if (result.type !== "success" || !result.url) {
        setError("Sign-in cancelled");
        return;
      }
      const url = result.url;
      const sessionId = parseSessionId(url);
      if (!sessionId) {
        setError("No session id returned");
        return;
      }
      const data = await api("/auth/google/session", {
        method: "POST",
        body: JSON.stringify({ session_id: sessionId }),
      });
      await setToken(data.token, data.user);
    } catch (e: any) {
      setError(e?.message || "Google sign-in failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async () => {
    if (!phone.trim() || phone.trim().length < 6) {
      setError("Enter a valid phone number");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await api("/auth/phone/send-otp", {
        method: "POST",
        body: JSON.stringify({ phone: phone.trim() }),
      });
      setHintCode(data?.mock_code || null);
      setMode("phone-otp");
    } catch (e: any) {
      setError(e?.message || "Could not send OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp.trim()) {
      setError("Enter OTP");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await api("/auth/phone/verify-otp", {
        method: "POST",
        body: JSON.stringify({ phone: phone.trim(), code: otp.trim() }),
      });
      await setToken(data.token, data.user);
      // Gate effect will route the user to /role-select or /(tabs) as appropriate
    } catch (e: any) {
      setError(e?.message || "Invalid OTP");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.heroWrap}>
        <Image
          source={{ uri: "https://images.unsplash.com/photo-1617957718614-8c23f060c2d0?w=1200" }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
        />
        <LinearGradient
          colors={["rgba(255,251,247,0)", "rgba(255,251,247,0.7)", COLORS.surface]}
          style={StyleSheet.absoluteFill}
        />
        <SafeAreaView edges={["top"]} style={styles.heroSafe}>
          <Text style={styles.brand} testID="brand-title">ShiftPe</Text>
          <Text style={styles.tagline}>Find your perfect shift, one swipe away.</Text>
        </SafeAreaView>
      </View>

      <KeyboardAvoidingView
        style={styles.bottom}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {mode === "choice" && (
            <>
              <Text style={styles.heading}>Welcome</Text>
              <Text style={styles.sub}>Students & shop owners — match, chat, work.</Text>

              <Pressable
                testID="google-login-btn"
                onPress={handleGoogle}
                style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.8 }]}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={COLORS.onBrandPrimary} />
                ) : (
                  <Text style={styles.primaryBtnText}>Continue with Google</Text>
                )}
              </Pressable>

              <View style={styles.dividerRow}>
                <View style={styles.line} />
                <Text style={styles.lineText}>or</Text>
                <View style={styles.line} />
              </View>

              <Pressable
                testID="phone-login-btn"
                onPress={() => setMode("phone-input")}
                style={styles.secondaryBtn}
              >
                <Text style={styles.secondaryBtnText}>Continue with Phone</Text>
              </Pressable>
            </>
          )}

          {mode === "phone-input" && (
            <>
              <Text style={styles.heading}>Your phone</Text>
              <Text style={styles.sub}>We'll send a 6-digit OTP to verify.</Text>
              <TextInput
                testID="phone-input"
                value={phone}
                onChangeText={setPhone}
                placeholder="+91 99999 99999"
                placeholderTextColor={COLORS.muted}
                keyboardType="phone-pad"
                style={styles.input}
              />
              <Pressable
                testID="send-otp-btn"
                onPress={handleSendOtp}
                style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.8 }]}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={COLORS.onBrandPrimary} />
                ) : (
                  <Text style={styles.primaryBtnText}>Send OTP</Text>
                )}
              </Pressable>
              <Pressable onPress={() => setMode("choice")} style={{ alignSelf: "center", marginTop: SP.lg }}>
                <Text style={styles.link}>Back</Text>
              </Pressable>
            </>
          )}

          {mode === "phone-otp" && (
            <>
              <Text style={styles.heading}>Enter OTP</Text>
              <Text style={styles.sub}>Sent to {phone}</Text>
              {hintCode && (
                <Text style={styles.hint} testID="otp-hint">Demo OTP: {hintCode}</Text>
              )}
              <TextInput
                testID="otp-input"
                value={otp}
                onChangeText={setOtp}
                placeholder="123456"
                placeholderTextColor={COLORS.muted}
                keyboardType="number-pad"
                maxLength={6}
                style={[styles.input, { textAlign: "center", letterSpacing: 8, fontSize: 22 }]}
              />
              <Pressable
                testID="verify-otp-btn"
                onPress={handleVerifyOtp}
                style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.8 }]}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={COLORS.onBrandPrimary} />
                ) : (
                  <Text style={styles.primaryBtnText}>Verify & Continue</Text>
                )}
              </Pressable>
              <Pressable onPress={() => setMode("phone-input")} style={{ alignSelf: "center", marginTop: SP.lg }}>
                <Text style={styles.link}>Change number</Text>
              </Pressable>
            </>
          )}

          {error && (
            <Text testID="auth-error" style={styles.errorText}>{error}</Text>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function parseSessionId(url: string): string | null {
  try {
    const hashIdx = url.indexOf("#");
    if (hashIdx >= 0) {
      const hash = url.substring(hashIdx + 1);
      const params = new URLSearchParams(hash);
      const sid = params.get("session_id");
      if (sid) return sid;
    }
    const qIdx = url.indexOf("?");
    if (qIdx >= 0) {
      const params = new URLSearchParams(url.substring(qIdx + 1));
      const sid = params.get("session_id");
      if (sid) return sid;
    }
  } catch {}
  return null;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.surface },
  heroWrap: { height: "42%", backgroundColor: COLORS.brandTertiary, overflow: "hidden" },
  heroSafe: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: SP.xl },
  brand: { fontSize: 44, fontWeight: "500", color: COLORS.brandPrimary, letterSpacing: -1 },
  tagline: { marginTop: SP.sm, color: COLORS.onSurfaceSecondary, fontSize: 15, textAlign: "center" },
  bottom: { flex: 1 },
  scroll: { padding: SP.xl, paddingBottom: SP.xxxl },
  heading: { fontSize: 28, fontWeight: "500", color: COLORS.onSurface, marginBottom: SP.xs },
  sub: { fontSize: 14, color: COLORS.onSurfaceSecondary, marginBottom: SP.xl },
  primaryBtn: {
    backgroundColor: COLORS.brandPrimary,
    paddingVertical: SP.lg,
    borderRadius: R.pill,
    alignItems: "center",
    marginTop: SP.md,
  },
  primaryBtnText: { color: COLORS.onBrandPrimary, fontSize: 16, fontWeight: "500" },
  secondaryBtn: {
    backgroundColor: COLORS.surfaceSecondary,
    paddingVertical: SP.lg,
    borderRadius: R.pill,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: COLORS.borderStrong,
  },
  secondaryBtnText: { color: COLORS.onSurface, fontSize: 16, fontWeight: "500" },
  dividerRow: { flexDirection: "row", alignItems: "center", marginVertical: SP.lg },
  line: { flex: 1, height: 1, backgroundColor: COLORS.border },
  lineText: { marginHorizontal: SP.md, color: COLORS.muted },
  input: {
    backgroundColor: COLORS.surfaceTertiary,
    borderRadius: R.pill,
    paddingHorizontal: SP.xl,
    paddingVertical: SP.lg,
    fontSize: 16,
    color: COLORS.onSurface,
    marginBottom: SP.md,
  },
  link: { color: COLORS.brandPrimary, fontWeight: "500" },
  hint: { color: COLORS.brandSecondary, fontSize: 13, marginBottom: SP.sm },
  errorText: { color: COLORS.error, marginTop: SP.lg, textAlign: "center" },
});
