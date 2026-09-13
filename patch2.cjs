const fs = require('fs');
let app = fs.readFileSync('src/App.tsx', 'utf8');
app = app.replace(/targetUrl: null,/g, "targetUrl: '',");
fs.writeFileSync('src/App.tsx', app);

let upload = fs.readFileSync('src/components/UploadZone.tsx', 'utf8');
upload = upload.replace(/setProjectProfile\('STANDARD'\)/g, "setProjectProfile('UNKNOWN')");
upload = upload.replace(/profile === 'STANDARD'/g, "profile === 'UNKNOWN'");
fs.writeFileSync('src/components/UploadZone.tsx', upload);
