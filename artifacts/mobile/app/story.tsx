import { extractChoices, useStory } from "@/context/StoryContext";
import type { Memory, MemoryKey, Message } from "@/context/StoryContext";
import { useColors } from "@/hooks/useColors";
import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type ListItem = Message | { id: "__streaming__"; role: "assistant"; content: string };

const MEMORY_TABS: { key: MemoryKey; label: string; icon: string }[] = [
  { key: "character", label: "Character", icon: "user" },
  { key: "world", label: "World", icon: "globe" },
  { key: "npcs", label: "NPCs", icon: "users" },
  { key: "events", label: "Events", icon: "clock" },
  { key: "items", label: "Items", icon: "package" },
];

function MessageBubble({
  message,
  colors,
  inlineChoices,
  onChoicePick,
  isStreamingItem,
}: {
  message: ListItem;
  colors: ReturnType<typeof useColors>;
  inlineChoices?: string[];
  onChoicePick?: (choice: string, idx: number) => void;
  isStreamingItem?: boolean;
}) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <View style={{ alignItems: "flex-end", marginVertical: 4, paddingHorizontal: 16 }}>
        <View
          style={{
            backgroundColor: colors.secondary,
            borderRadius: 16,
            borderBottomRightRadius: 4,
            paddingHorizontal: 14,
            paddingVertical: 10,
            maxWidth: "80%",
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Text
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 13,
              color: colors.mutedForeground,
              lineHeight: 19,
              fontStyle: "italic",
            }}
          >
            {message.content.length > 140
              ? message.content.slice(0, 137) + "..."
              : message.content}
          </Text>
        </View>
      </View>
    );
  }

  const text = message.content;
  const parts = text.split(/(👉\s*[A-C]\)\s*.+)/g);

  return (
    <View style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
      {parts.map((part, i) => {
        const choiceMatch = part.match(/👉\s*([A-C])\)\s*(.+)/);
        if (choiceMatch) {
          return (
            <Text
              key={i}
              style={{
                fontFamily: "Inter_600SemiBold",
                fontSize: 14,
                color: colors.primary,
                lineHeight: 24,
                marginTop: 4,
              }}
            >
              {part.trim()}
            </Text>
          );
        }
        if (!part.trim()) return null;
        return (
          <Text
            key={i}
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 15,
              color: isStreamingItem ? colors.foreground : colors.foreground,
              lineHeight: 26,
              marginBottom: 6,
            }}
          >
            {part}
            {isStreamingItem && i === parts.length - 1 ? (
              <Text style={{ color: colors.primary }}>▌</Text>
            ) : null}
          </Text>
        );
      })}

      {inlineChoices && inlineChoices.length > 0 && onChoicePick && (
        <View style={{ marginTop: 16, gap: 8 }}>
          {inlineChoices.map((choice, i) => (
            <Pressable
              key={i}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: pressed ? colors.muted : colors.secondary,
                borderRadius: 10,
                paddingVertical: 10,
                paddingHorizontal: 14,
                borderWidth: 1,
                borderColor: colors.border,
                gap: 10,
              })}
              onPress={() => onChoicePick(choice, i)}
            >
              <Text
                style={{
                  fontFamily: "Inter_700Bold",
                  fontSize: 13,
                  color: colors.primary,
                  width: 20,
                }}
              >
                {String.fromCharCode(65 + i)}
              </Text>
              <Text
                style={{
                  fontFamily: "Inter_400Regular",
                  fontSize: 13,
                  color: colors.foreground,
                  flex: 1,
                  lineHeight: 18,
                }}
              >
                {choice}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const API_BASE = `https://${process.env["EXPO_PUBLIC_DOMAIN"]}/api`;

function SourceCodeModal({
  visible,
  onClose,
  colors,
  insets,
}: {
  visible: boolean;
  onClose: () => void;
  colors: ReturnType<typeof useColors>;
  insets: { top: number; bottom: number };
}) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    setCode("");
    fetch(`${API_BASE}/source-code`)
      .then((r) => r.json())
      .then((data: { code: string }) => setCode(data.code ?? ""))
      .catch(() => setCode("// Failed to load source code."))
      .finally(() => setLoading(false));
  }, [visible]);

  const handleCopy = async () => {
    if (!code) return;
    try {
      await Clipboard.setStringAsync(code);
      setCopied(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      Alert.alert("Copy failed", "Please manually select the text to copy.");
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={{ flex: 1, backgroundColor: "#08080F" }}>
        <LinearGradient colors={["#0D0D1F", "#08080F"]} style={StyleSheet.absoluteFill} />

        <View
          style={{
            paddingTop: topPad + 8,
            paddingBottom: 12,
            paddingHorizontal: 16,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            gap: 10,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ fontFamily: "Inter_700Bold", fontSize: 17, color: colors.primary }}>
              &lt;/&gt; Source Code
            </Text>
            <Pressable
              onPress={onClose}
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                backgroundColor: colors.secondary,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Feather name="x" size={16} color={colors.foreground} />
            </Pressable>
          </View>

          <Pressable onPress={handleCopy} disabled={loading || !code}>
            <LinearGradient
              colors={loading || !code ? [colors.secondary, colors.secondary] : ["#D4A820", "#8B6914"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                borderRadius: 10,
                paddingVertical: 11,
                alignItems: "center",
                flexDirection: "row",
                justifyContent: "center",
                gap: 8,
              }}
            >
              <Feather
                name={copied ? "check" : "clipboard"}
                size={15}
                color={loading || !code ? colors.mutedForeground : colors.primaryForeground}
              />
              <Text
                style={{
                  fontFamily: "Inter_700Bold",
                  fontSize: 15,
                  color: loading || !code ? colors.mutedForeground : colors.primaryForeground,
                }}
              >
                {copied ? "Copied!" : "📋 Copy All"}
              </Text>
            </LinearGradient>
          </Pressable>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: botPad + 20 }}
          showsVerticalScrollIndicator
        >
          {loading ? (
            <Text
              style={{
                fontFamily: "Inter_400Regular",
                fontSize: 13,
                color: colors.mutedForeground,
                textAlign: "center",
                marginTop: 60,
              }}
            >
              Loading source code…
            </Text>
          ) : (
            <Text
              selectable
              style={{
                fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
                fontSize: 11,
                color: "#C8E6A0",
                lineHeight: 18,
                backgroundColor: "#0A0A18",
                padding: 14,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              {code}
            </Text>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

function InfoModal({
  visible,
  onClose,
  onNewStory,
  colors,
  insets,
  settings,
}: {
  visible: boolean;
  onClose: () => void;
  onNewStory: () => void;
  colors: ReturnType<typeof useColors>;
  insets: { top: number; bottom: number };
  settings: ReturnType<typeof useStory>["settings"];
}) {
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  const rows = settings
    ? [
        { label: "Hero", value: settings.name },
        { label: "Genre", value: settings.genre },
        { label: "World", value: settings.setting },
        { label: "Tone", value: settings.tone },
      ]
    : [];

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <Pressable
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" }}
        onPress={onClose}
      >
        <Pressable onPress={() => {}}>
          <View
            style={{
              backgroundColor: colors.card,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              paddingTop: 20,
              paddingBottom: botPad + 20,
              paddingHorizontal: 24,
              borderTopWidth: 1,
              borderColor: colors.border,
            }}
          >
            <View
              style={{
                width: 36,
                height: 4,
                backgroundColor: colors.border,
                borderRadius: 2,
                alignSelf: "center",
                marginBottom: 20,
              }}
            />
            <Text
              style={{
                fontFamily: "Inter_700Bold",
                fontSize: 18,
                color: colors.primary,
                marginBottom: 20,
                letterSpacing: 0.5,
              }}
            >
              ✦ Current Story
            </Text>

            {rows.map((row, i) => (
              <View
                key={row.label}
                style={{
                  flexDirection: "row",
                  paddingVertical: 12,
                  borderBottomWidth: i < rows.length - 1 ? 1 : 0,
                  borderBottomColor: colors.border,
                  gap: 12,
                }}
              >
                <Text
                  style={{
                    fontFamily: "Inter_600SemiBold",
                    fontSize: 13,
                    color: colors.mutedForeground,
                    width: 52,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                    paddingTop: 2,
                  }}
                >
                  {row.label}
                </Text>
                <Text
                  style={{
                    fontFamily: "Inter_400Regular",
                    fontSize: 14,
                    color: colors.foreground,
                    flex: 1,
                    lineHeight: 20,
                  }}
                  numberOfLines={3}
                >
                  {row.value}
                </Text>
              </View>
            ))}

            <Pressable
              onPress={() => {
                onClose();
                setTimeout(onNewStory, 300);
              }}
              style={({ pressed }) => ({ marginTop: 24, opacity: pressed ? 0.8 : 1 })}
            >
              <LinearGradient
                colors={["#D4A820", "#8B6914"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{
                  borderRadius: 12,
                  paddingVertical: 14,
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "row",
                  gap: 8,
                }}
              >
                <Feather name="refresh-cw" size={16} color={colors.primaryForeground} />
                <Text
                  style={{
                    fontFamily: "Inter_700Bold",
                    fontSize: 16,
                    color: colors.primaryForeground,
                  }}
                >
                  New Story
                </Text>
              </LinearGradient>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function MemoryModal({
  visible,
  onClose,
  memory,
  onSave,
  onClear,
  colors,
  insets,
}: {
  visible: boolean;
  onClose: () => void;
  memory: Memory;
  onSave: (key: MemoryKey, content: string) => Promise<void>;
  onClear: (key: MemoryKey) => Promise<void>;
  colors: ReturnType<typeof useColors>;
  insets: { top: number; bottom: number };
}) {
  const [activeTab, setActiveTab] = useState<MemoryKey>("character");
  const [edits, setEdits] = useState<Memory>({ ...memory });
  const [saving, setSaving] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  useEffect(() => {
    if (visible) setEdits({ ...memory });
  }, [visible, memory]);

  const handleSave = async () => {
    setSaving(true);
    await onSave(activeTab, edits[activeTab]);
    setSaving(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleClear = () => {
    Alert.alert(
      "Clear file?",
      `This will wipe the ${activeTab} memory file.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            await onClear(activeTab);
            setEdits((prev) => ({ ...prev, [activeTab]: "" }));
          },
        },
      ]
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <LinearGradient colors={["#0D0D1F", "#08080F"]} style={StyleSheet.absoluteFill} />

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingTop: topPad + 8,
            paddingBottom: 12,
            paddingHorizontal: 20,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <Text style={{ fontFamily: "Inter_700Bold", fontSize: 17, color: colors.primary }}>
            📚 Memory Files
          </Text>
          <Pressable
            onPress={onClose}
            style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              backgroundColor: colors.secondary,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Feather name="x" size={16} color={colors.foreground} />
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0 }}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingVertical: 12,
            gap: 8,
          }}
        >
          {MEMORY_TABS.map((tab) => (
            <Pressable
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                paddingVertical: 8,
                paddingHorizontal: 14,
                borderRadius: 20,
                backgroundColor:
                  activeTab === tab.key ? colors.primary : colors.secondary,
                borderWidth: 1,
                borderColor:
                  activeTab === tab.key ? colors.primary : colors.border,
              }}
            >
              <Feather
                name={tab.icon as never}
                size={13}
                color={activeTab === tab.key ? colors.primaryForeground : colors.mutedForeground}
              />
              <Text
                style={{
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 13,
                  color:
                    activeTab === tab.key ? colors.primaryForeground : colors.foreground,
                }}
              >
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={{ flex: 1, paddingHorizontal: 16, paddingBottom: 8 }}>
          <TextInput
            style={{
              flex: 1,
              backgroundColor: colors.input,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.border,
              padding: 14,
              fontFamily: "Inter_400Regular",
              fontSize: 13,
              color: colors.foreground,
              lineHeight: 20,
              textAlignVertical: "top",
            }}
            multiline
            value={edits[activeTab]}
            onChangeText={(text) =>
              setEdits((prev) => ({ ...prev, [activeTab]: text }))
            }
            placeholder={`No ${activeTab} data yet. The AI will fill this in automatically as the story progresses.`}
            placeholderTextColor={colors.mutedForeground}
            scrollEnabled
          />
        </View>

        <View
          style={{
            flexDirection: "row",
            gap: 10,
            paddingHorizontal: 16,
            paddingTop: 10,
            paddingBottom: botPad + 12,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}
        >
          <Pressable
            onPress={handleClear}
            style={({ pressed }) => ({
              flex: 1,
              paddingVertical: 13,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.destructive,
              alignItems: "center",
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text
              style={{
                fontFamily: "Inter_600SemiBold",
                fontSize: 15,
                color: colors.destructive,
              }}
            >
              Clear
            </Text>
          </Pressable>

          <Pressable
            onPress={handleSave}
            disabled={saving}
            style={({ pressed }) => ({
              flex: 2,
              opacity: pressed || saving ? 0.7 : 1,
            })}
          >
            <LinearGradient
              colors={["#D4A820", "#8B6914"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                borderRadius: 12,
                paddingVertical: 13,
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  fontFamily: "Inter_700Bold",
                  fontSize: 15,
                  color: colors.primaryForeground,
                }}
              >
                {saving ? "Saving…" : "Save"}
              </Text>
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export default function StoryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    settings,
    messages,
    isStreaming,
    streamingText,
    memory,
    sendMessage,
    startNewStory,
    resetToSetup,
    updateMemoryFile,
    clearMemoryFile,
  } = useStory();

  const [input, setInput] = useState("");
  const [showScript, setShowScript] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [showMemory, setShowMemory] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  const listData = useMemo<ListItem[]>(() => {
    if (isStreaming) {
      return [
        ...messages,
        {
          id: "__streaming__",
          role: "assistant" as const,
          content: streamingText || "✦  ✦  ✦",
        },
      ];
    }
    return messages;
  }, [messages, isStreaming, streamingText]);

  const lastAIId = useMemo(() => {
    if (isStreaming) return "__streaming__";
    for (let i = listData.length - 1; i >= 0; i--) {
      if (listData[i].role === "assistant") return listData[i].id;
    }
    return null;
  }, [listData, isStreaming]);

  const handleSend = async (text: string) => {
    if (!text.trim() || isStreaming) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setInput("");
    await sendMessage(text.trim());
  };

  const handleChoice = (choice: string, idx: number) => {
    const label = String.fromCharCode(65 + idx);
    handleSend(`${label}) ${choice}`);
  };

  const handleNewStory = () => {
    Alert.alert("New Story", "Start a brand-new adventure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Begin",
        style: "destructive",
        onPress: () => startNewStory(),
      },
    ]);
  };

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingTop: topPad + 8,
      paddingBottom: 12,
      paddingHorizontal: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitle: {
      fontFamily: "Inter_700Bold",
      fontSize: 17,
      color: colors.primary,
      letterSpacing: 1.5,
    },
    headerSub: {
      fontFamily: "Inter_400Regular",
      fontSize: 11,
      color: colors.mutedForeground,
      textAlign: "center",
      marginTop: 1,
    },
    iconBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: colors.secondary,
      alignItems: "center",
      justifyContent: "center",
    },
    emptyContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 32,
      paddingVertical: 60,
    },
    emptyTitle: {
      fontFamily: "Inter_700Bold",
      fontSize: 22,
      color: colors.primary,
      textAlign: "center",
      marginBottom: 12,
      letterSpacing: 0.5,
    },
    emptyText: {
      fontFamily: "Inter_400Regular",
      fontSize: 14,
      color: colors.mutedForeground,
      textAlign: "center",
      lineHeight: 22,
    },
    inputRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      paddingHorizontal: 12,
      paddingTop: 8,
      paddingBottom: botPad + 8,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      gap: 8,
    },
    memBtn: {
      width: 38,
      height: 38,
      borderRadius: 10,
      backgroundColor: colors.secondary,
      alignItems: "center",
      justifyContent: "center",
      alignSelf: "flex-end",
    },
    textInput: {
      flex: 1,
      minHeight: 38,
      maxHeight: 100,
      backgroundColor: colors.input,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 9,
      fontFamily: "Inter_400Regular",
      fontSize: 14,
      color: colors.foreground,
      borderWidth: 1,
      borderColor: colors.border,
    },
    sendBtn: {
      width: 38,
      height: 38,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      alignSelf: "flex-end",
    },
  });

  return (
    <View style={s.container}>
      <LinearGradient
        colors={["#0D0D1F", "#08080F"]}
        style={StyleSheet.absoluteFill}
      />

      <View style={s.header}>
        <Pressable
          onPress={() => setShowScript(true)}
          style={({ pressed }) => [s.iconBtn, pressed && { opacity: 0.7 }]}
        >
          <Feather name="scroll" size={16} color={colors.mutedForeground} />
        </Pressable>

        <View style={{ alignItems: "center" }}>
          <Text style={s.headerTitle}>✦ STORYTELLER ✦</Text>
          {settings && (
            <Text style={s.headerSub}>
              {settings.name} · {settings.genre}
            </Text>
          )}
        </View>

        <Pressable
          onPress={() => setShowInfo(true)}
          style={({ pressed }) => [s.iconBtn, pressed && { opacity: 0.7 }]}
        >
          <Feather name="info" size={16} color={colors.mutedForeground} />
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        <FlatList
          style={{ flex: 1 }}
          data={listData}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingTop: 16,
            paddingBottom: 16,
            flexGrow: listData.length === 0 ? 1 : 0,
          }}
          ListEmptyComponent={
            <View style={s.emptyContainer}>
              <Text style={s.emptyTitle}>Your adventure awaits</Text>
              <Text style={s.emptyText}>
                The story will begin once the AI weaves your opening scene…
              </Text>
            </View>
          }
          ItemSeparatorComponent={() => <View style={{ height: 4 }} />}
          renderItem={({ item }) => {
            const isLastAI = item.id === lastAIId;
            const isStreamItem = item.id === "__streaming__";
            const choices =
              isLastAI && !isStreaming && item.role === "assistant"
                ? extractChoices(item.content)
                : [];

            return (
              <MessageBubble
                message={item}
                colors={colors}
                inlineChoices={choices.length > 0 ? choices : undefined}
                onChoicePick={handleChoice}
                isStreamingItem={isStreamItem}
              />
            );
          }}
        />

        <View style={s.inputRow}>
          <Pressable
            style={({ pressed }) => [s.memBtn, pressed && { opacity: 0.7 }]}
            onPress={() => setShowMemory(true)}
          >
            <Text style={{ fontSize: 16 }}>📚</Text>
          </Pressable>

          <TextInput
            style={s.textInput}
            placeholder={isStreaming ? "The story unfolds…" : "What do you do?"}
            placeholderTextColor={colors.mutedForeground}
            value={input}
            onChangeText={setInput}
            multiline
            editable={!isStreaming}
            onSubmitEditing={() => handleSend(input)}
            blurOnSubmit={false}
          />

          <Pressable
            onPress={() => handleSend(input)}
            disabled={!input.trim() || isStreaming}
            style={({ pressed }) => [s.sendBtn, pressed && { opacity: 0.7 }]}
          >
            <LinearGradient
              colors={
                !input.trim() || isStreaming
                  ? [colors.secondary, colors.secondary]
                  : ["#D4A820", "#8B6914"]
              }
              style={[s.sendBtn, { width: 38 }]}
            >
              <Feather
                name="send"
                size={16}
                color={
                  !input.trim() || isStreaming
                    ? colors.border
                    : colors.primaryForeground
                }
              />
            </LinearGradient>
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <SourceCodeModal
        visible={showScript}
        onClose={() => setShowScript(false)}
        colors={colors}
        insets={insets}
      />

      <InfoModal
        visible={showInfo}
        onClose={() => setShowInfo(false)}
        onNewStory={handleNewStory}
        settings={settings}
        colors={colors}
        insets={insets}
      />

      <MemoryModal
        visible={showMemory}
        onClose={() => setShowMemory(false)}
        memory={memory}
        onSave={updateMemoryFile}
        onClear={clearMemoryFile}
        colors={colors}
        insets={insets}
      />
    </View>
  );
}
