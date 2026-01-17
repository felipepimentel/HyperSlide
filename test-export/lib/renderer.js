const fs = require('fs');
const path = require('path');
const ejs = require('ejs');
const md = require('markdown-it')({ html: true });
const fm = require('front-matter');
const container = require('markdown-it-container');

// --- obsidian callout transform ---
function transformCallouts(html) {
    // Regex for: <blockquote>\n<p>[!TYPE] Title\nContent</p>\n</blockquote>
    return html.replace(/<blockquote>\n<p>\[!(\w+)\]\s*(.*?)(?:\n([\s\S]*?))?<\/p>/g, (match, type, title, content) => {
        const typeLower = type.toLowerCase();
        const calloutTitle = title || type.toUpperCase();
        const bodyContent = content ? `<p>${content}</p>` : '';
        return `<div class="callout callout-${typeLower} p-4 my-4 rounded-lg border-l-4 border-${typeLower}-500 bg-${typeLower}-50/10">
<h3 class="font-bold mb-2 text-${typeLower}-500">${calloutTitle}</h3>${bodyContent}`;
    }).replace(/<\/blockquote>/g, '</div>');
}

const ROOT_DIR = process.cwd();

/**
 * Render a single slide using EJS and Markdown
 */
function renderSlide(content, attributes, index, rootDir) {
    const layout = attributes.layout || 'default';

    // Path resolution: Local first, then global (built-in)
    const localLayoutPath = path.join(rootDir, 'layouts', `${layout}.ejs`);
    const internalLayoutPath = path.join(__dirname, '..', 'layouts', `${layout}.ejs`);
    const fallbackLayoutPath = path.join(__dirname, '..', 'layouts', 'default.ejs');

    let templatePath;
    let templateStr;

    try {
        if (fs.existsSync(localLayoutPath)) {
            templatePath = localLayoutPath;
        } else if (fs.existsSync(internalLayoutPath)) {
            templatePath = internalLayoutPath;
        } else {
            templatePath = fallbackLayoutPath;
        }
        templateStr = fs.readFileSync(templatePath, 'utf8');
    } catch (e) {
        return `<div class="p-10 bg-red-900/20 border border-red-500 rounded text-red-500">
            <h2 class="font-bold">Layout Error</h2>
            <p>Could not find or read layout: <code>${layout}</code></p>
        </div>`;
    }

    // Parse Speaker Notes (content after ???)
    const parts = content.split(/\n\?\?\?\n/);
    const mainContent = parts[0];
    const speakerNotes = parts[1] ? md.render(parts[1]) : '';

    // Convert markdown body to HTML using markdown-it
    let bodyHtml = md.render(mainContent);
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

    try {
        const slideHtml = ejs.render(templateStr, context, {
            views: [
                path.join(rootDir, 'layouts'),
                path.join(rootDir, 'components'),
                path.join(__dirname, '..', 'layouts'),
                path.join(__dirname, '..', 'components')
            ],
            filename: templatePath
        });

        return `
        <div x-show="current === ${index}" 
             style="${context.style}"
             data-index="${index}"
             x-transition:enter="transition ease-out duration-300"
             x-transition:enter-start="opacity-0 transform translate-x-10"
             x-transition:enter-end="opacity-100 transform translate-x-0"
             x-transition:leave="transition ease-in duration-300"
             x-transition:leave-start="opacity-100 transform translate-x-0"
             x-transition:leave-end="opacity-0 transform -translate-x-10"
             class="slide-content absolute inset-0 w-full h-full ${context.class}">
             ${slideHtml}
             <template class="speaker-notes">${speakerNotes}</template>
        </div>`;
    } catch (err) {
        return `
        <div x-show="current === ${index}" class="absolute inset-0 w-full h-full flex items-center justify-center bg-red-950 p-12">
            <div class="max-w-4xl w-full bg-red-900/20 border-2 border-red-500 rounded-2xl p-8 text-red-100">
                <h2 class="text-3xl font-bold mb-4 flex items-center gap-3">
                    <span class="bg-red-500 text-red-950 px-2 py-1 rounded text-sm uppercase tracking-widest">EJS Error</span>
                    Slide ${index + 1}
                </h2>
                <pre class="bg-black/50 p-4 rounded-lg overflow-x-auto text-sm font-mono border border-red-500/30 whitespace-pre-wrap">${err.message}</pre>
                <div class="mt-6 text-sm opacity-60 italic">
                    Check your layout <strong>${path.basename(templatePath)}</strong> for syntax errors.
                </div>
            </div>
        </div>`;
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

    const rawSlides = slidesBody.split(/\n-{3,}\n/);

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
