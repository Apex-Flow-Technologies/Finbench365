const fs = require('fs');
const path = require('path');

function walk(dir) {
    let files = [];
    for (let f of fs.readdirSync(dir)) {
        let p = path.join(dir, f);
        if (fs.statSync(p).isDirectory()) {
            files = files.concat(walk(p));
        } else if (p.endsWith('.tsx') || p.endsWith('.ts')) {
            files.push(p);
        }
    }
    return files;
}

const allFiles = walk('./src');
const targetFiles = allFiles.filter(f => 
    !f.includes('\\admin\\') && 
    !f.includes('/admin/') && 
    !f.includes('\\editor\\') && 
    !f.includes('/editor/')
);

let modifiedCount = 0;

targetFiles.forEach(f => {
    let original = fs.readFileSync(f, 'utf8');
    let content = original;

    // Light mode text colors (ignoring prefixed ones like dark:text-... or hover:text-...)
    // Negative lookbehind ensures we don't match pseudo-classes or breakpoints like md:text-slate-900 
    // Wait, md:text-slate-900 has a colon! We SHOULD replace md:text-slate-900 if it's light mode.
    // So the prefix can be a breakpoint, but NOT "dark" or "hover" or "focus".
    
    // Let's just use a replacer function for any text-slate-\d+
    content = content.replace(/(?:\b|:)(text-slate-\d+)\b/g, (match, p1, offset, string) => {
        // Find if this is preceded by dark: or hover: or focus:
        // We can look backwards in the string.
        let isDark = false;
        let isHover = false;
        
        // Find the boundary of the class word
        let wordStart = offset;
        while(wordStart > 0 && /[a-zA-Z0-9-:]/.test(string[wordStart - 1])) {
            wordStart--;
        }
        let fullClass = string.substring(wordStart, offset + p1.length);
        
        if (fullClass.includes('dark:')) isDark = true;
        if (fullClass.includes('hover:') || fullClass.includes('focus:') || fullClass.includes('active:')) isHover = true;

        if (isDark && !isHover) {
            // Dark mode replacements
            if (p1 === 'text-slate-200' || p1 === 'text-slate-300') return match.replace(p1, 'text-[#E2E8F0]');
            if (p1 === 'text-slate-400' || p1 === 'text-slate-500') return match.replace(p1, 'text-[#94A3B8]');
        } else if (!isDark && !isHover) {
            // Light mode replacements
            if (p1 === 'text-slate-900' || p1 === 'text-slate-800') return match.replace(p1, 'text-[#111B35]');
            if (p1 === 'text-slate-700' || p1 === 'text-slate-600') return match.replace(p1, 'text-[#334155]');
            if (p1 === 'text-slate-500' || p1 === 'text-slate-400') return match.replace(p1, 'text-[#475569]');
        }
        
        return match;
    });

    if (content !== original) {
        fs.writeFileSync(f, content);
        console.log('Modified:', f);
        modifiedCount++;
    }
});

console.log(`Total files modified: ${modifiedCount}`);
