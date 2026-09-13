const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.resolve(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            results = results.concat(walk(file));
        } else {
            if (file.endsWith('.tsx') || file.endsWith('.ts')) {
                results.push(file);
            }
        }
    });
    return results;
}

const files = walk('e:/SarayaLivestock/apps/web/src');

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;

    // Fix text-white to be text-slate-900 in light mode, EXCEPT when it's on a dark background like bg-emerald-600, bg-rose-500, etc.
    // Since regex for this is tricky, we'll replace all text-white with text-slate-900 dark:text-white, 
    // BUT we will revert it for known colored buttons if we can, or just do it for headers.
    
    // Let's replace text-white with text-slate-900 dark:text-white
    content = content.replace(/\btext-white\b/g, "text-slate-900 dark:text-white");
    // Revert for known colored backgrounds (buttons, badges)
    content = content.replace(/bg-emerald-600([^"']*)text-slate-900 dark:text-white/g, "bg-emerald-600$1text-white");
    content = content.replace(/bg-emerald-500([^"']*)text-slate-900 dark:text-white/g, "bg-emerald-500$1text-white");
    content = content.replace(/bg-rose-500([^"']*)text-slate-900 dark:text-white/g, "bg-rose-500$1text-white");
    content = content.replace(/bg-blue-500([^"']*)text-slate-900 dark:text-white/g, "bg-blue-500$1text-white");
    content = content.replace(/bg-purple-600([^"']*)text-slate-900 dark:text-white/g, "bg-purple-600$1text-white");
    content = content.replace(/bg-amber-500([^"']*)text-slate-900 dark:text-white/g, "bg-amber-500$1text-white");
    content = content.replace(/bg-slate-800([^"']*)text-slate-900 dark:text-white/g, "bg-slate-800$1text-white"); // for badges

    // Fix colored text for light mode (make them darker)
    content = content.replace(/\btext-emerald-400\b/g, "text-emerald-700 dark:text-emerald-400");
    content = content.replace(/\btext-purple-300\b/g, "text-purple-700 dark:text-purple-300");
    content = content.replace(/\btext-purple-400\b/g, "text-purple-700 dark:text-purple-400");
    content = content.replace(/\btext-rose-400\b/g, "text-rose-600 dark:text-rose-400");
    content = content.replace(/\btext-amber-400\b/g, "text-amber-600 dark:text-amber-400");
    content = content.replace(/\btext-blue-400\b/g, "text-blue-600 dark:text-blue-400");
    content = content.replace(/\btext-cyan-400\b/g, "text-cyan-700 dark:text-cyan-400");

    // Fix colored backgrounds with opacity for light mode
    content = content.replace(/\bbg-purple-600\/10\b/g, "bg-purple-100 dark:bg-purple-600/10");
    content = content.replace(/\bbg-emerald-500\/10\b/g, "bg-emerald-100 dark:bg-emerald-500/10");
    content = content.replace(/\bbg-rose-500\/10\b/g, "bg-rose-100 dark:bg-rose-500/10");
    content = content.replace(/\bbg-amber-500\/10\b/g, "bg-amber-100 dark:bg-amber-500/10");
    content = content.replace(/\bbg-blue-500\/10\b/g, "bg-blue-100 dark:bg-blue-500/10");

    // Fix borders for colored badges
    content = content.replace(/\bborder-purple-500\/30\b/g, "border-purple-300 dark:border-purple-500/30");
    content = content.replace(/\bborder-emerald-500\/20\b/g, "border-emerald-300 dark:border-emerald-500/20");
    
    // Deduplicate
    content = content.replace(/text-slate-900 dark:text-slate-900 dark:text-white/g, "text-slate-900 dark:text-white");
    content = content.replace(/text-emerald-700 dark:text-emerald-700 dark:text-emerald-400/g, "text-emerald-700 dark:text-emerald-400");
    content = content.replace(/text-purple-700 dark:text-purple-700 dark:text-purple-400/g, "text-purple-700 dark:text-purple-400");
    content = content.replace(/bg-purple-100 dark:bg-purple-100 dark:bg-purple-600\/10/g, "bg-purple-100 dark:bg-purple-600/10");

    if (content !== original) {
        fs.writeFileSync(file, content, 'utf8');
        console.log(`Updated colors in ${file}`);
    }
});
console.log("Color refinement complete!");
