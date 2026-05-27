# Justime Mobile Client - CLAUDE.md

This file defines the commands, architecture, and coding standards for the Expo React Native mobile client (`mobile/justime_mobile/`).

---

## 🛠️ Build and Development Commands

Run these commands inside the `mobile/justime_mobile/` directory:

- **Start Expo Dev Server**: `npm start`
- **Start Expo with Tunnel**: `npm run start:tunnel` (highly recommended for local testing on physical devices via Expo Go)
- **Run on Android**: `npm run android`
- **Run on iOS**: `npm run ios`
- **Run Web view**: `npm run web`
- **Lint Code**: `npm run lint`
- **Format Code**: `npx prettier --write .`

---

## 🏗️ Architecture & Navigation Design

### 1. Expo Router File-Based Navigation
- All page entries are defined under the `app/` folder.
- **Layouts**: Root `app/_layout.tsx` manages provider configurations (`AuthContext`, Theme, Gesture Handler, etc.).
- **Tabs**: Bottom navigation structures are housed under the `app/(tabs)/` directory.
- **Sub-pages**: Configuration/Settings/Profile screens live inside respective folder groups (e.g., `app/settings/`).

### 2. UI Component & Native Guidelines
- **Safe Area**: Wrap top-level screens in `SafeAreaView` from `react-native-safe-area-context` to avoid layout overlapping with status bars or notches.
- **Performance Image Rendering**: Use the native-optimized `Image` component from `expo-image` for high-performance remote image caching.
- **Haptics Integration**: Add micro-interactions (e.g., button long presses, success events) using `expo-haptics`.
- **Styling**: Establish a dark-theme visual design system inside `constants/theme.ts`. Avoid hardcoding inline color hex codes; always reference theme presets.

### 3. Business Logic Separation & Hooks
- Keep the UI presentation components thin and purely visual.
- Consolidate business processing, SSE streaming integration, and message transformations into clean React Hooks:
  - **Screen Logic**: `useChatScreenLogic.ts` manages screen lifecycle, input boxes, and state transitions.
  - **SSE Client**: `useSSEChat.ts` handles active server connection state.

### 4. Resilient Network & SSE Stream Handling
- **Disconnection Recovery**: Mobile network environments change rapidly (Wi-Fi ↔ Cellular).
- **Auto-Reconnection**: Ensure `useSSEChat.ts` actively detects connection drops and automatically reconnects using the `Last-Event-ID` offset buffer.
- Keep the SSE connection matching the Web client's architecture but optimize it specifically for mobile network limits.

---

## 📝 TypeScript & Formatting Rules

- **Strict Type Checking**: Write full interfaces for navigation params, chat responses, and Auth context states. Declare types in `types/` or inline if specific.
- **Imports Order**:
  1. React and React Native core packages.
  2. Expo-specific SDK libraries (`expo-constants`, `expo-router`, etc.).
  3. External components and navigation helpers.
  4. Local hooks, business logics, context, and constant themes.
- **File Naming Rules**:
  - Components/Screens: `PascalCase.tsx`
  - Hooks: `camelCase.ts` (e.g., `useSSEChat.ts`)
  - Utilities and Constants: `camelCase.ts` or `snake_case.ts`
