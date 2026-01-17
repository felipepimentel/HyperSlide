module.exports = function (md) {
    // Override the default fence renderer for 'mermaid' language
    const defaultFence = md.renderer.rules.fence;

    md.renderer.rules.fence = function (tokens, idx, options, env, self) {
        const token = tokens[idx];
        const info = token.info ? md.utils.unescapeAll(token.info).trim() : '';

        if (info === 'mermaid') {
            return '<div class="mermaid">' + token.content + '</div>';
        }

        // Pass to default fence renderer (which might use the highlight function we set)
        // If defaultFence is undefined (it shouldn't be), fallback to simpler logic
        return defaultFence ? defaultFence(tokens, idx, options, env, self) : token.content;
    };
};
