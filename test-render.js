const renderer = require('./lib/renderer');
const path = require('path');
const fs = require('fs');

const slidesPath = path.join(__dirname, 'slides.md');
const output = renderer.getAllSlides(slidesPath);

console.log("--- RENDERING TEST ---");
if (output.includes('callout-info')) {
    console.log("✅ Callout transformation working.");
} else {
    console.log("❌ Callout transformation failed.");
}

if (output.includes('x-show="current === 0"') && output.includes('x-show="current === 1"')) {
    console.log("✅ Multi-slide splitting working.");
} else {
    console.log("❌ Multi-slide splitting failed.");
}

fs.writeFileSync('test-output.html', output);
console.log("Full output written to test-output.html");
