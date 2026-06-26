import { useStory } from "@/context/StoryContext";
import type { StorySettings } from "@/context/StoryContext";
import { useColors } from "@/hooks/useColors";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import {
  Animated,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const NAMES = [
  "Zara", "Kane", "Lyra", "Rex", "Nova", "Ash", "Sage", "Dax",
];

const GENRES = [
  { key: "Fantasy", desc: "magic, kingdoms, dragons, and ancient prophecies", icon: "⚔️" },
  { key: "Sci-Fi", desc: "space travel, alien worlds, and advanced technology", icon: "🚀" },
  { key: "Horror", desc: "dark atmosphere, fear, and terrifying mysteries", icon: "🕯️" },
  { key: "Mystery", desc: "detective work, clues, and hidden secrets", icon: "🔍" },
  { key: "Adventure", desc: "exploration, danger, and thrilling discoveries", icon: "🗺️" },
  { key: "Romance", desc: "love, drama, and emotional journeys", icon: "💫" },
  { key: "Post-Apocalyptic", desc: "a world after civilization has collapsed", icon: "🌑" },
  { key: "Pirate", desc: "ocean adventures, treasure, and sea battles", icon: "⚓" },
  { key: "Superhero", desc: "powers, villains, and saving the world", icon: "⚡" },
];

const SETTINGS = [
  "a forgotten kingdom where magic has been outlawed",
  "a spaceship drifting alone at the edge of the galaxy",
  "a haunted Victorian mansion during a thunderstorm",
  "a cyberpunk city ruled by corrupt mega-corporations",
  "a small coastal town where people keep disappearing",
  "an ancient jungle hiding a lost civilization",
  "a post-apocalyptic wasteland where water is currency",
  "a pirate ship sailing seas filled with sea monsters",
  "a massive underground city hidden beneath modern society",
  "a floating sky kingdom above the clouds",
  "a cursed village frozen in time for 100 years",
];

const TONES = [
  { label: "Epic & Heroic", temp: 0.75 },
  { label: "Dark & Gritty", temp: 0.80 },
  { label: "Mysterious & Tense", temp: 0.85 },
  { label: "Fun & Lighthearted", temp: 0.90 },
  { label: "Wild & Unpredictable", temp: 1.00 },
];

const LENGTHS = [
  { label: "Short", sub: "Quick & punchy", tokens: 600 },
  { label: "Medium", sub: "Balanced chapters", tokens: 1024 },
  { label: "Long", sub: "Deep & immersive", tokens: 1800 },
];

const TOTAL_STEPS = 5;

export default function SetupScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { saveSettings, startNewStory } = useStory();

  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [customName, setCustomName] = useState("");
  const [showCustomName, setShowCustomName] = useState(false);
  const [genre, setGenre] = useState<(typeof GENRES)[0] | null>(null);
  const [setting, setSetting] = useState("");
  const [customSetting, setCustomSetting] = useState("");
  const [showCustomSetting, setShowCustomSetting] = useState(false);
  const [tone, setTone] = useState<(typeof TONES)[0] | null>(null);
  const [length, setLength] = useState<(typeof LENGTHS)[0] | null>(null);

  const slideAnim = useRef(new Animated.Value(0)).current;

  const animateStep = (next: number) => {
    const dir = next > step ? 1 : -1;
    slideAnim.setValue(dir * 300);
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 80,
      friction: 10,
    }).start();
    setStep(next);
  };

  const goNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (step < TOTAL_STEPS - 1) animateStep(step + 1);
  };

  const goBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (step > 0) animateStep(step - 1);
    else router.back();
  };

  const canContinue = () => {
    if (step === 0) return name.length > 0 || customName.length > 0;
    if (step === 1) return genre !== null;
    if (step === 2) return setting.length > 0 || customSetting.length > 0;
    if (step === 3) return tone !== null;
    if (step === 4) return length !== null;
    return false;
  };

  const handleFinish = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const finalSettings: StorySettings = {
      name: showCustomName ? customName : name,
      genre: genre!.key,
      genreDesc: genre!.desc,
      setting: showCustomSetting ? customSetting : setting,
      tone: tone!.label,
      temperature: tone!.temp,
      maxTokens: length!.tokens,
    };
    await saveSettings(finalSettings);
    router.replace("/story");
    setTimeout(() => startNewStory(), 300);
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    inner: {
      flex: 1,
      paddingTop: topPad + 16,
      paddingBottom: botPad + 16,
      paddingHorizontal: 24,
    },
    header: { flexDirection: "row", alignItems: "center", marginBottom: 32 },
    backBtn: {
      width: 40, height: 40, borderRadius: 20,
      backgroundColor: colors.secondary,
      alignItems: "center", justifyContent: "center",
    },
    stepDots: { flex: 1, flexDirection: "row", justifyContent: "center", gap: 6 },
    dot: { width: 6, height: 6, borderRadius: 3 },
    slide: { flex: 1 },
    title: {
      fontFamily: "Inter_700Bold", fontSize: 28,
      color: colors.primary, marginBottom: 8,
    },
    subtitle: {
      fontFamily: "Inter_400Regular", fontSize: 15,
      color: colors.mutedForeground, marginBottom: 28,
      lineHeight: 22,
    },
    chip: {
      paddingVertical: 12, paddingHorizontal: 18,
      borderRadius: 24, borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      marginRight: 10, marginBottom: 10,
    },
    chipSelected: { borderColor: colors.primary, backgroundColor: colors.accent },
    chipText: { fontFamily: "Inter_500Medium", fontSize: 15, color: colors.foreground },
    chipTextSelected: { color: colors.primary },
    customInput: {
      borderWidth: 1, borderColor: colors.border,
      borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
      backgroundColor: colors.input,
      fontFamily: "Inter_400Regular", fontSize: 15, color: colors.foreground,
      marginTop: 8,
    },
    genreCard: {
      flexDirection: "row", alignItems: "center",
      padding: 16, borderRadius: 14, borderWidth: 1,
      borderColor: colors.border, backgroundColor: colors.card,
      marginBottom: 10,
    },
    genreCardSelected: { borderColor: colors.primary, backgroundColor: colors.secondary },
    genreEmoji: { fontSize: 22, marginRight: 14 },
    genreLabel: { fontFamily: "Inter_600SemiBold", fontSize: 16, color: colors.foreground },
    genreDesc: { fontFamily: "Inter_400Regular", fontSize: 12, color: colors.mutedForeground, marginTop: 2 },
    settingItem: {
      padding: 16, borderRadius: 14, borderWidth: 1,
      borderColor: colors.border, backgroundColor: colors.card,
      marginBottom: 10,
    },
    settingItemSelected: { borderColor: colors.primary, backgroundColor: colors.secondary },
    settingText: { fontFamily: "Inter_400Regular", fontSize: 14, color: colors.foreground, lineHeight: 20 },
    toneItem: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      padding: 18, borderRadius: 14, borderWidth: 1,
      borderColor: colors.border, backgroundColor: colors.card,
      marginBottom: 10,
    },
    toneItemSelected: { borderColor: colors.primary, backgroundColor: colors.secondary },
    toneLabel: { fontFamily: "Inter_600SemiBold", fontSize: 16, color: colors.foreground },
    lengthRow: { flexDirection: "row", gap: 12, marginTop: 8 },
    lengthCard: {
      flex: 1, padding: 18, borderRadius: 14, borderWidth: 1,
      borderColor: colors.border, backgroundColor: colors.card,
      alignItems: "center",
    },
    lengthCardSelected: { borderColor: colors.primary, backgroundColor: colors.secondary },
    lengthLabel: { fontFamily: "Inter_700Bold", fontSize: 18, color: colors.foreground, marginBottom: 4 },
    lengthSub: { fontFamily: "Inter_400Regular", fontSize: 11, color: colors.mutedForeground, textAlign: "center" },
    footer: { paddingTop: 16 },
    continueBtn: {
      borderRadius: 14, paddingVertical: 16,
      alignItems: "center", justifyContent: "center",
    },
    continueBtnText: { fontFamily: "Inter_700Bold", fontSize: 17, color: colors.primaryForeground },
    disabledBtn: { opacity: 0.4 },
    goldLine: { height: 1, backgroundColor: colors.border, marginBottom: 24 },
  });

  const stepTitles = [
    "Your Hero",
    "The Genre",
    "The World",
    "The Tone",
    "Story Length",
  ];
  const stepSubtitles = [
    "Choose a name for your character",
    "What kind of story calls to you?",
    "Where does your adventure unfold?",
    "How should the story feel?",
    "How deep do you want to go?",
  ];

  return (
    <View style={s.container}>
      <LinearGradient
        colors={["#0F0F1E", "#08080F"]}
        style={StyleSheet.absoluteFill}
      />
      <View style={s.inner}>
        <View style={s.header}>
          <Pressable onPress={goBack} style={s.backBtn}>
            <Feather name="arrow-left" size={18} color={colors.foreground} />
          </Pressable>
          <View style={s.stepDots}>
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <View
                key={i}
                style={[
                  s.dot,
                  { backgroundColor: i === step ? colors.primary : colors.border },
                ]}
              />
            ))}
          </View>
          <View style={{ width: 40 }} />
        </View>

        <Animated.View style={[s.slide, { transform: [{ translateX: slideAnim }] }]}>
          <Text style={s.title}>{stepTitles[step]}</Text>
          <Text style={s.subtitle}>{stepSubtitles[step]}</Text>
          <View style={s.goldLine} />

          {step === 0 && (
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                {NAMES.map((n) => (
                  <Pressable
                    key={n}
                    style={[s.chip, name === n && !showCustomName && s.chipSelected]}
                    onPress={() => {
                      setName(n);
                      setShowCustomName(false);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                  >
                    <Text style={[s.chipText, name === n && !showCustomName && s.chipTextSelected]}>
                      {n}
                    </Text>
                  </Pressable>
                ))}
                <Pressable
                  style={[s.chip, showCustomName && s.chipSelected]}
                  onPress={() => {
                    setShowCustomName(true);
                    setName("");
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                >
                  <Text style={[s.chipText, showCustomName && s.chipTextSelected]}>
                    ✏ Custom
                  </Text>
                </Pressable>
              </View>
              {showCustomName && (
                <TextInput
                  style={s.customInput}
                  placeholder="Enter your name..."
                  placeholderTextColor={colors.mutedForeground}
                  value={customName}
                  onChangeText={setCustomName}
                  autoFocus
                  maxLength={30}
                />
              )}
            </ScrollView>
          )}

          {step === 1 && (
            <FlatList
              data={GENRES}
              keyExtractor={(i) => i.key}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <Pressable
                  style={[s.genreCard, genre?.key === item.key && s.genreCardSelected]}
                  onPress={() => {
                    setGenre(item);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                >
                  <Text style={s.genreEmoji}>{item.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={s.genreLabel}>{item.key}</Text>
                    <Text style={s.genreDesc} numberOfLines={1}>{item.desc}</Text>
                  </View>
                  {genre?.key === item.key && (
                    <Feather name="check-circle" size={20} color={colors.primary} />
                  )}
                </Pressable>
              )}
            />
          )}

          {step === 2 && (
            <FlatList
              data={[...SETTINGS, "__custom__"]}
              keyExtractor={(i) => i}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => {
                if (item === "__custom__") {
                  return (
                    <>
                      <Pressable
                        style={[s.settingItem, showCustomSetting && s.settingItemSelected]}
                        onPress={() => {
                          setShowCustomSetting(true);
                          setSetting("");
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }}
                      >
                        <Text style={[s.settingText, { color: colors.mutedForeground }]}>
                          ✏  Write my own setting...
                        </Text>
                      </Pressable>
                      {showCustomSetting && (
                        <TextInput
                          style={[s.customInput, { marginTop: 0, marginBottom: 8 }]}
                          placeholder="Describe your world..."
                          placeholderTextColor={colors.mutedForeground}
                          value={customSetting}
                          onChangeText={setCustomSetting}
                          multiline
                          autoFocus
                        />
                      )}
                    </>
                  );
                }
                return (
                  <Pressable
                    style={[s.settingItem, setting === item && !showCustomSetting && s.settingItemSelected]}
                    onPress={() => {
                      setSetting(item);
                      setShowCustomSetting(false);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                  >
                    <Text style={s.settingText}>{item}</Text>
                  </Pressable>
                );
              }}
            />
          )}

          {step === 3 && (
            <ScrollView showsVerticalScrollIndicator={false}>
              {TONES.map((t) => (
                <Pressable
                  key={t.label}
                  style={[s.toneItem, tone?.label === t.label && s.toneItemSelected]}
                  onPress={() => {
                    setTone(t);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                >
                  <Text style={s.toneLabel}>{t.label}</Text>
                  {tone?.label === t.label && (
                    <Feather name="check" size={20} color={colors.primary} />
                  )}
                </Pressable>
              ))}
            </ScrollView>
          )}

          {step === 4 && (
            <View>
              <View style={s.lengthRow}>
                {LENGTHS.map((l) => (
                  <Pressable
                    key={l.label}
                    style={[s.lengthCard, length?.label === l.label && s.lengthCardSelected]}
                    onPress={() => {
                      setLength(l);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                  >
                    <Text style={[s.lengthLabel, length?.label === l.label && { color: colors.primary }]}>
                      {l.label}
                    </Text>
                    <Text style={s.lengthSub}>{l.sub}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}
        </Animated.View>

        <View style={s.footer}>
          <Pressable
            onPress={step === TOTAL_STEPS - 1 ? handleFinish : goNext}
            disabled={!canContinue()}
            style={[s.continueBtn, !canContinue() && s.disabledBtn]}
          >
            <LinearGradient
              colors={["#D4A820", "#8B6914"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[s.continueBtn, { width: "100%" }]}
            >
              <Text style={s.continueBtnText}>
                {step === TOTAL_STEPS - 1 ? "Begin the Story" : "Continue"}
              </Text>
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
