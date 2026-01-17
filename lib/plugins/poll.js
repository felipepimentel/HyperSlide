const container = require('markdown-it-container');
const crypto = require('crypto');

module.exports = function (md) {
    // Syntax: ::: poll Question? | Option 1, Option 2, Option 3 :::
    md.use(container, 'poll', {
        validate: function (params) {
            return params.trim().match(/^poll\s+(.*)$/);
        },
        render: function (tokens, idx) {
            var m = tokens[idx].info.trim().match(/^poll\s+(.*)$/);

            if (tokens[idx].nesting === 1) {
                // opening tag
                const rawContent = m ? m[1] : '';
                const parts = rawContent.split('|');
                const question = parts[0].trim();
                const optionsStr = parts[1] ? parts[1] : 'Yes, No';
                const options = optionsStr.split(',').map(o => o.trim());

                // Generate a consistent ID based on the question
                const pollId = crypto.createHash('md5').update(question).digest('hex').substring(0, 8);

                const optionsJson = JSON.stringify(options).replace(/"/g, '&quot;');

                return `<div class="poll-container w-full max-w-2xl mx-auto my-8 p-6 glass rounded-xl"
                             x-data="poll('${pollId}', ${optionsJson})"
                             x-init="init()"
                             id="poll-${pollId}">
                            <h3 class="text-2xl font-bold mb-6 text-center">${question}</h3>
                            <div class="space-y-4">
                                <template x-for="(opt, idx) in options" :key="idx">
                                    <div class="relative h-12 bg-white/5 rounded-lg overflow-hidden cursor-pointer hover:bg-white/10 transition-colors"
                                         @click="vote(idx)">
                                        <!-- Progress Bar -->
                                        <div class="absolute top-0 left-0 h-full bg-blue-500/20 transition-all duration-500"
                                             :style="'width: ' + getPercent(idx) + '%'"></div>
                                        
                                        <!-- Label & Count -->
                                        <div class="absolute inset-0 flex items-center justify-between px-4 z-10">
                                            <span x-text="opt" class="font-medium"></span>
                                            <span class="text-sm opacity-70" x-text="getPercent(idx) + '% (' + (votes[idx] || 0) + ')'"></span>
                                        </div>
                                    </div>
                                </template>
                            </div>
                            <div class="mt-4 text-center text-xs opacity-50">
                                Scan QR to vote
                            </div>`;
            } else {
                // closing tag
                return '</div>\n';
            }
        }
    });
};
