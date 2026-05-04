# Markdown Reader

A clean, read-only markdown viewer for macOS. Open a folder of markdown files and browse them with a collapsible file tree, syntax-highlighted code blocks, and full GitHub Flavored Markdown support.

## Why?

While most IDEs have a built-in markdown viewer, they usually default to "editor" mode or only allow you to view a single file or tile windows in a non-ideal manner. Obviously this is not ideal for being able to reference documentation easily, and after much annoyance & searching for a better solution, I decided it was better to just build what I needed.


## Features

### Markdown Rendering
- GitHub Flavored Markdown (tables, task lists, strikethrough, autolinks)
- Syntax highlighting for code blocks via Shiki with light/dark theme awareness and inline code styling
- Relative link navigation between markdown files in the same folder
- External links open in the default browser

### File Navigation
- Folder-based browsing with a collapsible sidebar file tree
- Recently opened folders with quick reopen from the welcome screen
- Open `.md` files directly from Finder (registered as a Markdown file viewer)

### Appearance
- Light, dark, and system-following theme modes
- Configurable font family (any system font) with adjustable font size (10px-32px)
- Custom CSS themes loaded from `~/Documents/Markdown-Reader-Themes/`

### Security
- Context isolation and sandbox enabled
- Read-only access scoped to user-selected folders
- Symlinks and hidden directories are excluded from the file tree

### Auto-Update
- Currently, the application automatically checks for and updates itself silently on next quit.  This will be configurable and more visible in the future, with the option to disable updates and only manually update if desired.

## Tech Stack

- **Runtime:** Electron
- **UI:** React, TypeScript
- **Markdown:** react-markdown, remark-gfm
- **Syntax Highlighting:** Shiki (via react-shiki)
- **Build:** esbuild (main/preload), Vite (renderer)
- **Packaging:** electron-builder

## Open Source Policy

This is a side-project that I'm choosing to make open source; please be understanding and patient with that in mind.

This project is open source and free to use, modify, and distribute in accordance with the MIT license.  If you would like to contribute, please open a pull request from the development branch.  For pull requests, please be descriptive, and explain what you are changing and why.  Documentation-based changes are welcome unless they are purely cosmetic or grammatical.  We reserve the right to reject, modify, or ignore any pull request for any reason (though we will do our best to be reasonable).

## Privacy Policy

This project does not currently collect any data from you, it is a local application that simply reads and displays markdown files.  While I may add some basic analytics in the future (such as application launch count or error reporting), no data will ever be shared or sold, will be entirely non-attributable (no personal information or IP addresses), and will always provide you with the option to opt-out (both at first launch and any time thereafter).  You will also have the ability to build from source with a env flag to disable analytics; and you may fork and strip out any analytics if you so choose.  Any change to this will be clearly documented both here in the README, in the CHANGELOG, and in the release notes.  I will do my best to keep this as transparent as possible.

## Issues

If you encounter any issues, please open an issue on the GitHub repository.  While I will do my best to help, I am not obligated or required to fix any issues, but will do my best to help where I can as time allows.

## AI disclosure

This project was built using AI assistance from Claude Code and OpenAI Codex.  I simply wouldn't have had the time outside of work to build this without them.

## License

MIT