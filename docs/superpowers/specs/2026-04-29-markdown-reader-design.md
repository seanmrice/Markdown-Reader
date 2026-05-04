# Markdown Reader — Design Spec

## Overview

A macOS Electron app for reading markdown files. The user selects a folder, and the app presents all markdown files in a navigable tree with a clean rendered view. This is strictly a reader — no editing capabilities.

**Target platform:** macOS on Apple Silicon
**Package manager:** pnpm

## App Identity

- **App name:** Markdown Reader
- **Bundle ID:** `com.untasker.markdownreader`
- **Architecture:** `arm64` (Apple Silicon)
- **Distribution:** DMG via Electron Forge
- **Signing:** macOS code signing via `osxSign` and `osxNotarize` in Forge config, with placeholders for Apple Developer Team ID and signing identity

## macOS Entitlements

Minimal sandbox profile:

- `com.apple.security.app-sandbox` — required for distribution
- `com.apple.security.files.user-selected.read-only` — read-only access to user-selected folders via native folder picker
- `com.apple.security.files.bookmarks.app-scope` — required to persist and re-access user-selected folders across app launches (security-scoped bookmarks)

No network, camera, or full disk access required.

## Tech Stack

- **Framework:** Electron Forge with Vite bundler
- **UI:** React + TypeScript
- **Markdown:** `react-markdown` + `remark-gfm` (GitHub-Flavored Markdown)
- **Syntax highlighting:** Shiki 4.0.2 + react-shiki 0.9.3 (dual-theme support for light/dark switching)
- **Persistence:** `electron-store` for user preferences and folder history
- **System fonts:** `font-list` 2.0.2 for system font enumeration

## Architecture

### Main Process (`main.ts`)

Handles native OS interactions:

- Native folder picker dialog
- Recursive directory scanning (markdown files only)
- Reading `.md` file contents
- Persisting preferences and folder history via `electron-store`
- System font enumeration

Exposes capabilities to the renderer via a preload script.

### Preload Script (`preload.ts`)

Uses `contextBridge` / `ipcRenderer` to expose a typed API on `window.api`:

- `openFolder()` — opens native folder picker, returns `string | null` (null if cancelled)
- `readDirectory(path)` — scans folder recursively, returns tree of `.md` files. Main process validates path is scoped to the currently opened folder.
- `readFile(path)` — reads a markdown file, returns raw content
- `getPreferences()` — returns persisted preferences
- `savePreferences(prefs)` — persists preferences
- `getFolderHistory()` — returns folder history list
- `addFolderToHistory(path)` — if folder already in history, moves it to position 0; otherwise prepends and trims to 10 entries. Stores a security-scoped bookmark alongside the path.
- `clearFolderHistory()` — clears history
- `getSystemFonts()` — returns list of installed system fonts
- `checkPathExists(path)` — checks if a path exists on disk, returns boolean

No `nodeIntegration` in the renderer — all Node/OS access goes through this bridge.

### Renderer Process (React)

Pure React application. No direct Node.js or file system access.

## UI Layout

Two-panel horizontal split: collapsible left sidebar, main content area on the right.

### Left Sidebar

Collapsible via a toggle button. When collapsed, reduces to a thin strip with just the toggle button; main content expands to fill full width.

Contains three sections top-to-bottom:

1. **Folder header** — displays current folder name and an "Open Folder" button/icon to switch folders
2. **File tree** — recursive tree showing only `.md` files and their containing directories. Clicking a file loads it in the viewer. Active file is visually highlighted. Hidden directories (`.git`, `node_modules`, etc.) are filtered out.
3. **Customize section** — collapsible accordion at the bottom:
   - Font family dropdown populated with system fonts
   - Font size with +/- buttons and numeric display
   - Theme toggle: System / Light / Dark

### Main Content Area

- Renders the selected markdown file as styled HTML
- Scrollable with comfortable reading margins
- All customization changes apply instantly (no save/apply button)
- When no file is selected: shows the welcome screen

## Welcome Screen & Folder History

### First Launch (no history)

Centered, minimal layout:

- App name
- Brief tagline (e.g., "A clean markdown reader")
- Single "Open Folder" button triggering the native macOS folder picker

### Subsequent Launches (history exists)

Same layout plus:

- List of recently opened folders below the button
- Each entry shows folder name and full path
- Clicking an entry opens that folder immediately
- "Clear history" option at the bottom of the list
- Most recently opened folder appears first
- Capped at 10 entries
- Folders that no longer exist on disk are silently removed from history on next launch

## State Management

### React State (in-memory)

- `currentFile` — path of the selected markdown file
- `fileContent` — raw markdown string of the current file
- `fileTree` — directory structure (md files only) of the selected folder
- `sidebarOpen` — boolean for sidebar collapse state
- `customizeOpen` — boolean for customize section collapse state

No external state management library — `useState` / `useContext` is sufficient.

### Persisted State (via `electron-store` in main process)

- `preferences` — font family, font size, theme choice (system/light/dark)
- `folderHistory` — array of `FolderHistoryEntry` objects (max 10), each containing display path/name and a security-scoped bookmark for sandbox re-access

### Shared Types (contract between main and renderer)

Defined in `src/types.ts`, used by both processes:

- `FileTreeNode` — `{ name: string, path: string, type: 'file' | 'directory', children?: FileTreeNode[] }`
- `Preferences` — `{ fontFamily: string, fontSize: number, theme: ThemeMode }`
- `ThemeMode` — `'system' | 'light' | 'dark'`
- `FolderHistoryEntry` — `{ path: string, name: string }`
- `ElectronAPI` — typed interface for all `window.api` methods

## Theme System

Three modes: **System** (default), **Light**, **Dark**.

### Implementation

- CSS custom properties on `:root` (`<html>` element)
- Theme class on `<html>`: `theme-light`, `theme-dark`, or no class (System mode defers to `prefers-color-scheme` media query)
- In System mode, the app listens for OS theme changes and switches automatically

### Variables

CSS custom properties cover:

- Background and text colors
- Sidebar background and border
- Code block background and text
- Link colors
- Scrollbar styling
- Markdown element styling (blockquote borders, table borders, hr color, etc.)

### Syntax Highlighting Themes

Light and dark variants of the syntax highlighting theme, switched in tandem with the app theme.

## Data Flow

1. **App launch** → main process loads persisted preferences and folder history → sends to renderer via IPC
2. **Folder selection** (from history or picker) → main process scans recursively for `.md` files, builds tree → sends tree to renderer
3. **File selection** → renderer requests content via IPC → main process reads file → returns raw markdown → renderer parses and displays
4. **Preference change** → renderer updates React state (instant visual update) → sends new preference to main process via IPC → main process persists
5. **Directory scanning** filters out hidden directories (dotfiles) and `node_modules`

## Markdown Rendering

- GitHub-Flavored Markdown (GFM): tables, task lists, strikethrough, fenced code blocks
- Syntax highlighting with language detection in fenced code blocks
- Light/dark syntax theme variants matching the app theme
- Only `.md` files shown in the file tree — `.markdown`, `.mdx`, and all other file types are explicitly excluded
