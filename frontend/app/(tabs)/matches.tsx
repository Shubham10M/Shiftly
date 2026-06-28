import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useFocusEffect } from "expo-router";

import { api } from "../../src/api";
import { COLORS, SP, R } from "../../src/theme";

type MatchRow = {
  match_id: string;
  other: {
    user_id: string;
    name: string;
    photo_base64?: string | null;
    photo_url?: string | null;
    role: string;
    shop_name?: string;
  };
  last_message: { text: string; created_at: string; sender_id: string } | null;
  created_at: string;
};

export default function MatchesScreen() {
  const router = useRouter();
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api("/matches");
      setMatches(data.matches || []);
    } catch {}
    finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const newMatches = matches.filter((m) => !m.last_message);
  const chats = matches.filter((m) => m.last_message);

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Matches</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={COLORS.brandPrimary} style={{ marginTop: 40 }} />
      ) : matches.length === 0 ? (
        <View style={styles.empty} testID="matches-empty">
          <Ionicons name="heart-outline" size={64} color={COLORS.brandPrimary} />
          <Text style={styles.emptyTitle}>No matches yet</Text>
          <Text style={styles.emptyText}>Start swiping to find your perfect shift partner.</Text>
        </View>
      ) : (
        <FlatList
          data={chats}
          keyExtractor={(m) => m.match_id}
          ListHeaderComponent={
            newMatches.length > 0 ? (
              <View style={styles.newSection}>
                <Text style={styles.sectionTitle}>New matches</Text>
                <FlatList
                  data={newMatches}
                  keyExtractor={(m) => m.match_id}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: SP.md, paddingHorizontal: SP.xl }}
                  renderItem={({ item }) => (
                    <Pressable
                      testID={`new-match-${item.match_id}`}
                      onPress={() => router.push(`/chat/${item.match_id}`)}
                      style={styles.newCard}
                    >
                      <Image
                        source={{ uri: item.other?.photo_base64 || item.other?.photo_url }}
                        style={styles.newAvatar}
                        contentFit="cover"
                      />
                      <Text style={styles.newName} numberOfLines={1}>{item.other?.name}</Text>
                    </Pressable>
                  )}
                />
                <View style={styles.divider} />
              </View>
            ) : null
          }
          ListEmptyComponent={
            newMatches.length > 0 ? (
              <Text style={styles.subEmpty}>Say hi to start a conversation!</Text>
            ) : null
          }
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={COLORS.brandPrimary} />}
          renderItem={({ item }) => (
            <Pressable
              testID={`chat-row-${item.match_id}`}
              onPress={() => router.push(`/chat/${item.match_id}`)}
              style={({ pressed }) => [styles.row, pressed && { backgroundColor: COLORS.surfaceTertiary }]}
            >
              <Image
                source={{ uri: item.other?.photo_base64 || item.other?.photo_url }}
                style={styles.avatar}
                contentFit="cover"
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.rowName} numberOfLines={1}>{item.other?.name}</Text>
                <Text style={styles.rowMsg} numberOfLines={1}>{item.last_message?.text}</Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.surface },
  header: { paddingHorizontal: SP.xl, paddingTop: SP.sm, paddingBottom: SP.md },
  title: { fontSize: 28, fontWeight: "500", color: COLORS.onSurface, letterSpacing: -0.5 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: SP.xl, gap: SP.sm },
  emptyTitle: { fontSize: 20, fontWeight: "500", color: COLORS.onSurface, marginTop: SP.md },
  emptyText: { fontSize: 14, color: COLORS.onSurfaceSecondary, textAlign: "center" },
  subEmpty: { textAlign: "center", padding: SP.xl, color: COLORS.muted },
  newSection: { marginBottom: SP.md },
  sectionTitle: { paddingHorizontal: SP.xl, fontSize: 14, fontWeight: "500", color: COLORS.muted, marginBottom: SP.sm },
  newCard: { alignItems: "center", width: 72 },
  newAvatar: { width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: COLORS.brandPrimary, backgroundColor: COLORS.surfaceTertiary },
  newName: { fontSize: 12, color: COLORS.onSurface, marginTop: SP.xs, textAlign: "center" },
  divider: { height: 1, backgroundColor: COLORS.divider, marginHorizontal: SP.xl, marginTop: SP.md },
  row: { flexDirection: "row", alignItems: "center", gap: SP.md, paddingHorizontal: SP.xl, paddingVertical: SP.md, minHeight: 72 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.surfaceTertiary },
  rowName: { fontSize: 16, fontWeight: "500", color: COLORS.onSurface },
  rowMsg: { fontSize: 13, color: COLORS.onSurfaceSecondary, marginTop: 2 },
});
