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
