const fs = require('fs');
const path = require('path');
function walk(dir) {
    let files = [];
    for (let f of fs.readdirSync(dir)) {
        let p = path.join(dir, f);
        if (fs.statSync(p).isDirectory()) {
            files = files.concat(walk(p));
        } else if (p.endsWith('.tsx') || p.endsWith('.ts') || p.endsWith('.css')) {
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
    !f.includes('/editor/') && 
    fs.readFileSync(f, 'utf8').includes('font-mono')
);
targetFiles.forEach(f => {
    let content = fs.readFileSync(f, 'utf8');
    
    // Replace font-mono with tabular-nums so numbers remain aligned,
    // but the font changes to sans-serif as requested.
    content = content.replace(/\bfont-mono\b/g, 'tabular-nums');
    
    fs.writeFileSync(f, content);
});
console.log('Modified:', targetFiles.join('\n'));
