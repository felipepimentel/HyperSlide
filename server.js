const express = require('express');
const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');
const open = require('open');
const renderer = require('./lib/renderer');
const ejs = require('ejs'); // Ensure ejs is required if not already used globally, though it's used in renderer.js

function startServer(options = {}) {
    const PORT = options.port || 3000;
    const ROOT_DIR = options.rootDir || process.cwd();
    const SLIDES_FILE = options.slidesFile || 'slides.md';
    const slidesPath = path.isAbsolute(SLIDES_FILE) ? SLIDES_FILE : path.join(ROOT_DIR, SLIDES_FILE);

    const app = express();
    app.use(express.json());

    let currentSlideIndex = 0;
    let reloadClients = [];
    let sseClients = [];

    // Broadcast function for SSE
    function broadcast(data) {
        const message = `data: ${JSON.stringify(data)}\n\n`;
        sseClients.forEach(client => {
            client.write(message);
        });
    }

    // Check for local style.css
    const localStylePath = path.join(ROOT_DIR, 'style.css');
    const localStyle = fs.existsSync(localStylePath) ? `<link rel="stylesheet" href="/style.css">` : '';

    // --- Routes ---

    // Serve internal client scripts
    app.use('/_internal', express.static(path.join(__dirname, 'lib/client')));

    // Serve static files from root (Obsidian friendly: serves images relative to slides.md)
    app.use(express.static(ROOT_DIR));

    app.get('/', (req, res) => {
        const slidesContent = fs.readFileSync(slidesPath, 'utf8');
        const slideCount = renderer.getAllSlides(slidesPath).split(/(?=<div x-show="current ===)/).length - 1;
        // Note: The previous split logic was rudimentary. Since getAllSlides returns HTML, we essentially just rely on rendering it.
        // However, standard server-side counting for initial state is fine.
        // Let's rely on the simple split for count or better, just use the getAllSlides length if we could inspect it, 
        // but getAllSlides returns a string.
        // For accurate count without rendering everything twice, let's just stick to the simple regex on raw markdown for now,
        // or let Alpine calculate it on client side fully (which we are doing via data-index).
        // Passing an estimated count to `total` is helpful for initial render though.
        const estimatedCount = slidesContent.split(/\n-{3,}\n/).length;

        const templatePath = path.join(__dirname, 'templates', 'index.ejs');

        ejs.renderFile(templatePath, {
            slideCount: estimatedCount, // This might be slightly off if using header-based splitting, but client-side fixes it instantly
            localStyle: localStyle,
            isDev: true,
            scriptPath: '/_internal'
        }, (err, str) => {
            if (err) {
                res.status(500).send(`Template Error: ${err.message}`);
                return;
            }
            res.send(str);
        });
    });

    app.get('/speaker', (req, res) => {
        const templatePath = path.join(__dirname, 'templates', 'speaker.ejs');
        ejs.renderFile(templatePath, {}, (err, str) => {
            if (err) {
                res.status(500).send(`Template Error: ${err.message}`);
                return;
            }
            res.send(str);
        });
    });

    app.post('/sync', (req, res) => {
        currentSlideIndex = req.body.index;
        broadcast({ type: 'sync', index: currentSlideIndex });
        res.sendStatus(200);
    });

    app.get('/slides', (req, res) => {
        const html = renderer.getAllSlides(slidesPath);
        res.send(html);
    });

    // SSE endpoint for hot-reload and sync
    app.get('/sse', (req, res) => {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();

        sseClients.push(res);

        req.on('close', () => {
            sseClients = sseClients.filter(client => client !== res);
        });
    });

    // Global File Watcher
    const watcher = chokidar.watch([
        slidesPath,
        path.join(ROOT_DIR, 'templates'),
        path.join(ROOT_DIR, 'layouts'),
        path.join(ROOT_DIR, 'style.css'),
        path.join(__dirname, 'templates'),
        path.join(__dirname, 'lib/client')
    ]);

    watcher.on('change', (filePath) => {
        console.log(`File changed: ${filePath}, reloading...`);
        if (filePath.endsWith('.css')) {
            broadcast({ type: 'style-reload' });
        } else {
            broadcast({ type: 'reload' });
        }
    });

    app.listen(PORT, async () => {
        console.log(`🚀 HyperSlide running at http://localhost:${PORT}`);
        if (options.open) {
            await open(`http://localhost:${PORT}`);
        }
    });
}

module.exports = { startServer };
