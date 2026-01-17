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
function renderSlide(content, attributes, index) {
    const layout = attributes.layout || 'default';
    const templatePath = path.join(ROOT_DIR, 'layouts', `${layout}.ejs`);

    let templateStr;
    try {
        templateStr = fs.existsSync(templatePath)
            ? fs.readFileSync(templatePath, 'utf8')
            : fs.readFileSync(path.join(ROOT_DIR, 'layouts', 'default.ejs'), 'utf8');
    } catch (e) {
        templateStr = '<div class="p-10"><%- content %></div>';
    }

    // Convert markdown body to HTML using markdown-it
    let bodyHtml = md.render(content);
    bodyHtml = transformCallouts(bodyHtml);

    // Context for EJS
    const context = {
        ...attributes,
        content: bodyHtml,
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
            views: [path.join(ROOT_DIR, 'layouts'), path.join(ROOT_DIR, 'components')],
            filename: templatePath
        });

        return `
        <div x-show="current === ${index}" 
             style="${context.style}"
             x-transition:enter="transition ease-out duration-300"
             x-transition:enter-start="opacity-0 transform translate-x-10"
             x-transition:enter-end="opacity-100 transform translate-x-0"
             x-transition:leave="transition ease-in duration-300"
             x-transition:leave-start="opacity-100 transform translate-x-0"
             x-transition:leave-end="opacity-0 transform -translate-x-10"
             class="absolute inset-0 w-full h-full ${context.class}">
             ${slideHtml}
        </div>`;
    } catch (err) {
        console.error('EJS Render Error:', err);
        return `<div class="p-10 text-red-500">Error rendering slide ${index}: ${err.message}</div>`;
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

        return renderSlide(content, slideAttributes, idx);
    }).join('');
}

module.exports = {
    getAllSlides
};
