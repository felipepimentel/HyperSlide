const { startServer } = require('./server');

try {
    console.log('Starting server...');
    startServer({ port: 3002, slidesFile: 'slides.md' });
} catch (error) {
    console.error('Failed to start server:', error);
}
