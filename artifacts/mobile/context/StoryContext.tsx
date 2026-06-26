import AsyncStorage from "@react-native-async-storage/async-storage";
import { fetch } from "expo/fetch";
import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

export interface StorySettings {
  name: string;
  genre: string;
  genreDesc: string;
  setting: string;
  tone: string;
  temperature: number;
  maxTokens: number;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export type MemoryKey = "character" | "world" | "npcs" | "events" | "items";

export interface Memory {
  character: string;
  world: string;
  npcs: string;
  events: string;
  items: string;
}

const EMPTY_MEMORY: Memory = {
  character: "",
  world: "",
  npcs: "",
  events: "",
  items: "",
};

interface StoryContextType {
  settings: StorySettings | null;
  messages: Message[];
  isStreaming: boolean;
  streamingText: string;
  memory: Memory;
  saveSettings: (s: StorySettings) => Promise<void>;
  sendMessage: (userInput: string, base?: Message[]) => Promise<void>;
  startNewStory: () => Promise<void>;
  resetToSetup: () => Promise<void>;
  updateMemoryFile: (key: MemoryKey, content: string) => Promise<void>;
  clearMemoryFile: (key: MemoryKey) => Promise<void>;
}

const StoryContext = createContext<StoryContextType | null>(null);

const SETTINGS_KEY = "@storyteller/settings";
const MESSAGES_KEY = "@storyteller/messages";
const MEMORY_PREFIX = "@storyteller/memory/";
const MAX_HISTORY = 10;

function genId() {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

async function loadMemory(): Promise<Memory> {
  const keys: MemoryKey[] = ["character", "world", "npcs", "events", "items"];
  const result: Memory = { ...EMPTY_MEMORY };
  await Promise.all(
    keys.map(async (k) => {
      try {
        const v = await AsyncStorage.getItem(MEMORY_PREFIX + k);
        if (v !== null) result[k] = v;
      } catch { /* ignore */ }
    })
  );
  return result;
}

async function persistMemory(mem: Memory): Promise<void> {
  const keys: MemoryKey[] = ["character", "world", "npcs", "events", "items"];
  await Promise.all(
    keys.map((k) => AsyncStorage.setItem(MEMORY_PREFIX + k, mem[k]))
  );
}

async function clearAllMemory(): Promise<void> {
  const keys: MemoryKey[] = ["character", "world", "npcs", "events", "items"];
  await Promise.all(
    keys.map((k) => AsyncStorage.removeItem(MEMORY_PREFIX + k))
  );
}

export function StoryProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<StorySettings | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [memory, setMemory] = useState<Memory>({ ...EMPTY_MEMORY });

  const messagesRef = useRef<Message[]>([]);
  const settingsRef = useRef<StorySettings | null>(null);
  const memoryRef = useRef<Memory>({ ...EMPTY_MEMORY });

  useEffect(() => {
    (async () => {
      try {
        const s = await AsyncStorage.getItem(SETTINGS_KEY);
        if (s) {
          const parsed = JSON.parse(s) as StorySettings;
          settingsRef.current = parsed;
          setSettings(parsed);
        }
        const m = await AsyncStorage.getItem(MESSAGES_KEY);
        if (m) {
          const parsed = JSON.parse(m) as Message[];
          messagesRef.current = parsed;
          setMessages(parsed);
        }
        const mem = await loadMemory();
        memoryRef.current = mem;
        setMemory(mem);
      } catch { /* ignore */ }
    })();
  }, []);

  const saveSettings = async (s: StorySettings) => {
    settingsRef.current = s;
    setSettings(s);
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  };

  const persistMessages = async (msgs: Message[]) => {
    messagesRef.current = msgs;
    setMessages(msgs);
    await AsyncStorage.setItem(MESSAGES_KEY, JSON.stringify(msgs));
  };

  const updateMemoryFile = async (key: MemoryKey, content: string) => {
    const updated = { ...memoryRef.current, [key]: content };
    memoryRef.current = updated;
    setMemory(updated);
    await AsyncStorage.setItem(MEMORY_PREFIX + key, content);
  };

  const clearMemoryFile = async (key: MemoryKey) => {
    await updateMemoryFile(key, "");
  };

  const updateMemoryInBackground = (latestResponse: string) => {
    const currentSettings = settingsRef.current;
    if (!currentSettings) return;
    const domain = process.env["EXPO_PUBLIC_DOMAIN"];
    const url = `https://${domain}/api/story/memory-update`;

    (async () => {
      try {
        const resp = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            latestResponse,
            memory: memoryRef.current,
            genre: currentSettings.genre,
          }),
        });
        if (resp.ok) {
          const updated = (await resp.json()) as Memory;
          memoryRef.current = updated;
          setMemory(updated);
          await persistMemory(updated);
        }
      } catch { /* silent — memory update is non-critical */ }
    })();
  };

  const sendMessage = async (userInput: string, base?: Message[]) => {
    const currentSettings = settingsRef.current;
    if (!currentSettings || isStreaming) return;

    const baseMessages = base ?? messagesRef.current;
    const userMsg: Message = { id: genId(), role: "user", content: userInput };
    const allMessages = [...baseMessages, userMsg];

    messagesRef.current = allMessages;
    setMessages(allMessages);
    setIsStreaming(true);
    setStreamingText("");

    const trimmed = allMessages.slice(-MAX_HISTORY);
    const domain = process.env["EXPO_PUBLIC_DOMAIN"];
    const url = `https://${domain}/api/story/stream`;

    let accumulated = "";

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: trimmed.map((m) => ({ role: m.role, content: m.content })),
          settings: currentSettings,
          memory: memoryRef.current,
        }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (!data) continue;
          try {
            const parsed = JSON.parse(data) as { content?: string; done?: boolean; error?: string };
            if (parsed.error) throw new Error(parsed.error);
            if (parsed.done) break;
            if (parsed.content) {
              accumulated += parsed.content;
              setStreamingText(accumulated);
            }
          } catch (e) {
            const err = e as Error;
            if (err.message && err.message !== "Unexpected end of JSON input") throw err;
          }
        }
      }

      const assistantMsg: Message = { id: genId(), role: "assistant", content: accumulated };
      await persistMessages([...allMessages, assistantMsg]);
      updateMemoryInBackground(accumulated);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      const errMsg: Message = {
        id: genId(),
        role: "assistant",
        content: `The ancient tome goes silent...\n\n*${msg}*\n\nTry again.`,
      };
      await persistMessages([...allMessages, errMsg]);
    } finally {
      setIsStreaming(false);
      setStreamingText("");
    }
  };

  const startNewStory = async () => {
    const currentSettings = settingsRef.current;
    if (!currentSettings) return;

    messagesRef.current = [];
    setMessages([]);
    await AsyncStorage.removeItem(MESSAGES_KEY);

    const initialMemory: Memory = {
      character: `# ${currentSettings.name}\n- Genre context: ${currentSettings.genre} story`,
      world: `# World\n- Setting: ${currentSettings.setting}`,
      npcs: "",
      events: "",
      items: "",
    };
    memoryRef.current = initialMemory;
    setMemory(initialMemory);
    await persistMemory(initialMemory);

    const opener =
      `Begin the story. Set the scene vividly in ${currentSettings.setting}. ` +
      `Introduce ${currentSettings.name} and hint at the first mystery or conflict. ` +
      `End with a dramatic moment and present exactly 3 choices.`;

    await sendMessage(opener, []);
  };

  const resetToSetup = async () => {
    await AsyncStorage.multiRemove([SETTINGS_KEY, MESSAGES_KEY]);
    await clearAllMemory();
    messagesRef.current = [];
    settingsRef.current = null;
    memoryRef.current = { ...EMPTY_MEMORY };
    setMessages([]);
    setSettings(null);
    setMemory({ ...EMPTY_MEMORY });
  };

  return (
    <StoryContext.Provider
      value={{
        settings,
        messages,
        isStreaming,
        streamingText,
        memory,
        saveSettings,
        sendMessage,
        startNewStory,
        resetToSetup,
        updateMemoryFile,
        clearMemoryFile,
      }}
    >
      {children}
    </StoryContext.Provider>
  );
}

export function useStory() {
  const ctx = useContext(StoryContext);
  if (!ctx) throw new Error("useStory must be used within StoryProvider");
  return ctx;
}

export function extractChoices(text: string): string[] {
  const choices: string[] = [];
  const lines = text.split("\n");
  for (const line of lines) {
    const match = line.match(/👉\s*([A-C])\)\s*(.+)/);
    if (match) choices.push(match[2].trim());
  }
  return choices;
}
