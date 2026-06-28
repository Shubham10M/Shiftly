import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";

import { api, getToken, wsUrl } from "../../src/api";
import { useAuth } from "../../src/context/auth";
import { COLORS, SP, R } from "../../src/theme";

type Msg = { message_id: string; match_id: string; sender_id: string; text: string; created_at: string };

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const matchId = id as string;
  const router = useRouter();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [other, setOther] = useState<any>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const listRef = useRef<FlatList<Msg>>(null);

  const loadInitial = useCallback(async () => {
    try {
      const [matchInfo, msgs] = await Promise.all([
        api(`/matches/${matchId}`),
        api(`/chat/${matchId}/messages`),
      ]);
      setOther(matchInfo.other);
      setMessages(msgs.messages || []);
    } catch {}
    setLoading(false);
  }, [matchId]);

  useEffect(() => { loadInitial(); }, [loadInitial]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const tok = await getToken();
      if (!tok || !mounted) return;
      try {
        const ws = new WebSocket(wsUrl(matchId, tok));
        wsRef.current = ws;
        ws.onmessage = (ev) => {
          try {
            const payload = JSON.parse(ev.data);
            if (payload.type === "message" && payload.message) {
              setMessages((prev) => {
                if (prev.find((m) => m.message_id === payload.message.message_id)) return prev;
                return [...prev, payload.message];
              });
              setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
            }
          } catch {}
        };
        ws.onerror = () => {};
      } catch {}
    })();
    return () => {
      mounted = false;
      try { wsRef.current?.close(); } catch {}
    };
  }, [matchId]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setInput("");
    // Optimistic send via WS if open, else REST
    if (wsRef.current && wsRef.current.readyState === 1) {
      try {
        wsRef.current.send(JSON.stringify({ text }));
      } catch {
        await api(`/chat/${matchId}/messages`, { method: "POST", body: JSON.stringify({ text }) });
      }
    } else {
      try {
        const r = await api(`/chat/${matchId}/messages`, { method: "POST", body: JSON.stringify({ text }) });
        if (r?.message) setMessages((p) => [...p, r.message]);
      } catch {}
    }
    setSending(false);
  };

  const photo = other?.photo_base64 || other?.photo_url;

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable testID="chat-back" onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={24} color={COLORS.onSurface} />
        </Pressable>
        <Image source={{ uri: photo }} style={styles.headerAvatar} contentFit="cover" />
        <View style={{ flex: 1 }}>
          <Text style={styles.headerName} numberOfLines={1}>{other?.name || "Chat"}</Text>
          <Text style={styles.headerSub} numberOfLines={1}>
            {other?.role === "shop_owner" ? (other?.shop_name || "Shop Owner") : "Student"}
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 24}
      >
        {loading ? (
          <ActivityIndicator color={COLORS.brandPrimary} style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.message_id}
            contentContainerStyle={{ padding: SP.lg, gap: SP.sm }}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            renderItem={({ item }) => {
              const mine = item.sender_id === user?.user_id;
              return (
                <View
                  testID={`msg-${item.message_id}`}
                  style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}
                >
                  <Text style={[styles.bubbleText, mine && { color: COLORS.onBrandPrimary }]}>{item.text}</Text>
                </View>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyChat}>
                <Text style={styles.emptyChatText}>Say hi to {other?.name?.split(" ")[0] || "them"}!</Text>
              </View>
            }
          />
        )}

        <View style={styles.inputBar}>
          <TextInput
            testID="chat-input"
            value={input}
            onChangeText={setInput}
            placeholder="Type a message..."
            placeholderTextColor={COLORS.muted}
            style={styles.input}
            multiline
          />
          <Pressable testID="chat-send-btn" onPress={send} disabled={!input.trim()} style={[styles.sendBtn, !input.trim() && { opacity: 0.4 }]}>
            <Ionicons name="send" size={20} color={COLORS.onBrandPrimary} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.surface },
  header: {
    flexDirection: "row", alignItems: "center", gap: SP.md,
    paddingHorizontal: SP.lg, paddingVertical: SP.md,
    borderBottomColor: COLORS.divider, borderBottomWidth: 1,
    backgroundColor: COLORS.surfaceSecondary,
  },
  iconBtn: { padding: SP.xs },
  headerAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.surfaceTertiary },
  headerName: { fontSize: 16, fontWeight: "500", color: COLORS.onSurface },
  headerSub: { fontSize: 12, color: COLORS.muted },
  bubble: { maxWidth: "78%", paddingHorizontal: SP.md, paddingVertical: SP.sm, borderRadius: 18 },
  bubbleMine: { alignSelf: "flex-end", backgroundColor: COLORS.brandPrimary, borderBottomRightRadius: 4 },
  bubbleTheirs: { alignSelf: "flex-start", backgroundColor: COLORS.surfaceSecondary, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: COLORS.border },
  bubbleText: { color: COLORS.onSurface, fontSize: 15 },
  emptyChat: { alignItems: "center", paddingTop: SP.xxxl },
  emptyChatText: { color: COLORS.muted, fontSize: 14 },
  inputBar: {
    flexDirection: "row", alignItems: "flex-end", gap: SP.sm,
    paddingHorizontal: SP.lg, paddingTop: SP.sm, paddingBottom: SP.sm,
    borderTopColor: COLORS.divider, borderTopWidth: 1, backgroundColor: COLORS.surfaceSecondary,
  },
  input: {
    flex: 1, backgroundColor: COLORS.surfaceTertiary, borderRadius: R.lg,
    paddingHorizontal: SP.md, paddingVertical: SP.sm, maxHeight: 100, color: COLORS.onSurface, fontSize: 15,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.brandPrimary, alignItems: "center", justifyContent: "center",
  },
});
