import fs from 'fs';
import Papa from 'papaparse';

const csv = `Top pages,Clicks,Impressions,CTR,Position
https://www.example.com/page1,"1,234",5000,24.68%,1.2
https://www.example.com/page2,"500",2000,25.0%,2.1
`;

function findValue(row, aliases) {
  const keys = Object.keys(row);
  for (const alias of aliases) {
    const normalizedAlias = alias.toLowerCase().replace(/[^a-z0-9]/g, '');
    const matchedKey = keys.find(k => k.toLowerCase().replace(/[^a-z0-9]/g, '') === normalizedAlias);
    if (matchedKey && row[matchedKey] !== undefined && row[matchedKey] !== '') {
      return row[matchedKey];
    }
  }
  return undefined;
}

function parseNumber(val, fallback = 0) {
  if (val === null || val === undefined) return fallback;
  const num = parseInt(String(val).replace(/[^0-9-]/g, ''), 10);
  return isNaN(num) ? fallback : num;
}

Papa.parse(csv, {
  header: true,
  complete: (results) => {
    console.log("Headers:", results.meta.fields);
    results.data.forEach(row => {
      if (Object.keys(row).length < 2) return;
      const urlVal = findValue(row, ['Address', 'URL', 'Url', 'Page', 'Landing Page', 'Landing page', 'Page path', 'Top queries', 'Top pages', 'Top Pages']);
      const clicks = parseNumber(findValue(row, ['Sessions', 'Visits', 'Clicks', 'Traffic', 'Total Traffic', 'Active Users', 'Users']), 0);
      console.log("URL:", urlVal, "Clicks:", clicks);
    });
  }
});
