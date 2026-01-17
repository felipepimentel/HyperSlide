// SSE for Hot Reload
const evtSource = new EventSource('/sse');
evtSource.onmessage = function (event) {
    try {
        const data = JSON.parse(event.data);
        if (data.type === 'reload' || data.type === 'style-reload') {
            window.location.reload();
        }
    } catch (e) {
        // Legacy string support or error
        if (event.data === 'reload') window.location.reload();
    }
}
