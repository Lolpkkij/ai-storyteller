# AI Storyteller

An AI-powered choose-your-own-adventure mobile app built with Expo + Express + Groq (llama-3.3-70b-versatile).

## Features

- 5-step setup wizard: hero name, genre, world, tone, story length
- AI-generated story that streams in real time via Server-Sent Events
- Inline A/B/C choice buttons after each story beat
- Persistent memory system (5 AsyncStorage files: character, world, NPCs, events, items)
- Memory auto-updates in the background after every AI response
- 📚 Memory panel — view and edit all 5 memory files
- ℹ️ Info panel — current story settings + New Story button
- </> Source code viewer — shows full app source, copy all in one tap

## Stack

- **Mobile**: Expo SDK 54, expo-router v6, React Native
- **API**: Express 5, TypeScript, Node 24
- **AI**: Groq API (`llama-3.3-70b-versatile`) via SSE streaming
- **Memory**: AsyncStorage (5 persistent files per story)
- **Monorepo**: pnpm workspaces

## Setup

```bash
pnpm install
# Add GROQ_API_KEY as an environment secret
pnpm --filter @workspace/api-server run dev
pnpm --filter @workspace/mobile run dev
```
