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
    app.use(express.json());

    let currentSlideIndex = 0;
    let reloadClients = [];

    // Check for local style.css
    const localStylePath = path.join(ROOT_DIR, 'style.css');
    const localStyle = fs.existsSync(localStylePath) ? `<link rel="stylesheet" href="/style.css">` : '';

    // --- Routes ---

    // Serve static files from root (Obsidian friendly: serves images relative to slides.md)
    app.use(express.static(ROOT_DIR));

    app.get('/', (req, res) => {
        const slidesContent = fs.readFileSync(slidesPath, 'utf8');
        const slideCount = slidesContent.split(/\n-{3,}\n/).length;

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

    ${localStyle}

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

        /* Glassmorphism Help Modal */
        .glass {
            background: rgba(30, 41, 59, 0.7);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.1);
        }
    </style>

    <!-- Alpine Store -->
    <script>
        document.addEventListener('alpine:init', () => {
            Alpine.data('slideshow', () => ({
                current: 0,
                total: ${slideCount},
                showHelp: false,
                init() {
                    const hash = window.location.hash.replace('#', '');
                    if (hash !== '') this.current = parseInt(hash) || 0;

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
                            window.mermaid.run({
                                nodes: document.querySelectorAll('.mermaid')
                            });
                        }
                    };

                    document.body.addEventListener('htmx:afterSwap', () => {
                       this.total = document.querySelectorAll('[data-index]').length;
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
            if (event.data === 'reload') {
                document.getElementById('slide-container').dispatchEvent(new Event('slides-changed'));
            } else if (event.data.startsWith('sync:')) {
                const newIndex = parseInt(event.data.split(':')[1]);
                const slideshow = Alpine.$data(document.body);
                if (slideshow && slideshow.current !== newIndex) {
                    slideshow.current = newIndex;
                }
            }
        };
    </script>
</head>
<body x-data="slideshow" 
      @keydown.right.window="next()" 
      @keydown.left.window="prev()"
      @keydown.?.window="showHelp = !showHelp"
      @keydown.escape.window="showHelp = false"
      class="h-full overflow-hidden antialiased selection:bg-pink-500 selection:text-white relative">

    <!-- Main Slide Stage -->
    <main id="slide-container" 
          class="w-full h-full relative overflow-hidden"
          hx-get="/slides" 
          hx-trigger="load, slides-changed" 
          hx-swap="innerHTML">
          <div class="flex items-center justify-center h-full text-2xl text-slate-500 animate-pulse">
            Loading HyperSlide...
          </div>
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
                    <span class="text-slate-300">Speaker View</span>
                    <span class="text-xs text-slate-500">add /speaker to URL</span>
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
</html>
    `);
    });

    app.get('/speaker', (req, res) => {
        res.send(`
<!DOCTYPE html>
<html lang="en" class="h-full bg-slate-900 text-slate-100">
<head>
    <meta charset="UTF-8">
    <title>HyperSlide - Speaker View</title>
    <script src="https://cdn.tailwindcss.com?plugins=typography"></script>
    <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.13.0/dist/cdn.min.js"></script>
    <style>
        .preview-frame { border: 2px solid #334155; border-radius: 8px; overflow: hidden; position: relative; background: #0f172a; }
        .notes-container { font-size: 1.25rem; line-height: 1.6; }
        .notes-container h1, .notes-container h2 { color: #3b82f6; font-weight: bold; margin-top: 1rem; }
    </style>
    <script>
        document.addEventListener('alpine:init', () => {
            Alpine.data('speakerView', () => ({
                current: 0,
                total: 0,
                notes: '',
                timer: 0,
                timerStarted: false,
                slides: [],
                
                init() {
                    this.fetchSlides();
                    
                    const source = new EventSource('/reload');
                    source.onmessage = (event) => {
                        if (event.data === 'reload') {
                            this.fetchSlides();
                        } else if (event.data.startsWith('sync:')) {
                            const newIndex = parseInt(event.data.split(':')[1]);
                            if (newIndex !== this.current) {
                                this.current = newIndex;
                                this.updateNotes();
                            }
                        }
                    };

                    setInterval(() => {
                        if (this.timerStarted) this.timer++;
                    }, 1000);
                },

                async fetchSlides() {
                    const res = await fetch('/slides');
                    const html = await res.text();
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(html, 'text/html');
                    this.slides = Array.from(doc.querySelectorAll('.slide-content')).map(el => ({
                        html: el.innerHTML,
                        notes: el.querySelector('.speaker-notes').innerHTML
                    }));
                    this.total = this.slides.length;
                    this.updateNotes();
                },

                updateNotes() {
                    if (this.slides[this.current]) {
                        this.notes = this.slides[this.current].notes || '<p class="text-slate-500">No notes for this slide.</p>';
                    }
                },

                async sync(index) {
                    this.current = index;
                    this.updateNotes();
                    await fetch('/sync', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ index })
                    });
                },

                next() { if (this.current < this.total - 1) this.sync(this.current + 1); },
                prev() { if (this.current > 0) this.sync(this.current - 1); },
                formatTime(s) {
                    const mins = Math.floor(s / 60);
                    const secs = s % 60;
                    return \`\${mins.toString().padStart(2, '0')}:\${secs.toString().padStart(2, '0')}\`;
                }
            }));
        });
    </script>
</head>
<body x-data="speakerView" 
      @keydown.right.window="next()" 
      @keydown.left.window="prev()"
      @keydown.space.window="timerStarted = !timerStarted"
      class="h-full grid grid-cols-12 gap-4 p-6 overflow-hidden">

    <!-- Left: Preview & Next -->
    <div class="col-span-4 flex flex-col gap-4">
        <div class="flex-1 flex flex-col">
            <h2 class="text-xs font-bold text-slate-500 uppercase mb-2">Current Slide</h2>
            <div class="preview-frame flex-1 relative flex items-center justify-center text-center p-4">
               <div class="transform scale-50 w-[200%] h-[200%] absolute origin-center flex items-center justify-center" x-html="slides[current]?.html"></div>
            </div>
        </div>
        <div class="flex-1 flex flex-col">
            <h2 class="text-xs font-bold text-slate-500 uppercase mb-2">Next Slide</h2>
            <div class="preview-frame flex-1 relative flex items-center justify-center text-center p-4 opacity-50">
               <div class="transform scale-50 w-[200%] h-[200%] absolute origin-center flex items-center justify-center" x-html="slides[current + 1]?.html"></div>
            </div>
        </div>
    </div>

    <!-- Right: Notes & Controls -->
    <div class="col-span-8 flex flex-col gap-4 border-l border-slate-800 pl-6">
        <div class="flex justify-between items-center bg-slate-800/50 p-4 rounded-xl">
             <div class="text-4xl font-mono text-blue-400" x-text="formatTime(timer)"></div>
             <div class="text-xl font-bold">
                Slide <span x-text="current + 1"></span> / <span x-text="total"></span>
             </div>
             <div class="flex gap-2">
                <button @click="prev()" class="px-4 py-2 bg-slate-700 rounded hover:bg-slate-600">Prev</button>
                <button @click="next()" class="px-4 py-2 bg-blue-600 rounded hover:bg-blue-500">Next</button>
             </div>
        </div>

        <div class="flex-1 overflow-y-auto bg-slate-950/50 p-8 rounded-xl border border-slate-800/50">
            <h2 class="text-xs font-bold text-slate-500 uppercase mb-4 sticky top-0 bg-slate-900 py-2">Speaker Notes</h2>
            <div class="notes-container prose prose-invert max-w-none" x-html="notes"></div>
        </div>
        
        <div class="text-xs text-slate-600 text-center">
            Space: Toggle Timer | Arrows: Navigate
        </div>
    </div>

</body>
</html>
        `);
    });

    app.post('/sync', (req, res) => {
        currentSlideIndex = req.body.index;
        reloadClients.forEach(client => {
            client.res.write(`data: sync:${currentSlideIndex}\n\n`);
        });
        res.sendStatus(200);
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

        const clientId = Date.now();
        const newClient = { id: clientId, res };
        reloadClients.push(newClient);

        const sendEvent = (data = 'reload') => {
            res.write(`data: ${data}\n\n`);
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
            reloadClients = reloadClients.filter(c => c.id !== clientId);
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
