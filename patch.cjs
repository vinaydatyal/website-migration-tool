const fs = require('fs');
let app = fs.readFileSync('src/App.tsx', 'utf8');
app = app.replace(/strategy: 'UNMAPPED' as const,/, "strategy: 'UNMAPPED' as const,\n          statusCode: 404,\n          reasons: [],");
app = app.replace(/stats: stats,/g, "stats: stats as any,");
fs.writeFileSync('src/App.tsx', app);

let storage = fs.readFileSync('src/utils/storage.ts', 'utf8');
storage = storage.replace(/\.catch\(\(e\) => console\.warn\('Supabase connection notice:', e\)\)/g, ".then(undefined, (e) => console.warn('Supabase connection notice:', e))");
storage = storage.replace(/\.catch\(\(\) => \{\}\)/g, ".then(undefined, () => {})");
fs.writeFileSync('src/utils/storage.ts', storage);

let upload = fs.readFileSync('src/components/UploadZone.tsx', 'utf8');
upload = upload.replace(/setProjectProfile\('STANDARD'\)/g, "setProjectProfile('UNKNOWN')");
fs.writeFileSync('src/components/UploadZone.tsx', upload);

let supabase = fs.readFileSync('src/utils/supabaseClient.ts', 'utf8');
supabase = supabase.replace(/import\.meta\.env/g, "process.env");
fs.writeFileSync('src/utils/supabaseClient.ts', supabase);
