const fs = require('fs-extra');
const path = require('path');
const renderer = require('./renderer');
const pc = require('picocolors');

async function exportProject(slidesFile, outputDir = 'dist') {
    const ROOT_DIR = process.cwd();
    const slidesPath = path.isAbsolute(slidesFile) ? slidesFile : path.join(ROOT_DIR, slidesFile);
    const targetDir = path.isAbsolute(outputDir) ? outputDir : path.join(ROOT_DIR, outputDir);

    if (!fs.existsSync(slidesPath)) {
        console.error(pc.red(`Error: Slides file not found at ${slidesPath}`));
        return;
    }

    console.log(pc.blue(`📦 Exporting presentation to ${pc.bold(outputDir)}...`));

    try {
        await fs.ensureDir(targetDir);
        await fs.ensureDir(path.join(targetDir, 'js'));

        // 1. Render slides content
        const slidesContent = fs.readFileSync(slidesPath, 'utf8');
        // Simple count estimation for static export
        const estimatedCount = slidesContent.split(/\n-{3,}\n/).length;

        // Check for local style.css
        const localStylePath = path.join(ROOT_DIR, 'style.css');
        const localStyle = fs.existsSync(localStylePath) ? `<link rel="stylesheet" href="style.css">` : '';

        // 2. Render the template
        const templatePath = path.join(__dirname, '..', 'templates', 'index.ejs');
        const ejs = require('ejs');

        const html = await ejs.renderFile(templatePath, {
            slideCount: estimatedCount,
            localStyle: localStyle,
            isDev: false,
            scriptPath: 'js'
        });

        await fs.writeFile(path.join(targetDir, 'index.html'), html);

        // 3. Copy Client Scripts
        await fs.copy(
            path.join(__dirname, 'client', 'slideshow.js'),
            path.join(targetDir, 'js', 'slideshow.js')
        );

        // 4. Copy assets (layouts, components, styles, and everything in current dir except node_modules etc)
        const items = await fs.readdir(ROOT_DIR);
        for (const item of items) {
            if (item === outputDir || item === 'node_modules' || item.startsWith('.') || item === 'dist') continue;

            const srcPath = path.join(ROOT_DIR, item);
            const stats = await fs.stat(srcPath);

            if (stats.isDirectory()) {
                await fs.copy(srcPath, path.join(targetDir, item), {
                    filter: (src) => !src.includes('node_modules') && !path.basename(src).startsWith('.')
                });
            } else if (item !== slidesFile && item !== 'package.json' && item !== 'package-lock.json') {
                await fs.copy(srcPath, path.join(targetDir, item));
            }
        }

        console.log(pc.green(`\n✨ Export complete! Your presentation is ready in ${pc.bold(outputDir)}/`));
        console.log(pc.cyan(`Open ${path.join(outputDir, 'index.html')} to view it.\n`));

    } catch (err) {
        console.error(pc.red('Failed to export project:'), err);
    }
}

module.exports = { exportProject };
