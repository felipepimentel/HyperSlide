document.addEventListener('alpine:init', () => {
    Alpine.data('slideshow', () => ({
        current: 0,
        total: 0, // Will be updated on load
        showHelp: false,
        lastMove: Date.now(),
        isIdle: false,

        init() {
            // Initial slide from hash
            const hash = window.location.hash.replace('#', '');
            if (hash !== '') this.current = parseInt(hash) || 0;

            // Sync hash with current slide
            this.$watch('current', val => {
                window.location.hash = val;
            });

            // Mermaid processing
            const processMermaid = () => {
                document.querySelectorAll('pre code.language-mermaid').forEach(code => {
                    const pre = code.parentElement;
                    const div = document.createElement('div');
                    div.className = 'mermaid';
                    div.textContent = code.textContent;
                    pre.replaceWith(div);
                });
                if (window.mermaid) window.mermaid.run({ nodes: document.querySelectorAll('.mermaid') });
            };

            // HTMX integration
            document.body.addEventListener('htmx:afterSwap', () => {
                this.total = document.querySelectorAll('[data-index]').length;
                if (window.hljs) window.hljs.highlightAll();
                processMermaid();
            });

            // Initial highlight
            if (window.hljs) window.hljs.highlightAll();
            setTimeout(processMermaid, 200);

            // Idle detection
            setInterval(() => {
                if (Date.now() - this.lastMove > 3000) this.isIdle = true;
            }, 1000);
        },

        userActive() {
            this.lastMove = Date.now();
            this.isIdle = false;
        },

        next() { if (this.current < this.total - 1) this.current++; },
        prev() { if (this.current > 0) this.current--; }
    }));
});

// SSE for Hot Reload
const source = new EventSource('/reload');
source.onmessage = (e) => {
    if (e.data === 'reload') {
        const container = document.getElementById('slide-container');
        if (container) container.dispatchEvent(new Event('slides-changed'));
    } else if (e.data.startsWith('sync:')) {
        const slideshow = Alpine.$data(document.body);
        if (slideshow) slideshow.current = parseInt(e.data.split(':')[1]);
    }
};
