# HyperSlide - AI Agent Context

## Project Philosophy
**"Zero-Config" & "No-Build"**
- We build tools that require NO compilation step (No Webpack, No Vite, No Babel).
- Everything runs directly in Node.js or the Browser.
- Simplicity and aesthetics are paramount.

## Architecture
- **Backend**: Node.js + Express (serving static files & HTML fragments).
- **Templating**: Markdown (`markdown-it`) + Frontmatter (`front-matter`) -> HTML Templates.
- **Frontend**: 
    - **HTMX**: Handles navigation and content updates (SSE).
    - **Alpine.js**: Handles client-side state (current slide, animations).
    - **Tailwind CSS**: Script version (CDN) for styling.

## Context Protocol
- When generating code, ALWAYS prefer readability and modern standard Node.js/Browser APIs.
- Do NOT introduce build tools unless explicitly requested.
- Prescriptive Stack:
    - `markdown-it` (Parser)
    - `chokidar` (Watcher)
    - `alpinejs` (Interactivity)
    - `htmx.org` (Network/Swaps)

## File Structure Conventions
- `/templates`: Contains pure HTML fragments with `{{placeholders}}`.
- `server.js`: The monolithic entry point (keep it under 200 lines if possible, or modularize if complexity grows).
- `slides.md`: The source of truth for content.

## "Composable" Strategy
To maintain composability without a build system:
1. **Templates as Components**: Each slide type is a standalone HTML file.
2. **Alpine Stores**: Global state is managed in a centralized Alpine `x-data` or `Alpine.store`.
3. **Utility CSS**: Reuse Tailwind tokens for consistency.
