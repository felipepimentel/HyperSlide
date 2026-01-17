#!/usr/bin/env node

const { Command } = require('commander');
const { init } = require('../lib/init');
const { exportProject } = require('../lib/exporter');
const { startServer } = require('../server');
const packageJson = require('../package.json');

const program = new Command();

program
    .name('hyperslide')
    .description('Zero-Config CLI for beautiful Markdown presentations')
    .version(packageJson.version);

program
    .command('dev')
    .description('Start the development server for your slides')
    .option('-p, --port <number>', 'Port to run the server on', 3000)
    .option('-f, --file <path>', 'Path to the slides markdown file', 'slides.md')
    .option('-o, --open', 'Open the presentation in the browser', false)
    .action((options) => {
        startServer({
            port: parseInt(options.port),
            slidesFile: options.file,
            open: options.open
        });
    });

program
    .command('export')
    .description('Export the presentation to a static HTML project')
    .option('-f, --file <path>', 'Path to the slides markdown file', 'slides.md')
    .option('-o, --output <path>', 'Output directory', 'dist')
    .action(async (options) => {
        await exportProject(options.file, options.output);
    });

program
    .command('init')
    .description('Initialize a new HyperSlide project')
    .argument('<name>', 'Name of the project directory')
    .action(async (name) => {
        await init(name);
    });

program.parse();
