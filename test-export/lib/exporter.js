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
        table { width: 100%; border-collapse: collapse; margin: 1em 0; }
        th, td { border: 1px solid #475569; padding: 0.5em; text-align: left; }
        th { background-color: #1e293b; }
        .callout { border-left-width: 4px; border-radius: 0.5rem; padding: 1rem; margin: 1rem 0; background-color: rgba(30, 41, 59, 0.5); }
        .callout-info { border-color: #3b82f6; background-color: rgba(59, 130, 246, 0.1); }
        .callout-warning { border-color: #eab308; background-color: rgba(234, 179, 8, 0.1); }
        .callout-error { border-color: #ef4444; background-color: rgba(239, 68, 68, 0.1); }
        .callout-success { border-color: #22c55e; background-color: rgba(34, 197, 94, 0.1); }
        
        /* Glassmorphism Help Modal */
        .glass {
            background: rgba(30, 41, 59, 0.7);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.1);
        }
    </style>

    <script>
        document.addEventListener('alpine:init', () => {
            Alpine.data('slideshow', () => ({
                current: 0,
                total: 0,
                showHelp: false,
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
                        if (window.mermaid) {
                            window.mermaid.run({ nodes: document.querySelectorAll('.mermaid') });
                        }
                    };

                    hljs.highlightAll();
                    setTimeout(processMermaid, 100);
                },
                next() { if (this.current < this.total - 1) this.current++; },
                prev() { if (this.current > 0) this.current--; }
            }));
        });
    </script>
</head>
<body x-data="slideshow" 
      @keydown.right.window="next()" 
      @keydown.left.window="prev()"
      @keydown.?.window="showHelp = !showHelp"
      @keydown.escape.window="showHelp = false"
      class="h-full overflow-hidden antialiased selection:bg-pink-500 selection:text-white relative">

    <main id="slide-container" class="w-full h-full relative overflow-hidden">
        ${slidesHtml}
    </main>

    <!-- Progress Bar (Futuristic) -->
    <div class="fixed bottom-0 left-0 w-full h-1.5 bg-slate-800/30">
        <div class="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 shadow-[0_0_10px_rgba(168,85,247,0.5)] transition-all duration-500 ease-out"
             :style="'width: ' + ((current + 1) / total * 100) + '%'"></div>
    </div>

    <!-- Controls & Help Hint -->
    <div class="fixed bottom-6 right-6 flex items-center gap-4 text-slate-400 group">
        <button @click="showHelp = true" class="w-8 h-8 rounded-full border border-slate-700 flex items-center justify-center hover:bg-slate-800 transition-colors">
            ?
        </button>
        <div class="bg-slate-800/50 px-3 py-1 rounded-full text-xs font-mono backdrop-blur-sm opacity-50 group-hover:opacity-100 transition-opacity">
            <span x-text="(current + 1)"></span> / <span x-text="total"></span>
        </div>
    </div>

    <!-- Help Modal -->
    <div x-show="showHelp" 
         x-transition:enter="transition ease-out duration-300"
         x-transition:enter-start="opacity-0 scale-95"
         x-transition:enter-end="opacity-100 scale-100"
         x-transition:leave="transition ease-in duration-200"
         x-transition:leave-start="opacity-100 scale-100"
         x-transition:leave-end="opacity-0 scale-95"
         class="fixed inset-0 z-50 flex items-center justify-center p-6"
         @click.self="showHelp = false"
         style="display: none;">
        <div class="glass w-full max-w-md p-8 rounded-3xl shadow-2xl">
            <h2 class="text-2xl font-bold mb-6 text-white flex items-center gap-2">
                <span class="text-blue-400">⌨️</span> Shortcuts
            </h2>
            <div class="space-y-4">
                <div class="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/5">
                    <span class="text-slate-300">Next Slide</span>
                    <kbd class="px-2 py-1 bg-slate-700 rounded text-xs font-mono">→</kbd>
                </div>
                <div class="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/5">
                    <span class="text-slate-300">Prev Slide</span>
                    <kbd class="px-2 py-1 bg-slate-700 rounded text-xs font-mono">←</kbd>
                </div>
                <div class="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/5">
                    <span class="text-slate-300">Close Help</span>
                    <kbd class="px-2 py-1 bg-slate-700 rounded text-xs font-mono">ESC</kbd>
                </div>
            </div>
            <button @click="showHelp = false" class="mt-8 w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-colors shadow-lg shadow-blue-900/20">
                Got it!
            </button>
        </div>
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
