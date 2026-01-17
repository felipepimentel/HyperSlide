const fs = require('fs-extra');
const path = require('path');
const pc = require('picocolors');

async function init(projectName) {
    const targetDir = path.join(process.cwd(), projectName);
    const sourceDir = path.join(__dirname, '..');

    if (await fs.pathExists(targetDir)) {
        console.error(pc.red(`Error: Directory ${projectName} already exists.`));
        process.exit(1);
    }

    console.log(pc.blue(`Initializing new HyperSlide project in ${pc.bold(projectName)}...`));

    try {
        await fs.ensureDir(targetDir);

        // Copy essential files
        const foldersToCopy = ['layouts', 'components', 'styles'];
        for (const folder of foldersToCopy) {
            const src = path.join(sourceDir, folder);
            if (await fs.pathExists(src)) {
                await fs.copy(src, path.join(targetDir, folder));
            }
        }

        // Create initial slides.md if it doesn't exist in source (or just create a default one)
        const defaultSlides = `---
title: Welcome to HyperSlide
---

<!-- layout: hero -->

# HyperSlide
The Zero-Config CLI for beautiful presentations.

---

## Features
- 🚀 **Zero Config**
- ⚡ **HTMX + Alpine.js**
- 📝 **Markdown Driven**
- 🔥 **Hot Reloading**
`;
        await fs.writeFile(path.join(targetDir, 'slides.md'), defaultSlides);

        console.log(pc.green('\n✨ Project initialized successfully!\n'));
        console.log(`To get started:`);
        console.log(pc.cyan(`  cd ${projectName}`));
        console.log(pc.cyan(`  hyperslide dev\n`));

    } catch (err) {
        console.error(pc.red('Failed to initialize project:'), err);
    }
}

module.exports = { init };
