let inputEditor, outputEditor;

// Monaco Config
require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.34.1/min/vs' } });

require(['vs/editor/editor.main'], function () {
    inputEditor = monaco.editor.create(document.getElementById('inputEditor'), {
        value: '<!-- Paste your messy ACC V8 code here -->\n<% if(targetData.ID == 1){ %>\n<table><tr><td>Hello <%= targetData.NAME %></td></tr></table>\n<% } %>',
        language: 'html',
        theme: 'vs-dark',
        automaticLayout: true,
        minimap: { enabled: false },
        fontSize: 14,
        fontFamily: "'JetBrains Mono', monospace"
    });

    outputEditor = monaco.editor.create(document.getElementById('outputEditor'), {
        value: '',
        language: 'html',
        theme: 'vs-dark',
        automaticLayout: true,
        readOnly: true,
        minimap: { enabled: false },
        fontSize: 14,
        fontFamily: "'JetBrains Mono', monospace"
    });
});

// CORE FORMATTER LOGIC (Ported from our Python version)
function cleanHtmlTag(tag) {
    if (tag.includes('<%')) {
        let parts = tag.split(/(<%.*?%>)/gs);
        let cleanedParts = parts.map(part => {
            if (part.startsWith('<%')) {
                if (part.startsWith('<%=')) return '<%= ' + part.substring(3, part.length - 2).trim() + ' %>';
                if (part.startsWith('<%@')) return '<%@ ' + part.substring(3, part.length - 2).trim() + ' %>';
                if (part.startsWith('<%#')) return '<%# ' + part.substring(3, part.length - 2).trim() + ' %>';
                return part.trim();
            }
            return part.replace(/\s+/g, ' ');
        });
        let full = cleanedParts.join("");
        full = full.replace(/^<\s+/, '<').replace(/\s+>$/, '>').replace(/\s+\/>$/, ' />');
        return full.replace(/ +/g, ' ').trim();
    } else {
        return tag.replace(/\s+/g, ' ').replace(/^<\s+/, '<').replace(/\s+(\/?>)$/, '$1').trim();
    }
}

function formatJsInternal(code) {
    code = code.trim();
    if (!code) return "";
    code = code.replace(/\}\s*else\s+if/g, '} else if');

    if (code.length < 100 && !code.includes('\n')) return code;

    try {
        return js_beautify(code, {
            indent_size: 2,
            brace_style: "collapse",
            wrap_line_length: 0
        });
    } catch (e) {
        return code;
    }
}

function processFormatting() {
    const content = inputEditor.getValue();
    let normalized = content.replace(/<\s+([%@])/g, '<$1').replace(/([%@])\s+>/g, '$1>');

    // Master Regex for tokens
    const pattern = /(<%.*?%>|<(?:<%.*?%>|[^>])*?>|<!--.*?-->)/gs;
    let tokens = normalized.split(pattern);

    let formattedLines = [];
    let indentLevel = 0;
    const indentStr = "  ";
    const airyElements = new Set(['table', 'div', 'style', 'head', 'body', 'center', 'html']);

    for (let i = 0; i < tokens.length; i++) {
        let t = tokens[i];
        if (t === undefined) continue;
        let isToken = (i % 2 === 1);
        let tStrip = t.trim();
        if (!tStrip && !isToken) continue;

        if (isToken) {
            // CASE A: ACC BLOCK
            if (tStrip.startsWith('<%') && !tStrip.startsWith('<!')) {
                let prefix = "";
                if (tStrip.startsWith('<%=')) prefix = "<%=";
                else if (tStrip.startsWith('<%@')) prefix = "<%@";
                else if (tStrip.startsWith('<%#')) prefix = "<%#";
                else prefix = "<%";

                let code = tStrip.substring(prefix.length, tStrip.length - 2).trim();

                if (prefix === "<%") {
                    if (code.includes('}') && !code.includes('{')) indentLevel = Math.max(0, indentLevel - 1);
                    else if (code.includes('} else') || code.includes('else if') || code.includes('else {')) indentLevel = Math.max(0, indentLevel - 1);

                    if ((code.includes('if') || code.includes('for')) && !code.includes('else')) {
                        if (formattedLines.length > 0 && formattedLines[formattedLines.length - 1] !== "") formattedLines.push("");
                    }

                    let formattedJs = formatJsInternal(code);
                    let jsLines = formattedJs.split('\n');

                    if (jsLines.length <= 1) {
                        formattedLines.push(indentStr.repeat(indentLevel) + "<% " + jsLines[0] + " %>");
                    } else {
                        formattedLines.push(indentStr.repeat(indentLevel) + "<%");
                        jsLines.forEach(jl => formattedLines.push(indentStr.repeat(indentLevel + 1) + jl));
                        formattedLines.push(indentStr.repeat(indentLevel) + "%>");
                    }

                    if (code.includes('{') && !code.includes('}')) indentLevel++;
                    else if (code.includes('} else {') || code.includes('else {') || code.includes('else if')) indentLevel++;
                } else {
                    formattedLines.push(indentStr.repeat(indentLevel) + prefix + " " + code + " %>");
                }
            }
            // CASE B: HTML TAG
            else if (tStrip.startsWith('<')) {
                if (tStrip.startsWith('<!--')) {
                    formattedLines.push(indentStr.repeat(indentLevel) + tStrip);
                    continue;
                }
                let isClosing = tStrip.startsWith('</');
                let tagNameMatch = tStrip.match(/^<\/?([a-z0-9:-]+)/i);
                let tagName = tagNameMatch ? tagNameMatch[1].toLowerCase() : "";

                let cleanTag = cleanHtmlTag(tStrip);
                if (isClosing) indentLevel = Math.max(0, indentLevel - 1);

                if (airyElements.has(tagName) && !isClosing) {
                    if (formattedLines.length > 0 && formattedLines[formattedLines.length - 1] !== "") formattedLines.push("");
                }

                formattedLines.push(indentStr.repeat(indentLevel) + cleanTag);

                let isVoid = ['img', 'br', 'hr', 'meta', 'link', 'input'].includes(tagName) || tStrip.endsWith('/>');
                if (!isClosing && !isVoid) indentLevel++;
            }
        } else {
            // CASE C: TEXT
            let text = t.replace(/\s+/g, ' ').trim();
            if (text) {
                formattedLines.push(indentStr.repeat(indentLevel) + text);
            }
        }
    }

    let result = formattedLines.join('\n').replace(/\n{3,}/g, '\n\n');
    outputEditor.setValue(result);
}

// Event Listeners
document.getElementById('formatBtn').addEventListener('click', processFormatting);

document.getElementById('downloadBtn').addEventListener('click', () => {
    const code = outputEditor.getValue();
    if (!code) return alert("Format some code first!");
    const blob = new Blob([code], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'formatted_acc_template.html';
    a.click();
});

function copyResult() {
    const code = outputEditor.getValue();
    navigator.clipboard.writeText(code).then(() => {
        const btn = document.querySelector('.copy-btn');
        btn.textContent = "Copied!";
        setTimeout(() => btn.textContent = "Copy Code", 2000);
    });
}

function clearInput() {
    inputEditor.setValue('');
    outputEditor.setValue('');
}

function toggleFullscreen() {
    const pane = document.querySelector('.editor-pane:last-child');
    const btn = document.querySelector('.fullscreen-btn');

    pane.classList.toggle('fullscreen');

    if (pane.classList.contains('fullscreen')) {
        btn.textContent = "Exit Full Screen";
        document.body.style.overflow = "hidden";
    } else {
        btn.textContent = "Full Screen";
        document.body.style.overflow = "";
    }

    // Trigger Monaco resize with multiple attempts for safety
    const resize = () => {
        outputEditor.layout();
    };

    setTimeout(resize, 50);
    setTimeout(resize, 300);
}
