const fs = require('fs');
const path = require('path');

const componentsDir = path.join(__dirname, 'src', 'components');

const replacements = [
  { regex: /bg-slate-950/g, replacement: 'bg-slate-50 dark:bg-slate-950' },
  { regex: /bg-slate-900/g, replacement: 'bg-white dark:bg-slate-900' },
  { regex: /bg-slate-800/g, replacement: 'bg-slate-100 dark:bg-slate-800' },
  { regex: /border-slate-800/g, replacement: 'border-slate-200 dark:border-slate-800' },
  { regex: /border-slate-700/g, replacement: 'border-slate-300 dark:border-slate-700' },
  { regex: /text-slate-400/g, replacement: 'text-slate-500 dark:text-slate-400' },
  { regex: /text-slate-300/g, replacement: 'text-slate-700 dark:text-slate-300' },
  { regex: /text-slate-500/g, replacement: 'text-slate-500 dark:text-slate-500' }, // neutralize double replacement
  { regex: /text-slate-200/g, replacement: 'text-slate-800 dark:text-slate-200' },
  { regex: /text-slate-100/g, replacement: 'text-slate-900 dark:text-slate-100' },
  { regex: /text-white/g, replacement: 'text-slate-900 dark:text-white' },
  { regex: /text-emerald-400/g, replacement: 'text-emerald-600 dark:text-emerald-400' },
  { regex: /text-amber-400/g, replacement: 'text-amber-600 dark:text-amber-400' },
  { regex: /text-red-400/g, replacement: 'text-red-600 dark:text-red-400' },
];

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Skip files that might have been processed already or we want to skip
  if (filePath.includes('Navbar.tsx')) return;
  
  let original = content;
  
  for (const r of replacements) {
    // We only want to replace standalone classes, not already prefixed ones
    // Using a negative lookbehind is best if supported
    // But since JS regex doesn't support variable length lookbehinds easily in all environments,
    // let's do a simple replace and then fix double `dark:dark:`
    content = content.replace(r.regex, (match, offset, string) => {
      // If it's preceded by "dark:" or "hover:" or "focus:", we need to handle carefully
      // Actually, let's just use string replacement and fix the mess later
      return r.replacement;
    });
  }
  
  // Fix double prefixes
  content = content.replace(/dark:dark:/g, 'dark:');
  content = content.replace(/dark:bg-slate-50 dark:bg-slate-950/g, 'dark:bg-slate-950');
  content = content.replace(/dark:bg-white dark:bg-slate-900/g, 'dark:bg-slate-900');
  content = content.replace(/dark:bg-slate-100 dark:bg-slate-800/g, 'dark:bg-slate-800');
  content = content.replace(/dark:border-slate-200 dark:border-slate-800/g, 'dark:border-slate-800');
  content = content.replace(/dark:text-slate-500 dark:text-slate-400/g, 'dark:text-slate-400');
  content = content.replace(/dark:text-slate-700 dark:text-slate-300/g, 'dark:text-slate-300');
  content = content.replace(/dark:text-slate-900 dark:text-white/g, 'dark:text-white');
  
  // Fix hover: cases
  content = content.replace(/hover:bg-slate-100 dark:bg-slate-800/g, 'hover:bg-slate-100 dark:hover:bg-slate-800');
  content = content.replace(/hover:bg-white dark:bg-slate-900/g, 'hover:bg-white dark:hover:bg-slate-900');
  content = content.replace(/hover:text-slate-500 dark:text-slate-400/g, 'hover:text-slate-500 dark:hover:text-slate-400');
  content = content.replace(/hover:text-slate-700 dark:text-slate-300/g, 'hover:text-slate-700 dark:hover:text-slate-300');
  content = content.replace(/hover:text-slate-900 dark:text-white/g, 'hover:text-slate-900 dark:hover:text-white');

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${path.basename(filePath)}`);
  }
}

const files = fs.readdirSync(componentsDir).filter(f => f.endsWith('.tsx'));
for (const file of files) {
  processFile(path.join(componentsDir, file));
}
