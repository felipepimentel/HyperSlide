const express = require('express');
const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');
const open = require('open');
const renderer = require('./lib/renderer');

function startServer(options = {}) {
    const PORT = options.port || 3000;
    const ROOT_DIR = options.rootDir || process.cwd();
    const SLIDES_FILE = options.slidesFile || 'slides.md';
    const slidesPath = path.isAbsolute(SLIDES_FILE) ? SLIDES_FILE : path.join(ROOT_DIR, SLIDES_FILE);

    const app = express();

    // --- Routes ---

    // Serve static files from root (Obsidian friendly: serves images relative to slides.md)
    app.use(express.static(ROOT_DIR));

    app.get('/', (req, res) => {
        res.send(`
<!DOCTYPE html>
<html lang="en" class="h-full bg-slate-900 text-slate-100">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>HyperSlide</title>
    
    <!-- Scripts -->
    <script src="https://cdn.tailwindcss.com?plugins=typography"></script>
    <script src="https://unpkg.com/htmx.org@1.9.5"></script>
    <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.13.0/dist/cdn.min.js"></script>
    
    <!-- Code Highlight -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/atom-one-dark.min.css">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>

    <!-- Mermaid -->
    <!-- Mermaid -->
    <script type="module">
        import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs';
        mermaid.initialize({ startOnLoad: false, theme: 'dark' });
        window.mermaid = mermaid;
    </script>

    <style>
        /* Custom Table Styles */
        table { width: 100%; border-collapse: collapse; margin: 1em 0; }
        th, td { border: 1px solid #475569; padding: 0.5em; text-align: left; opacity: 1; }
        th { background-color: #1e293b; }
        
        /* Callout Styles */
        .callout { border-left-width: 4px; border-radius: 0.5rem; padding: 1rem; margin: 1rem 0; background-color: rgba(30, 41, 59, 0.5); opacity: 1; display: block; }
        .callout-info { border-color: #3b82f6; background-color: rgba(59, 130, 246, 0.1); }
        .callout-warning { border-color: #eab308; background-color: rgba(234, 179, 8, 0.1); }
        .callout-error { border-color: #ef4444; background-color: rgba(239, 68, 68, 0.1); }
        .callout-success { border-color: #22c55e; background-color: rgba(34, 197, 94, 0.1); }
    </style>

    <!-- Alpine Store -->
    <script>
        document.addEventListener('alpine:init', () => {
            Alpine.data('slideshow', () => ({
                current: 0,
                total: ${fs.readFileSync(path.join(ROOT_DIR, 'slides.md'), 'utf8').split(/\n---\n/).length}, 
                init() {
                    this.$watch('current', val => {
                        window.location.hash = val;
                    });
                    
                    const processMermaid = () => {
                        // Transform markdown code blocks to mermaid divs
                        document.querySelectorAll('pre code.language-mermaid').forEach(code => {
                            const pre = code.parentElement;
                            const div = document.createElement('div');
                            div.className = 'mermaid';
                            div.textContent = code.textContent;
                            pre.replaceWith(div);
                        });
                        
                        if (window.mermaid) {
                            window.mermaid.run({
                                nodes: document.querySelectorAll('.mermaid')
                            });
                        }
                    };

                    document.body.addEventListener('htmx:afterSwap', () => {
                       this.total = document.querySelectorAll('[x-show]').length;
                       hljs.highlightAll();
                       processMermaid();
                    });
                    
                    hljs.highlightAll();
                    setTimeout(processMermaid, 500); 
                },
                next() { if (this.current < this.total - 1) this.current++; },
                prev() { if (this.current > 0) this.current--; }
            }));
        });
        
        // Reload listener
        const source = new EventSource('/reload');
        source.onmessage = function(event) {
            document.getElementById('slide-container').dispatchEvent(new Event('slides-changed'));
        };
    </script>
</head>
<body x-data="slideshow" 
      @keydown.right.window="next()" 
      @keydown.left.window="prev()"
      class="h-full overflow-hidden antialiased selection:bg-pink-500 selection:text-white">

    <!-- Main Slide Stage -->
    <main id="slide-container" 
          class="w-full h-full relative"
          hx-get="/slides" 
          hx-trigger="load, slides-changed" 
          hx-swap="innerHTML">
          <!-- Slides will be injected here -->
          <div class="flex items-center justify-center h-full text-2xl text-slate-500 animate-pulse">
            Loading HyperSlide...
          </div>
    </main>

    <!-- Progress Bar -->
    <div class="fixed bottom-0 left-0 h-1 bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300"
         :style="'width: ' + ((current + 1) / total * 100) + '%'"></div>

    <!-- Controls Hint -->
    <div class="fixed bottom-4 right-4 text-slate-600 text-sm opacity-50 hover:opacity-100 transition-opacity">
        <span class="mr-2">← Prev</span>
        <span class="font-bold" x-text="(current + 1) + ' / ' + total"></span>
        <span class="ml-2">Next →</span>
    </div>

</body>
</html>
    `);
    });

    app.get('/slides', (req, res) => {
        const html = renderer.getAllSlides(slidesPath);
        res.send(html);
    });

    // SSE Endpoint for Hot Reload
    app.get('/reload', (req, res) => {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const sendEvent = () => {
            res.write(`data: reload\n\n`);
        };

        const watcher = chokidar.watch([
            slidesPath,
            path.join(ROOT_DIR, 'templates'),
            path.join(ROOT_DIR, 'layouts')
        ]);

        watcher.on('change', () => {
            console.log('File changed, reloading...');
            sendEvent();
        });

        req.on('close', () => {
            watcher.close();
            res.end();
        });
    });

    app.listen(PORT, async () => {
        console.log(`🚀 HyperSlide running at http://localhost:${PORT}`);
        if (options.open) {
            await open(`http://localhost:${PORT}`);
        }
    });
}

module.exports = { startServer };
