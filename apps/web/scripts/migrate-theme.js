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

    // Backgrounds
    content = content.replace(/\bbg-slate-950\b/g, "bg-slate-50 dark:bg-slate-950");
    content = content.replace(/\bbg-slate-900\b/g, "bg-white dark:bg-slate-900");
    content = content.replace(/\bbg-slate-800\b/g, "bg-slate-100 dark:bg-slate-800");
    content = content.replace(/\bbg-slate-700\b/g, "bg-slate-200 dark:bg-slate-700");
    
    // Text colors
    content = content.replace(/\btext-slate-100\b/g, "text-slate-900 dark:text-slate-100");
    content = content.replace(/\btext-slate-200\b/g, "text-slate-800 dark:text-slate-200");
    content = content.replace(/\btext-slate-300\b/g, "text-slate-700 dark:text-slate-300");
    content = content.replace(/\btext-slate-400\b/g, "text-slate-500 dark:text-slate-400");
    
    // Borders & Dividers
    content = content.replace(/\bborder-slate-800\b/g, "border-slate-200 dark:border-slate-800");
    content = content.replace(/\bborder-slate-700\b/g, "border-slate-300 dark:border-slate-700");
    content = content.replace(/\bdivide-slate-800\b/g, "divide-slate-200 dark:divide-slate-800");

    // Replace text-white that are used as headings (heuristics: text-white next to text-xl, text-sm, etc. or just globally except when in bg-emerald)
    // Actually, it's safer to leave text-white alone and manually fix the missing text-slate-900 in headers, but let's do a safe replacement for `text-white` where we know it's a heading.
    // We can replace `text-white` with `text-slate-900 dark:text-white` safely if we exclude `text-white` that has `bg-emerald`, `bg-rose`, `bg-blue`, `bg-amber` in the same className string.
    // Instead of regex for that, let's just do it manually for `text-white` since it's tricky.

    // Deduplicate in case it was run twice:
    content = content.replace(/bg-slate-50 dark:bg-slate-50 dark:bg-slate-950/g, "bg-slate-50 dark:bg-slate-950");
    content = content.replace(/bg-white dark:bg-white dark:bg-slate-900/g, "bg-white dark:bg-slate-900");
    // Just to be sure, we won't run it twice.

    if (content !== original) {
        fs.writeFileSync(file, content, 'utf8');
        console.log(`Updated ${file}`);
    }
});
console.log("Migration complete!");
