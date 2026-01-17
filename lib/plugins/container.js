const container = require('markdown-it-container');

module.exports = function (md) {
    // Generic Container Plugin: ::: classname
    md.use(container, 'generic', {
        validate: (params) => {
            return params.trim().length > 0;
        },
        render: (tokens, idx) => {
            const m = tokens[idx].info.trim().match(/^([a-zA-Z0-9_\-]+)(?:\s+(.*))?$/);
            if (tokens[idx].nesting === 1) {
                // Opening tag
                const cls = m ? m[1] : '';
                const rest = m ? m[2] || '' : '';
                return `<div class="${cls} ${rest}">\n`;
            } else {
                // Closing tag
                return '</div>\n';
            }
        }
    });
};
