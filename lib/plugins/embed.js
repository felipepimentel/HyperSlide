const container = require('markdown-it-container');

module.exports = function (md) {
    // Syntax: ::: video https://... :::
    md.use(container, 'video', {
        validate: function (params) {
            return params.trim().match(/^video\s+(.*)$/);
        },
        render: function (tokens, idx) {
            var m = tokens[idx].info.trim().match(/^video\s+(.*)$/);

            if (tokens[idx].nesting === 1) {
                // opening tag
                const source = m ? m[1] : '';
                let embedHtml = '';

                if (source.includes('youtube.com') || source.includes('youtu.be')) {
                    // Extract ID
                    let videoId = source.split('v=')[1];
                    const ampersandPosition = videoId ? videoId.indexOf('&') : -1;
                    if (ampersandPosition !== -1) {
                        videoId = videoId.substring(0, ampersandPosition);
                    }
                    if (!videoId && source.includes('youtu.be')) {
                        videoId = source.split('/').pop();
                    }

                    embedHtml = `<iframe class="w-full h-full absolute inset-0" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
                } else {
                    // Generic video (mp4, etc.)
                    embedHtml = `<video controls class="w-full h-full absolute inset-0"><source src="${source}" type="video/mp4">Your browser does not support the video tag.</video>`;
                }

                return `<div class="aspect-video w-full max-w-4xl mx-auto relative rounded-xl overflow-hidden shadow-2xl border border-white/10 bg-black my-8">\n${embedHtml}`;
            } else {
                // closing tag
                return '</div>\n';
            }
        }
    });
};
