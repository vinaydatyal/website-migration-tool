import React from 'react';
import { 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  ArrowRight, 
  Layers, 
  ExternalLink,
  TrendingUp,
  FileCheck,
  AlertOctagon,
  FileCode2,
  Sparkles,
  ArrowRightLeft,
  Download,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { MigrationSummaryStats, UrlMapping, DiscrepancySeverity, ParityDiscrepancy, MigrationSnapshot } from '../types/migration';
import { MappingStatusChart } from './MappingStatusChart';
import { ProgressChart } from './ProgressChart';
import { GscIntegration } from './GscIntegration';

interface DashboardOverviewProps {
  stats: MigrationSummaryStats;
  mappings: UrlMapping[];
  onNavigateTab: (tab: any) => void;
  onOpenExport: () => void;
  onUpdateTargetData: () => void;
  onSwapDomain: () => void;
  onMergeGscData: (data: any[]) => void;
  isGscConnected: boolean;
  onGscConnected: () => void;
  snapshots: MigrationSnapshot[];
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  stats,
  mappings,
  onNavigateTab,
  onOpenExport,
  onUpdateTargetData,
  onSwapDomain,
  onMergeGscData,
  isGscConnected,
  onGscConnected,
  snapshots,
}) => {
  const [currentIssuePage, setCurrentIssuePage] = React.useState(1);
  const [isGeneratingPdf, setIsGeneratingPdf] = React.useState(false);
  const issuesPerPage = 4;
  // Collect all critical & high severity parity discrepancies across mappings
  const criticalDiscrepancies = mappings.flatMap((m: UrlMapping) => 
    m.discrepancies.map((d: ParityDiscrepancy) => ({ ...d, sourceUrl: m.source.url, targetUrl: m.targetUrl }))
  );

  const criticalIssues = criticalDiscrepancies.filter((d) => d.severity === 'CRITICAL');
  const highIssues = criticalDiscrepancies.filter((d) => d.severity === 'HIGH');
  const warningIssues = criticalDiscrepancies.filter((d) => d.severity === 'WARNING');

  const getGrade = (score: number) => {
    if (score >= 90) return { grade: 'A', text: 'Migration Ready', color: 'text-brand-400', bg: 'bg-brand-500/10', border: 'border-brand-500/30' };
    if (score >= 75) return { grade: 'B', text: 'Minor Gaps - Review Recommended', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' };
    if (score >= 50) return { grade: 'C', text: 'Moderate Risk - Critical Issues Present', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' };
    return { grade: 'D', text: 'High Risk - Do NOT Launch Yet', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30' };
  };

  const gradeInfo = getGrade(stats.readinessScore);

  const totalIssuePages = Math.ceil(criticalIssues.length / issuesPerPage);
  const paginatedIssues = criticalIssues.slice(
    (currentIssuePage - 1) * issuesPerPage,
    currentIssuePage * issuesPerPage
  );

  const handleDownloadPdf = async () => {
    try {
      setIsGeneratingPdf(true);
      toast.loading('Generating PDF report...', { id: 'pdf-toast' });
      
      const payload = {
        stats,
        projectMetadata: { projectName: 'Migration Audit' }, // You can pass actual projectMetadata here if available as a prop
        criticalIssues: criticalIssues // or send all criticalIssues
      };

      const response = await fetch('/api/pdf-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error('Failed to generate PDF');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `migration-audit-report.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast.success('PDF report generated!', { id: 'pdf-toast' });
    } catch (error) {
      console.error(error);
      toast.error('Failed to generate PDF report', { id: 'pdf-toast' });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Top Action Bar */}
      <div className="flex justify-end space-x-3">
        <button
          onClick={handleDownloadPdf}
          disabled={isGeneratingPdf}
          className="flex items-center space-x-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-sm font-semibold rounded-lg transition-colors border border-slate-700"
        >
          {isGeneratingPdf ? <Loader2 className="h-4 w-4 text-brand-400 animate-spin" /> : <Download className="h-4 w-4 text-brand-400" />}
          <span>Export PDF Report</span>
        </button>
        <button
          onClick={onSwapDomain}
          className="flex items-center space-x-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold rounded-lg transition-colors border border-slate-700"
        >
          <ArrowRightLeft className="h-4 w-4 text-brand-400" />
          <span>Swap Domain</span>
        </button>
        <button
          onClick={onUpdateTargetData}
          className="flex items-center space-x-2 px-4 py-2 bg-brand-500/10 hover:bg-brand-500/20 text-brand-400 text-sm font-semibold rounded-lg transition-colors border border-brand-500/30"
        >
          <Sparkles className="h-4 w-4" />
          <span>Manage Data Sources</span>
        </button>
      </div>

      {/* Top Banner / Executive Score Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Readiness Gauge Card */}
        <div className="lg:col-span-1 p-6 rounded-2xl bg-slate-900/80 border border-slate-800 relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Migration Health</span>
            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${gradeInfo.bg} ${gradeInfo.color} border ${gradeInfo.border}`}>
              Grade {gradeInfo.grade}
            </span>
          </div>

          <div className="flex items-center space-x-6 my-2">
            <div className="relative flex items-center justify-center">
              <svg className="w-28 h-28 transform -rotate-90">
                <circle
                  cx="56"
                  cy="56"
                  r="46"
                  stroke="currentColor"
                  strokeWidth="8"
                  className="text-slate-800"
                  fill="transparent"
                />
                <circle
                  cx="56"
                  cy="56"
                  r="46"
                  stroke="currentColor"
                  strokeWidth="8"
                  strokeDasharray={289}
                  strokeDashoffset={289 - (289 * stats.readinessScore) / 100}
                  className={`${stats.readinessScore >= 75 ? 'text-brand-500' : stats.readinessScore >= 50 ? 'text-amber-500' : 'text-red-500'} transition-all duration-1000 ease-out`}
                  strokeLinecap="round"
                  fill="transparent"
                />
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className="text-3xl font-extrabold text-white font-mono">{stats.readinessScore}%</span>
                <span className="text-[10px] text-slate-400 font-semibold uppercase">Readiness</span>
              </div>
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-bold text-white leading-tight">{gradeInfo.text}</h3>
              <p className="text-xs text-slate-400">
                {stats.criticalDiscrepanciesCount === 0 
                  ? 'Zero critical blockers detected. 301 mappings are verified.' 
                  : `${stats.criticalDiscrepanciesCount} critical SEO risk(s) must be resolved before deployment.`}
              </p>
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span>Preserved Equity:</span>
            <span className="font-bold text-brand-400 font-mono">
              {stats.totalInlinksPreserved.toLocaleString()} inlinks
            </span>
          </div>
        </div>

        {/* 4 Metric Cards */}
        <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-4">
          {/* Card 1: Total Source URLs */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold">Source URLs</span>
              <Layers className="h-4 w-4 text-brand-400" />
            </div>
            <div>
              <div className="text-2xl font-extrabold text-white font-mono">{stats.totalSourceUrls}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Across legacy site</div>
            </div>
          </div>

          {/* Card 2: Auto-Matched */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold">Auto-Matched</span>
              <CheckCircle2 className="h-4 w-4 text-brand-400" />
            </div>
            <div>
              <div className="text-2xl font-extrabold text-brand-400 font-mono">
                {stats.autoMatchedCount}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                {Math.round((stats.autoMatchedCount / (stats.totalSourceUrls || 1)) * 100)}% coverage
              </div>
            </div>
          </div>

          {/* Card 3: Needs Review */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold">Needs Review</span>
              <AlertTriangle className="h-4 w-4 text-amber-400" />
            </div>
            <div>
              <div className="text-2xl font-extrabold text-amber-400 font-mono">
                {stats.needsReviewCount}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                {stats.unmappedCount} unmapped
              </div>
            </div>
          </div>

          {/* Card 4: Critical SEO Alerts */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold">SEO Blockers</span>
              <AlertOctagon className="h-4 w-4 text-red-400" />
            </div>
            <div>
              <div className="text-2xl font-extrabold text-red-400 font-mono">
                {stats.criticalDiscrepanciesCount}
              </div>
              <div className="text-[11px] text-red-300/80 mt-0.5 font-medium">Critical Landmines</div>
            </div>
          </div>

          {/* Detailed Strategy Distribution bar */}
          <div className="col-span-2 sm:col-span-4 p-4 rounded-xl bg-slate-900/60 border border-slate-800/80">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-semibold text-slate-300">Matching Strategy Breakdown</span>
              <span className="text-slate-400 font-mono">{stats.autoMatchedCount} / {stats.totalSourceUrls} Approved</span>
            </div>
            
            {/* Segmented Progress Bar */}
            <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden flex">
              <div 
                style={{ width: `${(stats.exactPathCount / (stats.totalSourceUrls || 1)) * 100}%` }}
                className="bg-brand-500 h-full"
                title={`Exact Path: ${stats.exactPathCount}`}
              />
              <div 
                style={{ width: `${(stats.exactTitleCount / (stats.totalSourceUrls || 1)) * 100}%` }}
                className="bg-emerald-400 h-full"
                title={`Exact Title/H1: ${stats.exactTitleCount}`}
              />
              <div 
                style={{ width: `${(stats.fuzzyMatchCount / (stats.totalSourceUrls || 1)) * 100}%` }}
                className="bg-teal-400 h-full"
                title={`Fuzzy Match: ${stats.fuzzyMatchCount}`}
              />
              <div 
                style={{ width: `${(stats.unmappedCount / (stats.totalSourceUrls || 1)) * 100}%` }}
                className="bg-amber-500 h-full"
                title={`Unmapped: ${stats.unmappedCount}`}
              />
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-4 mt-3 text-[11px] text-slate-400">
              <div className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-brand-500 inline-block" />
                <span>Exact Path ({stats.exactPathCount})</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" />
                <span>Exact Title/H1 ({stats.exactTitleCount})</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-teal-400 inline-block" />
                <span>Fuzzy Match ({stats.fuzzyMatchCount})</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
                <span>Unmapped ({stats.unmappedCount})</span>
              </div>
            </div>
          </div>
          
          {/* Charts Row */}
          <div className="col-span-2 sm:col-span-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 flex flex-col items-center">
              <div className="w-full flex items-center justify-between text-xs mb-2">
                <span className="font-semibold text-slate-300">Status Distribution</span>
              </div>
              <MappingStatusChart mappings={mappings} />
            </div>
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 flex flex-col items-center">
              <div className="w-full flex items-center justify-between text-xs mb-2">
                <span className="font-semibold text-slate-300">Progress (Readiness Score)</span>
              </div>
              <ProgressChart snapshots={snapshots} currentScore={stats.readinessScore} />
            </div>
          </div>
        </div>
      </div>

      {/* Critical SEO Risk Alerts Section */}
      {criticalIssues.length > 0 && (
        <div className="p-6 rounded-2xl bg-red-950/20 border border-red-500/30 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 rounded-lg bg-red-500/20 text-red-400">
                <AlertOctagon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Critical SEO Landmines Detected ({criticalIssues.length})</h3>
                <p className="text-xs text-red-300/80">These discrepancies will lead to de-indexing, broken links, or soft 404s if launched.</p>
              </div>
            </div>
            
            {/* Pagination Controls */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setCurrentIssuePage(p => Math.max(1, p - 1))}
                disabled={currentIssuePage === 1}
                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-red-950/40 text-red-300 border border-red-500/20 hover:bg-red-500/20 disabled:opacity-50 transition-all"
              >
                Prev
              </button>
              <span className="text-xs font-mono text-red-300/80 px-1">
                {currentIssuePage} / {totalIssuePages}
              </span>
              <button
                onClick={() => setCurrentIssuePage(p => Math.min(totalIssuePages, p + 1))}
                disabled={currentIssuePage === totalIssuePages}
                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-red-950/40 text-red-300 border border-red-500/20 hover:bg-red-500/20 disabled:opacity-50 transition-all"
              >
                Next
              </button>
              
              <div className="w-px h-5 bg-red-500/30 mx-1"></div>

              <button
                onClick={() => onNavigateTab('parity')}
                className="inline-flex items-center space-x-1 text-xs font-bold text-red-300 hover:text-white bg-red-500/20 hover:bg-red-500/30 px-3 py-1.5 rounded-lg transition-all"
              >
                <span>View Full Screen</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
            {paginatedIssues.map((issue: any) => (
              <div key={issue.id} className="p-3.5 rounded-xl bg-slate-900/90 border border-red-500/20 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-red-400">{issue.title}</span>
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-red-500/20 text-red-300 font-bold">
                    {issue.type}
                  </span>
                </div>
                <p className="text-xs text-slate-300">{issue.description}</p>
                <div className="text-[11px] font-mono text-slate-400 truncate">
                  Source: <span className="text-slate-200">{issue.sourceUrl}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* GSC Integration */}
      <div className="pt-2">
        <GscIntegration
          onDataFetched={onMergeGscData}
          isConnected={isGscConnected}
          onConnected={onGscConnected}
        />
      </div>

      {/* Quick Launch Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
        <button
          onClick={() => onNavigateTab('mapping')}
          className="p-5 rounded-2xl bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-brand-500/40 text-left transition-all group cursor-pointer"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="p-2.5 rounded-xl bg-brand-500/10 text-brand-400 group-hover:bg-brand-500/20 transition-colors">
              <Layers className="h-5 w-5" />
            </div>
            <ArrowRight className="h-4 w-4 text-slate-500 group-hover:text-brand-400 transform group-hover:translate-x-1 transition-all" />
          </div>
          <h4 className="text-sm font-bold text-white">Review 301 URL Mappings</h4>
          <p className="text-xs text-slate-400 mt-1">Audit individual redirects, manually remap paths, or assign 410 Gone status.</p>
        </button>

        <button
          onClick={() => onNavigateTab('parity')}
          className="p-5 rounded-2xl bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-amber-500/40 text-left transition-all group cursor-pointer"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 group-hover:bg-amber-500/20 transition-colors">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <ArrowRight className="h-4 w-4 text-slate-500 group-hover:text-amber-400 transform group-hover:translate-x-1 transition-all" />
          </div>
          <h4 className="text-sm font-bold text-white">SEO Parity Inspector</h4>
          <p className="text-xs text-slate-400 mt-1">Compare side-by-side title tags, H1s, canonicals, and word count deltas.</p>
        </button>

        <button
          onClick={onOpenExport}
          className="p-5 rounded-2xl bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-teal-500/40 text-left transition-all group cursor-pointer"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="p-2.5 rounded-xl bg-teal-500/10 text-teal-400 group-hover:bg-teal-500/20 transition-colors">
              <FileCode2 className="h-5 w-5" />
            </div>
            <ArrowRight className="h-4 w-4 text-slate-500 group-hover:text-teal-400 transform group-hover:translate-x-1 transition-all" />
          </div>
          <h4 className="text-sm font-bold text-white">Export Server Configurations</h4>
          <p className="text-xs text-slate-400 mt-1">Generate ready-to-deploy Apache .htaccess, Nginx, Cloudflare CSV, and Vercel rules.</p>
        </button>
      </div>
    </div>
  );
};
