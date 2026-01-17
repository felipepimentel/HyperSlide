const fs = require('fs-extra');
const path = require('path');
const renderer = require('./renderer');
const pc = require('picocolors');

async function exportProject(slidesFile, outputDir = 'dist') {
    const ROOT_DIR = process.cwd();
    const slidesPath = path.isAbsolute(slidesFile) ? slidesFile : path.join(ROOT_DIR, slidesFile);
    const targetDir = path.isAbsolute(outputDir) ? outputDir : path.join(ROOT_DIR, outputDir);

    if (!fs.existsSync(slidesPath)) {
        console.error(pc.red(`Error: Slides file not found at ${slidesPath}`));
        return;
    }

    console.log(pc.blue(`📦 Exporting presentation to ${pc.bold(outputDir)}...`));

    try {
        await fs.ensureDir(targetDir);

        // 1. Render slides content
        const slidesHtml = renderer.getAllSlides(slidesPath);

        // 2. Build the standalone HTML
        // We extract the base shell logic from server.js and make it static
        const template = `
<!DOCTYPE html>
<html lang="en" class="h-full bg-slate-900 text-slate-100">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>HyperSlide Export</title>
    
    <!-- External Dependencies (CDN) -->
    <script src="https://cdn.tailwindcss.com?plugins=typography"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/atom-one-dark.min.css">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
    <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.13.0/dist/cdn.min.js"></script>
    
    <script type="module">
        import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs';
        mermaid.initialize({ startOnLoad: false, theme: 'dark' });
        window.mermaid = mermaid;
    </script>

    <style>
        :root {
            --hs-accent: #3b82f6;
            --hs-bg: #0f172a;
            --hs-ui-fg: #94a3b8;
            --hs-sidebar-bg: rgba(15, 23, 42, 0.8);
        }

        table { width: 100%; border-collapse: collapse; margin: 1em 0; }
        th, td { border: 1px solid #475569; padding: 0.5em; text-align: left; }
        th { background-color: rgba(30, 41, 59, 0.5); }
        
        .callout { border-left-width: 4px; border-radius: 0.5rem; padding: 1rem; margin: 1rem 0; background-color: rgba(30, 41, 59, 0.5); }
        .callout-info { border-color: #3b82f6; }
        .callout-warning { border-color: #eab308; }
        .callout-error { border-color: #ef4444; }
        .callout-success { border-color: #22c55e; }

        .sidebar {
            position: fixed;
            top: 0;
            right: 0;
            height: 100%;
            width: 300px;
            background: var(--hs-sidebar-bg);
            backdrop-filter: blur(16px);
            border-left: 1px solid rgba(255, 255, 255, 0.05);
            transform: translateX(100%);
            transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
            z-index: 100;
        }
        .sidebar.open { transform: translateX(0); }
        
        .ui-element {
            transition: opacity 0.3s ease, visibility 0.3s ease;
        }
        .ui-hidden { opacity: 0; visibility: hidden; }
    </style>

    <script>
        document.addEventListener('alpine:init', () => {
            Alpine.data('slideshow', () => ({
                current: 0,
                total: 0,
                showHelp: false,
                lastMove: Date.now(),
                isIdle: false,

                init() {
                    const slides = document.querySelectorAll('.slide-content');
                    this.total = slides.length;
                    
                    if (window.location.hash) {
                        this.current = parseInt(window.location.hash.replace('#', '')) || 0;
                    }

                    this.$watch('current', val => {
                        window.location.hash = val;
                    });

                    const processMermaid = () => {
                        document.querySelectorAll('pre code.language-mermaid').forEach(code => {
                            const pre = code.parentElement;
                            const div = document.createElement('div');
                            div.className = 'mermaid';
                            div.textContent = code.textContent;
                            pre.replaceWith(div);
                        });
                        if (window.mermaid) window.mermaid.run({ nodes: document.querySelectorAll('.mermaid') });
                    };

                    hljs.highlightAll();
                    setTimeout(processMermaid, 100);

                    setInterval(() => {
                        if (Date.now() - this.lastMove > 3000) this.isIdle = true;
                    }, 1000);
                },

                userActive() {
                    this.lastMove = Date.now();
                    this.isIdle = false;
                },

                next() { if (this.current < this.total - 1) this.current++; },
                prev() { if (this.current > 0) this.current--; }
            }));
        });
    </script>
</head>
<body x-data="slideshow" 
      @mousemove.window="userActive()"
      @keydown.window="userActive()"
      @keydown.right.window="next()" 
      @keydown.left.window="prev()"
      @keydown.?.window="showHelp = !showHelp"
      @keydown.escape.window="showHelp = false"
      class="h-full overflow-hidden antialiased bg-[var(--hs-bg)] relative">

    <main id="slide-container" class="w-full h-full relative overflow-hidden">
        ${slidesHtml}
    </main>

    <!-- Progress (Minimalist) -->
    <div class="fixed bottom-0 left-0 w-full h-0.5 bg-white/5 ui-element" :class="isIdle && 'ui-hidden'">
        <div class="h-full bg-[var(--hs-accent)] transition-all duration-500 ease-out shadow-[0_0_8px_var(--hs-accent)]"
             :style="'width: ' + ((current + 1) / total * 100) + '%'"></div>
    </div>

    <!-- Minimalist Sidebar Shortcuts -->
    <div class="sidebar" :class="showHelp && 'open'">
        <div class="p-8 h-full flex flex-col">
            <div class="flex justify-between items-center mb-10">
                <h2 class="text-xs font-bold uppercase tracking-[0.2em] text-[var(--hs-ui-fg)]">Key Bindings</h2>
                <button @click="showHelp = false" class="text-[var(--hs-ui-fg)] hover:text-white">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
            </div>
            
            <div class="space-y-6">
                <div class="flex justify-between items-end border-b border-white/5 pb-2">
                    <span class="text-sm text-white/50">Next Slide</span>
                    <kbd class="text-[var(--hs-accent)] font-mono">→</kbd>
                </div>
                <div class="flex justify-between items-end border-b border-white/5 pb-2">
                    <span class="text-sm text-white/50">Prev Slide</span>
                    <kbd class="text-[var(--hs-accent)] font-mono">←</kbd>
                </div>
                <div class="flex justify-between items-end border-b border-white/5 pb-2">
                    <span class="text-sm text-white/50">Shortcuts</span>
                    <kbd class="text-[var(--hs-accent)] font-mono">?</kbd>
                </div>
            </div>

            <div class="mt-auto text-[10px] text-center text-white/20 tracking-widest uppercase">
                HyperSlide Standalone
            </div>
        </div>
    </div>

    <!-- Hover Hint (Bottom Right) -->
    <div class="fixed bottom-4 right-4 flex items-center gap-4 ui-element" :class="isIdle && 'ui-hidden'">
        <div class="text-[var(--hs-ui-fg)] text-[10px] font-mono tracking-tighter opacity-70">
            <span x-text="(current + 1)"></span> / <span x-text="total"></span>
        </div>
        <button @click="showHelp = true" class="w-6 h-6 rounded-full border border-white/10 flex items-center justify-center text-[10px] text-[var(--hs-ui-fg)] hover:bg-white/5 transition-colors">
            ?
        </button>
    </div>
</body>
</html>`;

        await fs.writeFile(path.join(targetDir, 'index.html'), template);

        // 3. Copy assets (layouts, components, styles, and everything in current dir except node_modules etc)
        // For a simple export, we might just want to copy the user's images.
        // Let's copy everything that isn't a known hidden or system folder.
        const items = await fs.readdir(ROOT_DIR);
        for (const item of items) {
            if (item === outputDir || item === 'node_modules' || item.startsWith('.')) continue;

            const srcPath = path.join(ROOT_DIR, item);
            const stats = await fs.stat(srcPath);

            if (stats.isDirectory()) {
                await fs.copy(srcPath, path.join(targetDir, item), {
                    filter: (src) => !src.includes('node_modules') && !path.basename(src).startsWith('.')
                });
            } else if (item !== slidesFile && item !== 'package.json' && item !== 'package-lock.json') {
                await fs.copy(srcPath, path.join(targetDir, item));
            }
        }

        console.log(pc.green(`\n✨ Export complete! Your presentation is ready in ${pc.bold(outputDir)}/`));
        console.log(pc.cyan(`Open ${path.join(outputDir, 'index.html')} to view it.\n`));

    } catch (err) {
        console.error(pc.red('Failed to export project:'), err);
    }
}

module.exports = { exportProject };
