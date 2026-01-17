module.exports = function (html) {
    // Regex for: <blockquote>\n<p>[!TYPE] Title\nContent</p>\n</blockquote>
    return html.replace(/<blockquote>\n<p>\[!(\w+)\]\s*(.*?)(?:\n([\s\S]*?))?<\/p>/g, (match, type, title, content) => {
        const typeLower = type.toLowerCase();
        const calloutTitle = title || type.toUpperCase();
        const bodyContent = content ? `<p>${content}</p>` : '';
        return `<div class="callout callout-${typeLower} p-4 my-4 rounded-lg border-l-4 border-${typeLower}-500 bg-${typeLower}-50/10">
<h3 class="font-bold mb-2 text-${typeLower}-500">${calloutTitle}</h3>${bodyContent}`;
    }).replace(/<\/blockquote>/g, '</div>');
};
