# HyperSlide
>
> **Zero-Config CLI for Stunning Markdown Presentations**

Turn your `slides.md` into a premium, animated slideshow instantly. No build steps, no config files—just Markdown.

## Features

- 🚀 **Zero Config**: Just run `hyperslide dev`
- 🎨 **Premium Visuals**: Glassmorphism, Inter+Fira Fonts, and Animations by default.
- 📦 **Static Export**: Ship a single HTML file with `hyperslide export`.
- 🖼️ **Layouts**: Hero, Split, Statement, Code-Focus, and more.
- 🧩 **Components**: Rich UI (Cards, Grids, Stats) directly in Markdown.
- 🌓 **Themes**: Extensible CSS-based theming (comes with Premium Dark & Neon Cyber).
- 🖱️ **Speaker View**: Dedicated console with timer, notes, and next-slide preview.

## Quick Start

```bash
# Install globally
npm install -g hyperslide

# Start presentation
hyperslide dev

# Export for web
hyperslide export
```

## Writing Slides

HyperSlide looks for `slides.md` by default. Separate slides with `---`.

```markdown
# Slide 1
Hello World

---

# Slide 2
Next slide
```

### Layouts

Use front-matter comment to set layouts per slide.

```markdown
<!-- layout: statement -->
# BIG IMPACT
```

**Available Layouts:**

- `default`: Standard centered content.
- `hero`: Large title, best for covers.
- `split`: 50/50 split (image on right).
- `statement`: Centered, gradient background, huge text.
- `code-focus`: Technical layout (Docs left, Code right).

### Components (New!)

Use `:::` to create rich components.

**Cards & Grid**

```markdown
::: grid-layout

::: card
### Feature 1
Glassmorphic card.
:::

::: card
### Feature 2
Another card.
:::

:::
```

**Stats**

```markdown
::: columns

::: stat-box
**100%**
<span>Coverage</span>
:::

::: stat-box
**0**
<span>Config</span>
:::

:::
```

### Themes

Set a theme globally or per slide.

```markdown
<!-- theme: neon-cyber -->
```

HyperSlide looks for `.css` files in your `styles/` folder.

## CLI Reference

| Command | Description |
| :--- | :--- |
| `hyperslide dev` | Start dev server with Hot Reload (Port 3000) |
| `hyperslide export` | Generate static site in `dist/` |
| `hyperslide init` | Create a new project scaffold |

## Shortcuts

- `Space`: Toggle Timer (Speaker View)
- `?`: Toggle Help Sidebar
- `p`: Print Mode (Browser)
