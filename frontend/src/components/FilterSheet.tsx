import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  ScrollView,
  TextInput,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, SP, R } from "../theme";

export const CATEGORIES = ["Retail", "Food & Beverage", "Tutoring", "Delivery", "Cleaning", "Office", "Other"];
const GENDERS = ["any", "male", "female"];

export type FilterValues = {
  city?: string;
  minPay?: string;
  maxPay?: string;
  gender?: string;
  category?: string;
};

export default function FilterSheet({
  visible,
  initial,
  onClose,
  onApply,
}: {
  visible: boolean;
  initial: FilterValues;
  onClose: () => void;
  onApply: (v: FilterValues) => void;
}) {
  const [city, setCity] = useState(initial.city || "");
  const [minPay, setMinPay] = useState(initial.minPay || "");
  const [maxPay, setMaxPay] = useState(initial.maxPay || "");
  const [gender, setGender] = useState(initial.gender || "any");
  const [category, setCategory] = useState(initial.category || "");

  const reset = () => {
    setCity(""); setMinPay(""); setMaxPay(""); setGender("any"); setCategory("");
  };

  const apply = () => {
    onApply({
      city: city.trim() || undefined,
      minPay: minPay.trim() || undefined,
      maxPay: maxPay.trim() || undefined,
      gender: gender !== "any" ? gender : undefined,
      category: category || undefined,
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <SafeAreaView style={styles.sheet} edges={["bottom"]}>
        <View style={styles.handle} />
        <View style={styles.headerRow}>
          <Text style={styles.title}>Filters</Text>
          <Pressable testID="filter-reset" onPress={reset}>
            <Text style={styles.linkText}>Reset</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: SP.xl, gap: SP.lg }} keyboardShouldPersistTaps="handled">
          <Field label="City">
            <TextInput
              testID="filter-city"
              value={city}
              onChangeText={setCity}
              placeholder="e.g. Bengaluru"
              placeholderTextColor={COLORS.muted}
              style={styles.input}
            />
          </Field>
          <Field label="Category">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: SP.sm }}>
              <Chip label="Any" on={!category} onPress={() => setCategory("")} testID="filter-cat-any" />
              {CATEGORIES.map((c) => (
                <Chip key={c} label={c} on={category === c} onPress={() => setCategory(c)} testID={`filter-cat-${c}`} />
              ))}
            </ScrollView>
          </Field>
          <Field label="Pay range (₹)">
            <View style={{ flexDirection: "row", gap: SP.md }}>
              <TextInput
                testID="filter-min-pay"
                value={minPay}
                onChangeText={setMinPay}
                placeholder="Min"
                placeholderTextColor={COLORS.muted}
                keyboardType="number-pad"
                style={[styles.input, { flex: 1 }]}
              />
              <TextInput
                testID="filter-max-pay"
                value={maxPay}
                onChangeText={setMaxPay}
                placeholder="Max"
                placeholderTextColor={COLORS.muted}
                keyboardType="number-pad"
                style={[styles.input, { flex: 1 }]}
              />
            </View>
          </Field>
          <Field label="Gender">
            <View style={{ flexDirection: "row", gap: SP.sm }}>
              {GENDERS.map((g) => (
                <Chip key={g} label={g} on={gender === g} onPress={() => setGender(g)} testID={`filter-gen-${g}`} />
              ))}
            </View>
          </Field>
        </ScrollView>
        <View style={styles.footer}>
          <Pressable testID="filter-apply" onPress={apply} style={styles.applyBtn}>
            <Text style={styles.applyText}>Apply filters</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function Field({ label, children }: any) {
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

function Chip({ label, on, onPress, testID }: any) {
  return (
    <Pressable testID={testID} onPress={onPress} style={[styles.chip, on && styles.chipOn, { flexShrink: 0 }]}>
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: {
    position: "absolute", left: 0, right: 0, bottom: 0,
    backgroundColor: COLORS.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: "85%",
  },
  handle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.border, marginTop: SP.sm },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: SP.xl, paddingTop: SP.md },
  title: { fontSize: 22, fontWeight: "500", color: COLORS.onSurface },
  linkText: { color: COLORS.brandPrimary, fontWeight: "500" },
  label: { fontSize: 13, fontWeight: "500", color: COLORS.onSurfaceSecondary, marginBottom: SP.xs },
  input: {
    backgroundColor: COLORS.surfaceSecondary, borderRadius: R.md, borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: SP.md, paddingVertical: SP.md, fontSize: 15, color: COLORS.onSurface,
  },
  chip: {
    paddingHorizontal: SP.md, paddingVertical: SP.sm, borderRadius: R.pill,
    backgroundColor: COLORS.surfaceSecondary, borderWidth: 1, borderColor: COLORS.border, height: 36, justifyContent: "center",
  },
  chipOn: { backgroundColor: COLORS.brandPrimary, borderColor: COLORS.brandPrimary },
  chipText: { color: COLORS.onSurface, fontSize: 13, textTransform: "capitalize" },
  chipTextOn: { color: COLORS.onBrandPrimary, fontWeight: "500" },
  footer: { padding: SP.xl, borderTopColor: COLORS.divider, borderTopWidth: 1 },
  applyBtn: { backgroundColor: COLORS.brandPrimary, paddingVertical: SP.lg, borderRadius: R.pill, alignItems: "center" },
  applyText: { color: COLORS.onBrandPrimary, fontSize: 16, fontWeight: "500" },
});
