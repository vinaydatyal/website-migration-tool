import dns from 'dns/promises';
import tls from 'tls';

export async function checkDnsAndSsl(domain) {
  try {
    const aRecords = await dns.resolve4(domain).catch(() => []);
    let cnameRecords = [];
    try {
      cnameRecords = await dns.resolveCname(domain);
    } catch (e) {
      // Ignore if no CNAME
    }

    const sslData = await new Promise((resolve) => {
      const socket = tls.connect(443, domain, { servername: domain, rejectUnauthorized: false }, () => {
        const cert = socket.getPeerCertificate();
        if (!cert || Object.keys(cert).length === 0) {
          resolve({ valid: false, message: 'No certificate provided' });
          socket.end();
          return;
        }

        const validFrom = new Date(cert.valid_from);
        const validTo = new Date(cert.valid_to);
        const issuer = cert.issuer ? cert.issuer.O : 'Unknown';

        // Check if currently valid
        const now = new Date();
        const isValid = now >= validFrom && now <= validTo;

        resolve({
          valid: isValid,
          issuer,
          validFrom: validFrom.toISOString(),
          validTo: validTo.toISOString(),
          subject: cert.subject ? cert.subject.CN : 'Unknown'
        });
        socket.end();
      });

      socket.on('error', (err) => {
        resolve({ valid: false, message: err.message });
      });
      
      socket.setTimeout(5000, () => {
        socket.destroy();
        resolve({ valid: false, message: 'Connection timeout' });
      });
    });

    return {
      domain,
      dns: {
        a: aRecords,
        cname: cnameRecords
      },
      ssl: sslData
    };
  } catch (error) {
    throw new Error(`Failed to check DNS/SSL for ${domain}: ${error.message}`);
  }
}

export async function checkRobotsTxt(domain) {
  const url = `https://${domain}/robots.txt`;
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    });
    if (!response.ok) {
      return { exists: false, status: response.status, content: null };
    }
    const content = await response.text();
    return { exists: true, status: response.status, content };
  } catch (error) {
    return { exists: false, error: error.message, content: null };
  }
}

export async function checkSitemapXml(domain) {
  const url = `https://${domain}/sitemap.xml`;
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    });
    if (!response.ok) {
      return { exists: false, status: response.status, content: null };
    }
    const content = await response.text();
    
    // Quick parse to count URLs (very basic for auditing parity)
    const urlCount = (content.match(/<url>/g) || []).length;
    
    return { exists: true, status: response.status, urlCount, rawContentPreview: content.substring(0, 1000) };
  } catch (error) {
    return { exists: false, error: error.message, content: null };
  }
}
