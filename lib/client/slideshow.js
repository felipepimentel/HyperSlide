```javascript
// Main Slideshow Logic
document.addEventListener('alpine:init', () => {
    
    // Slideshow Controller
    Alpine.data('slideshow', () => ({
        current: 0,
        total: 0,
        showHelp: false,
        lastMove: Date.now(),
        isIdle: false,

        init() {
            // Hash Navigation
            if (window.location.hash) {
                const hashParams = new URLSearchParams(window.location.hash.substring(1));
                if (hashParams.has('slide')) {
                    this.current = parseInt(hashParams.get('slide'));
                }
            }

            this.$watch('current', (val) => {
                window.location.hash = `slide = ${ val } `;
                if (window.mermaid) window.mermaid.init();
            });

            // Idle Timer
            setInterval(() => {
                if (Date.now() - this.lastMove > 3000) {
                    this.isIdle = true;
                }
            }, 1000);

            // Connect to Interactive Server (SSE)
            if (window.EventSource && window.location.protocol.startsWith('http')) {
                const evtSource = new EventSource('/sse');
                evtSource.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        if (data.type === 'control') {
                            if (data.action === 'next') this.next();
                            if (data.action === 'prev') this.prev();
                            if (data.action === 'goto') this.current = data.index;
                        }
                        if (data.type === 'vote') {
                             window.dispatchEvent(new CustomEvent('poll-update', { detail: data }));
                        }
                    } catch(e) {}
                };
            }

            // Mermaid processing (moved from global to init for better scope)
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

