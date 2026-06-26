import { readFileSync } from "fs";
import { join } from "path";
import { Router } from "express";
import { logger } from "../lib/logger";

const router = Router();
const GROQ_MODEL = "llama-3.3-70b-versatile";

interface MemoryBlock {
  character: string;
  world: string;
  npcs: string;
  events: string;
  items: string;
}

interface StorySettings {
  name: string;
  genre: string;
  genreDesc: string;
  setting: string;
  tone: string;
  temperature: number;
  maxTokens: number;
}

function buildSystemPrompt(settings: StorySettings, memory?: MemoryBlock): string {
  const hasMemory =
    memory &&
    Object.values(memory).some((v) => v && v.trim().length > 0);

  const memorySection = hasMemory
    ? `
## STORY MEMORY — Treat these as established facts. Never contradict them.

### Character: ${settings.name}
${memory!.character || "(No details yet)"}

### World & Lore
${memory!.world || "(No details yet)"}

### NPCs & Relationships
${memory!.npcs || "(No details yet)"}

### Events Log
${memory!.events || "(No details yet)"}

### Inventory & Items
${memory!.items || "(No details yet)"}

---`
    : "";

  return `You are a master storyteller crafting an immersive ${settings.genre} story.
${memorySection}
RULES:
- Genre: ${settings.genre} (${settings.genreDesc})
- The player's name is ${settings.name}. Always call them by name.
- Setting: ${settings.setting}
- Tone: ${settings.tone}
- Write in second-person ("You step forward...", "You notice...")
- Each response: vivid paragraphs with rich sensory details and atmosphere
- Include dialogue from characters the player meets
- Build tension gradually and vary the pace
- Always end with EITHER a cliffhanger OR exactly 3 choices like this:

  👉 A) [First option]
  👉 B) [Second option]
  👉 C) [Third option]

- Remember everything from earlier in the story
- Never break character or mention being an AI
- Surprise the player with unexpected twists`;
}

const WORKSPACE_ROOT = join(process.cwd(), "../..");

const SOURCE_FILES = [
  { label: "app/story.tsx", path: "artifacts/mobile/app/story.tsx" },
  { label: "app/setup.tsx", path: "artifacts/mobile/app/setup.tsx" },
  { label: "app/_layout.tsx", path: "artifacts/mobile/app/_layout.tsx" },
  { label: "context/StoryContext.tsx", path: "artifacts/mobile/context/StoryContext.tsx" },
  { label: "constants/colors.ts", path: "artifacts/mobile/constants/colors.ts" },
  { label: "hooks/useColors.ts", path: "artifacts/mobile/hooks/useColors.ts" },
  { label: "api-server/routes/story.ts", path: "artifacts/api-server/src/routes/story.ts" },
  { label: "api-server/routes/index.ts", path: "artifacts/api-server/src/routes/index.ts" },
];

router.get("/source-code", (_req, res) => {
  const separator = "=".repeat(60);
  const parts: string[] = [];

  for (const file of SOURCE_FILES) {
    try {
      const content = readFileSync(join(WORKSPACE_ROOT, file.path), "utf-8");
      parts.push(`${separator}\n// FILE: ${file.label}\n${separator}\n\n${content}`);
    } catch {
      parts.push(`${separator}\n// FILE: ${file.label}\n${separator}\n\n(could not read file)`);
    }
  }

  res.json({ code: parts.join("\n\n") });
});

router.post("/story/stream", async (req, res) => {
  const {
    messages,
    settings,
    memory,
  }: { messages: Array<{ role: string; content: string }>; settings: StorySettings; memory?: MemoryBlock } =
    req.body;

  const apiKey = process.env["GROQ_API_KEY"];
  if (!apiKey) {
    res.status(500).json({ error: "GROQ_API_KEY not configured" });
    return;
  }
  if (!messages || !settings) {
    res.status(400).json({ error: "messages and settings are required" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const apiMessages = [
    { role: "system", content: buildSystemPrompt(settings, memory) },
    ...messages,
  ];

  try {
    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages: apiMessages,
          temperature: settings.temperature,
          max_tokens: settings.maxTokens,
          top_p: 0.92,
          stream: true,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      req.log.error({ status: response.status, error: errorText }, "Groq API error");
      res.write(`data: ${JSON.stringify({ error: `API error: ${response.status}` })}\n\n`);
      res.end();
      return;
    }

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
        if (data === "[DONE]") {
          res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
          res.end();
          return;
        }
        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content ?? "";
          if (content) res.write(`data: ${JSON.stringify({ content })}\n\n`);
        } catch { /* ignore malformed chunks */ }
      }
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    logger.error({ err }, "Story stream error");
    res.write(`data: ${JSON.stringify({ error: "Stream failed" })}\n\n`);
    res.end();
  }
});

router.post("/story/memory-update", async (req, res) => {
  const {
    latestResponse,
    memory,
    genre,
  }: { latestResponse: string; memory: MemoryBlock; genre: string } = req.body;

  const apiKey = process.env["GROQ_API_KEY"];
  if (!apiKey) {
    res.status(500).json({ error: "GROQ_API_KEY not configured" });
    return;
  }
  if (!latestResponse || !memory) {
    res.status(400).json({ error: "latestResponse and memory required" });
    return;
  }

  const prompt = `You are a story archivist for a ${genre} story. A new story segment was just written.

STORY SEGMENT:
${latestResponse}

CURRENT MEMORY FILES:
--- character.md ---
${memory.character || "(empty)"}

--- world.md ---
${memory.world || "(empty)"}

--- npcs.md ---
${memory.npcs || "(empty)"}

--- events.md ---
${memory.events || "(empty)"}

--- items.md ---
${memory.items || "(empty)"}

TASK: Update each memory file with NEW information revealed in this story segment only.
Rules:
- Do NOT duplicate existing entries
- Keep entries brief, factual, bullet-point style
- events.md: always append a 1-2 sentence summary of what just happened
- Only update files that have new information
- Return ONLY a valid JSON object, no other text:

{
  "character": "full updated content",
  "world": "full updated content",
  "npcs": "full updated content",
  "events": "full updated content",
  "items": "full updated content"
}`;

  try {
    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.3,
          max_tokens: 1500,
          stream: false,
        }),
      }
    );

    if (!response.ok) {
      res.status(500).json({ error: `API error: ${response.status}` });
      return;
    }

    const data = await response.json() as { choices: Array<{ message: { content: string } }> };
    const content = data.choices[0]?.message?.content ?? "{}";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      res.json(memory);
      return;
    }
    const updated = JSON.parse(jsonMatch[0]) as MemoryBlock;
    res.json({
      character: updated.character ?? memory.character,
      world: updated.world ?? memory.world,
      npcs: updated.npcs ?? memory.npcs,
      events: updated.events ?? memory.events,
      items: updated.items ?? memory.items,
    });
  } catch (err) {
    logger.error({ err }, "Memory update error");
    res.json(memory);
  }
});

export default router;
