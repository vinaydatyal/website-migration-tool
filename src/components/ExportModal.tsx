import React, { useState, useMemo } from 'react';
import { 
  X, 
  Copy, 
  Download, 
  Check, 
  FileCode2, 
  Server, 
  Cloud, 
  Globe, 
  FileSpreadsheet,
  CheckCircle2
} from 'lucide-react';
import { UrlMapping, SynthesizedPattern, ExportFormat, MigrationSummaryStats, ProjectMetadata } from '../types/migration';
import { exportRedirects } from '../utils/exporters';
import { toast } from 'sonner';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  mappings: UrlMapping[];
  patterns: SynthesizedPattern[];
  stats: MigrationSummaryStats | null;
  projectMetadata: ProjectMetadata;
  checklistProgress: Record<string, boolean>;
  targetEntries?: any[]; // pass down target entries for Sitemap
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  mappings,
  patterns,
  stats,
  projectMetadata,
  checklistProgress,
  targetEntries = []
}) => {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('HTACCESS');
  const [copied, setCopied] = useState(false);
  const [targetDomain, setTargetDomain] = useState('');

  const exportData = useMemo(() => {
    return exportRedirects(selectedFormat, mappings, patterns, targetDomain, stats, projectMetadata, checklistProgress, targetEntries);
  }, [selectedFormat, mappings, patterns, targetDomain, stats, projectMetadata, checklistProgress, targetEntries]);

  const previewContent = useMemo(() => {
    if (exportData.mimeType.includes('spreadsheet')) {
      return "[Binary Excel Document - Click Download to view]";
    }
    const lines = (exportData.content as string).split('\n');
    const MAX_PREVIEW_LINES = 1000;
    
    if (lines.length > MAX_PREVIEW_LINES) {
      return lines.slice(0, MAX_PREVIEW_LINES).join('\n') + `\n\n... [${(lines.length - MAX_PREVIEW_LINES).toLocaleString()} more lines hidden for performance. Download the file to view everything!]`;
    }
    return exportData.content as string;
  }, [exportData.content, exportData.mimeType]);

  if (!isOpen) return null;

  const handleCopy = () => {
    if (exportData.mimeType.includes('spreadsheet')) {
      toast.error('Cannot copy binary Excel files.');
      return;
    }
    navigator.clipboard.writeText(exportData.content as string);
    setCopied(true);
    toast.success('Redirect configuration copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = async () => {
    if (selectedFormat === 'EXECUTIVE_PDF') {
      try {
        const criticalIssues = mappings
          .flatMap(m => m.discrepancies.map(d => ({...d, sourceUrl: m.source.url, targetUrl: m.target?.url})))
          .filter(d => d.severity === 'CRITICAL' || d.severity === 'HIGH');
        const res = await fetch('http://localhost:3001/api/generate-pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stats, projectMetadata, criticalIssues })
        });
        if (!res.ok) throw new Error('PDF Generation failed');
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'migration-audit-report.pdf';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success(`Downloaded Executive Report PDF`);
      } catch (err: any) {
        toast.error(err.message || 'Failed to generate PDF');
      }
      return;
    }

    const blob = new Blob([exportData.content as BlobPart], { type: exportData.mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = exportData.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Downloaded ${exportData.filename}`);
  };

  const formatTabs: { id: ExportFormat; label: string; icon: any }[] = [
    { id: 'HTACCESS', label: 'Apache (.htaccess)', icon: Server },
    { id: 'NGINX', label: 'Nginx (.conf)', icon: Server },
    { id: 'CLOUDFLARE_CSV', label: 'Cloudflare (CSV)', icon: Cloud },
    { id: 'VERCEL_REDIRECTS', label: 'Vercel / Netlify', icon: Globe },
    { id: 'NEXTJS_CONFIG', label: 'Next.js Config', icon: FileCode2 },
    { id: 'WORDPRESS_REDIRECTION_CSV', label: 'WP Redirection', icon: Globe },
    { id: 'FULL_MAPPING_CSV', label: 'Full Audit CSV', icon: FileSpreadsheet },
    { id: 'FULL_AUDIT_EXCEL', label: 'Playbook + Audit (Excel)', icon: FileSpreadsheet },
    { id: 'SITEMAP_XML', label: 'Target Sitemap (XML)', icon: Globe },
    { id: 'EXECUTIVE_PDF', label: 'Executive Report (PDF)', icon: FileCode2 },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="shrink-0 p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-brand-500/10 text-brand-400">
              <FileCode2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Export 301 Redirect Configurations</h3>
              <p className="text-xs text-slate-400">Production-ready server rules & client mapping deliverables</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="shrink-0 px-5 pt-3 pb-2 border-b border-slate-800 flex flex-wrap gap-1.5 bg-slate-950/30 overflow-x-auto">
          {formatTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = selectedFormat === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setSelectedFormat(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all cursor-pointer ${
                  isActive
                    ? 'bg-brand-500 text-slate-950 shadow-md shadow-brand-500/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/80'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Optional Domain input for absolute URLs */}
        <div className="shrink-0 px-5 py-2.5 bg-slate-950/50 border-b border-slate-800 flex items-center space-x-3 text-xs">
          <span className="text-slate-400 font-semibold">Target Domain (for absolute URLs):</span>
            <input
              type="text"
              placeholder="e.g. newdomain.com"
              value={targetDomain}
              onChange={(e) => setTargetDomain(e.target.value)}
              className="px-3 py-1 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-white focus:outline-none focus:border-brand-500"
            />
          </div>


        {/* Code Content Box */}
        <div className="flex-1 p-5 overflow-y-auto font-mono text-xs text-slate-300 bg-slate-950/90">
          <pre className="whitespace-pre-wrap select-all leading-relaxed">
            {previewContent}
          </pre>
        </div>

        {/* Modal Footer Actions */}
        <div className="shrink-0 p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <span className="text-xs text-slate-400 font-mono">
            File: <span className="text-slate-200 font-bold">{exportData.filename}</span>
          </span>

          <div className="flex items-center space-x-3">
            <button
              onClick={handleCopy}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center space-x-1.5 transition-all cursor-pointer"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-brand-400" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copied ? 'Copied!' : 'Copy Code'}</span>
            </button>

            <button
              onClick={handleDownload}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-brand-500 to-emerald-500 text-slate-950 hover:from-brand-400 hover:to-emerald-400 shadow-md shadow-brand-500/20 flex items-center space-x-1.5 transition-all cursor-pointer"
            >
              <Download className="h-3.5 w-3.5 stroke-[2.5]" />
              <span>Download {exportData.filename}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
