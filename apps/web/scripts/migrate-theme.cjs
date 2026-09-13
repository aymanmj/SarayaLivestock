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

    // Deduplicate in case it was run twice:
    content = content.replace(/bg-slate-50 dark:bg-slate-50 dark:bg-slate-950/g, "bg-slate-50 dark:bg-slate-950");
    content = content.replace(/bg-white dark:bg-white dark:bg-slate-900/g, "bg-white dark:bg-slate-900");
    content = content.replace(/bg-slate-100 dark:bg-slate-100 dark:bg-slate-800/g, "bg-slate-100 dark:bg-slate-800");
    content = content.replace(/bg-slate-200 dark:bg-slate-200 dark:bg-slate-700/g, "bg-slate-200 dark:bg-slate-700");
    
    content = content.replace(/text-slate-900 dark:text-slate-900 dark:text-slate-100/g, "text-slate-900 dark:text-slate-100");
    content = content.replace(/text-slate-800 dark:text-slate-800 dark:text-slate-200/g, "text-slate-800 dark:text-slate-200");
    content = content.replace(/text-slate-700 dark:text-slate-700 dark:text-slate-300/g, "text-slate-700 dark:text-slate-300");
    content = content.replace(/text-slate-500 dark:text-slate-500 dark:text-slate-400/g, "text-slate-500 dark:text-slate-400");

    content = content.replace(/border-slate-200 dark:border-slate-200 dark:border-slate-800/g, "border-slate-200 dark:border-slate-800");
    content = content.replace(/border-slate-300 dark:border-slate-300 dark:border-slate-700/g, "border-slate-300 dark:border-slate-700");
    content = content.replace(/divide-slate-200 dark:divide-slate-200 dark:divide-slate-800/g, "divide-slate-200 dark:divide-slate-800");

    // Fix the background blur and opacity in dark classes:
    // If we originally had bg-slate-900/90, our regex made it `bg-white dark:bg-slate-900/90`.
    // Wait, \b matched before the `/`. Let's fix that.
    content = content.replace(/bg-slate-50 dark:bg-slate-950\/(\d+)/g, "bg-slate-50/$1 dark:bg-slate-950/$1");
    content = content.replace(/bg-white dark:bg-slate-900\/(\d+)/g, "bg-white/$1 dark:bg-slate-900/$1");
    content = content.replace(/bg-slate-100 dark:bg-slate-800\/(\d+)/g, "bg-slate-100/$1 dark:bg-slate-800/$1");
    content = content.replace(/bg-slate-200 dark:bg-slate-700\/(\d+)/g, "bg-slate-200/$1 dark:bg-slate-700/$1");

    content = content.replace(/border-slate-200 dark:border-slate-800\/(\d+)/g, "border-slate-200/$1 dark:border-slate-800/$1");
    content = content.replace(/border-slate-300 dark:border-slate-700\/(\d+)/g, "border-slate-300/$1 dark:border-slate-700/$1");

    if (content !== original) {
        fs.writeFileSync(file, content, 'utf8');
        console.log(`Updated ${file}`);
    }
});
console.log("Migration complete!");
