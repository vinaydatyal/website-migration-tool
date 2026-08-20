import puppeteer from 'puppeteer';

export async function generatePdfReport(data) {
  const { stats, projectMetadata, criticalIssues } = data;
  
  const grade = stats.readinessScore >= 90 ? 'A' : stats.readinessScore >= 75 ? 'B' : stats.readinessScore >= 50 ? 'C' : 'D';
  const gradeColor = grade === 'A' ? 'text-emerald-600 bg-emerald-100 border-emerald-300' :
                     grade === 'B' ? 'text-green-600 bg-green-100 border-green-300' :
                     grade === 'C' ? 'text-yellow-600 bg-yellow-100 border-yellow-300' :
                     'text-red-600 bg-red-100 border-red-300';

  let issuesHtml = '';
  if (criticalIssues && criticalIssues.length > 0) {
    issuesHtml = criticalIssues.slice(0, 50).map(issue => `
      <div class="mb-4 p-4 border border-red-200 rounded-lg bg-red-50">
        <h4 class="font-bold text-red-800 flex items-center gap-2">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
          ${issue.title}
        </h4>
        <p class="text-sm text-red-700 mt-1">${issue.description}</p>
        <div class="mt-2 text-xs font-mono text-red-900 bg-red-100 p-2 rounded">
          <div><strong>Source:</strong> ${issue.sourceUrl}</div>
          ${issue.targetUrl ? `<div><strong>Target:</strong> ${issue.targetUrl}</div>` : ''}
        </div>
      </div>
    `).join('');
  } else {
    issuesHtml = '<p class="text-gray-500 italic">No critical SEO parity issues found!</p>';
  }

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Migration Audit Report</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <style>
        @page { margin: 20mm; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .page-break { page-break-before: always; }
      </style>
    </head>
    <body class="bg-white text-gray-900">
      
      <!-- Header -->
      <header class="border-b-4 border-teal-600 pb-6 mb-8 mt-4">
        <div class="flex justify-between items-end">
          <div>
            <h1 class="text-4xl font-extrabold text-gray-900">MigrateShield</h1>
            <p class="text-xl text-gray-500 mt-1">SEO Parity & Migration Audit Report</p>
          </div>
          <div class="text-right text-sm text-gray-500">
            <p><strong>Project:</strong> ${projectMetadata?.projectName || 'Unnamed Project'}</p>
            <p><strong>Date Generated:</strong> ${new Date().toLocaleDateString()}</p>
          </div>
        </div>
      </header>

      <!-- Executive Summary -->
      <section class="mb-10">
        <h2 class="text-2xl font-bold text-gray-800 mb-4 border-b pb-2">Executive Summary</h2>
        <div class="flex gap-6">
          <div class="w-1/3 p-6 rounded-xl border ${gradeColor} text-center flex flex-col justify-center">
            <div class="text-sm font-bold uppercase tracking-wider mb-2">Readiness Grade</div>
            <div class="text-6xl font-black">${grade}</div>
            <div class="text-sm mt-2 font-medium">Score: ${stats.readinessScore}/100</div>
          </div>
          
          <div class="w-2/3 grid grid-cols-2 gap-4">
            <div class="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div class="text-xs text-gray-500 font-bold uppercase">Total URLs Audited</div>
              <div class="text-3xl font-bold text-gray-800 mt-1">${stats.totalSourceUrls}</div>
            </div>
            <div class="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div class="text-xs text-gray-500 font-bold uppercase">Successfully Mapped</div>
              <div class="text-3xl font-bold text-teal-600 mt-1">${stats.totalSourceUrls - stats.unmappedCount}</div>
            </div>
            <div class="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div class="text-xs text-gray-500 font-bold uppercase">Missing Pages (404/410)</div>
              <div class="text-3xl font-bold text-red-600 mt-1">${stats.unmappedCount}</div>
            </div>
            <div class="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div class="text-xs text-gray-500 font-bold uppercase">Critical Discrepancies</div>
              <div class="text-3xl font-bold text-red-600 mt-1">${stats.criticalDiscrepanciesCount}</div>
            </div>
          </div>
        </div>
      </section>

      <!-- SEO Parity Issues -->
      <section class="mb-10 page-break">
        <h2 class="text-2xl font-bold text-gray-800 mb-4 border-b pb-2">Critical Parity Issues (${criticalIssues?.length || 0})</h2>
        <p class="text-gray-600 text-sm mb-6">The following URLs have severe SEO drops or critical indexing issues between the source and staging environments. These must be resolved prior to launch.</p>
        
        <div class="space-y-4">
          ${issuesHtml}
        </div>
      </section>

      <!-- Footer -->
      <div class="mt-16 text-center text-xs text-gray-400 border-t pt-4">
        Generated by MigrateShield - Automated Website Migration Tool
      </div>
    </body>
    </html>
  `;

  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  
  const pdfBuffer = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: {
      top: '0mm',
      bottom: '0mm',
      left: '0mm',
      right: '0mm'
    }
  });

  await browser.close();
  return pdfBuffer;
}
