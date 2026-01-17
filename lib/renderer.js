const fs = require('fs');
const path = require('path');
const ejs = require('ejs');
const md = require('markdown-it')({ html: true });
const fm = require('front-matter');

// Plugins
const containerPlugin = require('./plugins/container');
const transformCallouts = require('./plugins/callout');
const highlightPlugin = require('./plugins/highlight');
const mermaidPlugin = require('./plugins/mermaid');
const embedPlugin = require('./plugins/embed');
const pollPlugin = require('./plugins/poll');

// Apply Plugins
highlightPlugin(md); // Sets highlight option
mermaidPlugin(md);   // Overrides fence for mermaid
embedPlugin(md);     // Video embeds
pollPlugin(md);      // Live Polls
containerPlugin(md); // Adds generic containers



const ROOT_DIR = process.cwd();

/**
 * Render a single slide using EJS and Markdown
 */
function renderSlide(content, attributes, index, rootDir) {
    let layout = attributes.layout;

    // --- Smart Layout Inference ---
    if (!layout) {
        const hasTitle = /^#\s+.+$/m.test(content);
        const hasSubTitle = /^##\s+.+$/m.test(content);
        const hasImage = /!\[.*?\]\(.*?\)/.test(content);

        // Clean up content by removing potential stray separators that might have leaked
        const cleanContent = content.trim();

        if (hasTitle && !hasSubTitle && !hasImage && cleanContent.split('\n').length < 5) {
            layout = 'hero';
        } else if (hasImage && (hasTitle || hasSubTitle)) {
            layout = 'split';
        } else {
            layout = 'default';
        }
    }

    // Path resolution
    const localLayoutPath = path.join(rootDir, 'layouts', `${layout}.ejs`);
    const internalLayoutPath = path.join(__dirname, '..', 'layouts', `${layout}.ejs`);
    const fallbackLayoutPath = path.join(__dirname, '..', 'layouts', 'default.ejs');

    let templatePath;
    let templateStr;

    try {
        templatePath = fs.existsSync(localLayoutPath) ? localLayoutPath : (fs.existsSync(internalLayoutPath) ? internalLayoutPath : fallbackLayoutPath);
        templateStr = fs.readFileSync(templatePath, 'utf8');
    } catch (e) {
        return `<div class="p-10 border border-red-500 rounded text-red-500">Layout Error: ${layout}</div>`;
    }

    // Parse Speaker Notes
    const parts = content.split(/\n\?\?\?\n/);
    const mainContent = parts[0];
    const speakerNotes = parts[1] ? md.render(parts[1]) : '';

    // Convert markdown to HTML and TRANSFORM separators (avoid rendering --- as <hr>)
    let bodyHtml = md.render(mainContent);
    bodyHtml = bodyHtml.replace(/<hr>/g, ''); // Ensure no horizontal rules leak from separators
    bodyHtml = transformCallouts(bodyHtml);

    // Context for EJS
    const context = {
        ...attributes,
        content: bodyHtml,
        notes: speakerNotes,
        index: index,
        bgStyle: attributes.bg ?
            (attributes.bg.startsWith('http') || attributes.bg.startsWith('/') || attributes.bg.startsWith('.')
                ? `background-image: url('${attributes.bg}'); background-size: cover; background-position: center;`
                : `background: ${attributes.bg};`)
            : '',
        style: attributes.style || '',
        class: attributes.class || ''
    };

    // Transition Logic
    let transitionName = attributes.transition || 'fade';
    let alpineTransition = '';

    switch (transitionName) {
        case 'zoom':
            alpineTransition = `x-transition:enter="transition ease-out duration-500" x-transition:enter-start="opacity-0 scale-90" x-transition:enter-end="opacity-100 scale-100"`;
            break;
        case 'convex':
            alpineTransition = `x-transition:enter="transition ease-out duration-700" x-transition:enter-start="opacity-0 scale-110" x-transition:enter-end="opacity-100 scale-100"`;
            break;
        case 'slide':
            alpineTransition = `x-transition:enter="transition ease-out duration-500" x-transition:enter-start="opacity-0 translate-x-full" x-transition:enter-end="opacity-100 translate-x-0"`;
            break;
        case 'fade':
        default:
            alpineTransition = `x-transition:enter="transition ease-out duration-500" x-transition:enter-start="opacity-0" x-transition:enter-end="opacity-100"`;
            break;
    }

    try {
        const slideHtml = ejs.render(templateStr, context, {
            views: [path.join(rootDir, 'layouts'), path.join(rootDir, 'components'), path.join(__dirname, '..', 'layouts'), path.join(__dirname, '..', 'components')],
            filename: templatePath
        });

        // Theme injection & UI Variable Override
        let themeTag = '';
        if (attributes.theme) {
            const themePath = attributes.theme.endsWith('.css') ? attributes.theme : `/styles/${attributes.theme}.css`;
            themeTag = `<link rel="stylesheet" href="${themePath}">`;
        }

        return `
        <div x-show="current === ${index}" 
             style="${context.style}"
             data-index="${index}"
             ${alpineTransition}
             class="slide-content absolute inset-0 w-full h-full ${context.class}">
             ${themeTag}
             ${slideHtml}
             <template class="speaker-notes">${speakerNotes}</template>
        </div>`;
    } catch (err) {
        return `<div class="p-10 text-red-500">Render Error: ${err.message}</div>`;
    }
}

/**
 * Parse and render all slides from a markdown file
 */
function getAllSlides(filePath) {
    if (!fs.existsSync(filePath)) return '<div class="p-10 bg-red-900 text-white">slides.md not found</div>';

    const rawFile = fs.readFileSync(filePath, 'utf8');

    let globalAttributes = {};
    let slidesBody = rawFile;

    if (fm.test(rawFile)) {
        const parsed = fm(rawFile);
        globalAttributes = parsed.attributes;
        slidesBody = parsed.body;
    }

    // --- Smart Splitting Logic ---
    let rawSlides = [];
    const hasExplicitSeparator = /\n-{3,}\n/.test(slidesBody);

    if (hasExplicitSeparator) {
        rawSlides = slidesBody.split(/\n-{3,}\n/);
    } else if (globalAttributes.hyperslide) {
        // Automatically split by H1 or H2
        // We look for headers and use them as split points
        const lines = slidesBody.split('\n');
        let currentSlide = [];

        lines.forEach(line => {
            if (/^#\s+/.test(line) || /^##\s+/.test(line)) {
                if (currentSlide.length > 0) {
                    rawSlides.push(currentSlide.join('\n'));
                    currentSlide = [];
                }
            }
            currentSlide.push(line);
        });

        if (currentSlide.length > 0) {
            rawSlides.push(currentSlide.join('\n'));
        }
    } else {
        // Standard single slide fallback
        rawSlides = [slidesBody];
    }

    return rawSlides.map((chunk, idx) => {
        if (!chunk.trim()) return '';

        let content = chunk;
        let slideAttributes = { ...globalAttributes };

        const commentRegex = /<!--([\s\S]*?)-->/;
        const match = chunk.match(commentRegex);

        if (match) {
            const commentContent = match[1];
            try {
                const lines = commentContent.split('\n');
                lines.forEach(line => {
                    const parts = line.split(':');
                    if (parts.length >= 2) {
                        const key = parts[0].trim();
                        const val = parts.slice(1).join(':').trim();
                        if (key && val) slideAttributes[key] = val;
                    }
                });
            } catch (e) { }
            content = content.replace(commentRegex, '').trim();
        }

        return renderSlide(content, slideAttributes, idx, path.dirname(filePath));
    }).join('');
}

module.exports = {
    getAllSlides
};
