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
            try {
                const res = await fetch('/slides');
                const html = await res.text();
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');
                this.slides = Array.from(doc.querySelectorAll('.slide-content')).map(el => ({
                    html: el.innerHTML,
                    notes: el.querySelector('.speaker-notes') ? el.querySelector('.speaker-notes').innerHTML : ''
                }));
                this.total = this.slides.length;
                this.updateNotes();
            } catch (e) {
                console.error("Failed to fetch slides", e);
            }
        },

        updateNotes() {
            if (this.slides[this.current]) {
                const noteContent = this.slides[this.current].notes;
                this.notes = noteContent && noteContent.trim() !== ''
                    ? noteContent
                    : '<p class="text-slate-500">No notes for this slide.</p>';
            }
        },

        async sync(index) {
            this.current = index;
            this.updateNotes();
            try {
                await fetch('/sync', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ index })
                });
            } catch (e) {
                console.error("Sync failed", e);
            }
        },

        next() { if (this.current < this.total - 1) this.sync(this.current + 1); },
        prev() { if (this.current > 0) this.sync(this.current - 1); },
        formatTime(s) {
            const mins = Math.floor(s / 60);
            const secs = s % 60;
            return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
    }));
});
