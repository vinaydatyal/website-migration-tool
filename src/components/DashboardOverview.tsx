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
  Loader2,
  Activity,
  Milestone,
  RefreshCw
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

  const totalIssuePages = Math.ceil(criticalIssues.length / (issuesPerPage || 1)) || 1;
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
        projectMetadata: { projectName: 'Migration Audit' },
        criticalIssues: criticalIssues
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
      
      toast.success('PDF Generated successfully!', { id: 'pdf-toast' });
    } catch (error: any) {
      toast.error(error.message || 'Error generating PDF', { id: 'pdf-toast' });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Traffic Calculation Logic
  const currentTraffic = mappings.reduce((acc, m) => {
    return acc + (m.source.clicks || m.source.sessions || m.source.visits || 0);
  }, 0);

  const hasTrafficData = isGscConnected || currentTraffic > 0;
  const upliftPercentage = ((stats.readinessScore - 50) / 100) * 0.4;
  const projectedTraffic = Math.round(currentTraffic * (1 + upliftPercentage));

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      {/* Top Header Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-500 dark:from-white dark:to-slate-400">Global Dashboard</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Real-time migration progress and technical SEO readiness.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={onSwapDomain}
            className="px-4 py-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-medium border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-2 shadow-sm"
          >
            <ArrowRightLeft className="w-4 h-4" />
            Swap Domain
          </button>
          <button 
            onClick={onUpdateTargetData}
            className="px-4 py-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-medium border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-2 shadow-sm"
          >
            <RefreshCw className="w-4 h-4" />
            Update Target Crawl
          </button>
          <button 
            onClick={handleDownloadPdf}
            disabled={isGeneratingPdf}
            className="px-4 py-2 bg-slate-900 dark:bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-slate-800 dark:hover:bg-brand-700 transition-all flex items-center gap-2 shadow-md dark:shadow-brand-500/20 disabled:opacity-50"
          >
            {isGeneratingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileCheck className="w-4 h-4" />}
            {isGeneratingPdf ? 'Generating...' : 'Executive Report (PDF)'}
          </button>
        </div>
      </div>

      {/* Main Grid: Using Glassmorphism */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Readiness Score Card */}
        <div className="lg:col-span-4 glass-panel glass-panel-hover rounded-2xl p-6 flex flex-col justify-between relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <ShieldCheck className="w-24 h-24 text-brand-500" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">SEO Readiness Score</span>
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${gradeInfo.bg} ${gradeInfo.color}`}>
                Grade {gradeInfo.grade}
              </span>
            </div>

            <div className="flex items-center space-x-6 my-4">
              <div className="relative flex items-center justify-center">
                <svg className="w-28 h-28 transform -rotate-90 drop-shadow-md">
                  <circle cx="56" cy="56" r="46" stroke="currentColor" strokeWidth="8" className="text-slate-200 dark:text-slate-800" fill="transparent" />
                  <circle cx="56" cy="56" r="46" stroke="currentColor" strokeWidth="8" strokeDasharray={289} strokeDashoffset={289 - (289 * stats.readinessScore) / 100} className={`${stats.readinessScore >= 75 ? 'text-brand-500' : stats.readinessScore >= 50 ? 'text-amber-500' : 'text-red-500'} transition-all duration-1000 ease-out`} strokeLinecap="round" fill="transparent" />
                </svg>
                <div className="absolute flex flex-col items-center">
                  <span className="text-3xl font-extrabold text-slate-800 dark:text-white font-mono">{stats.readinessScore}</span>
                </div>
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-800 dark:text-white leading-tight">{gradeInfo.text}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {stats.criticalDiscrepanciesCount === 0 
                    ? 'Zero critical blockers detected.' 
                    : `${stats.criticalDiscrepanciesCount} critical SEO risk(s) must be resolved.`}
                </p>
              </div>
            </div>
            
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Preserved Equity:</span>
              <span className="font-bold text-brand-600 dark:text-brand-400 font-mono">
                {stats.totalInlinksPreserved.toLocaleString()} inlinks
              </span>
            </div>
          </div>
        </div>

        {/* Traffic Impact Card */}
        <div className="lg:col-span-4 glass-panel glass-panel-hover rounded-2xl p-6 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">Projected Traffic Impact</span>
            <Activity className="w-5 h-5 text-cyan-500" />
          </div>
          
          {!hasTrafficData ? (
             <div className="flex-1 flex flex-col justify-center items-center text-center space-y-3">
               <AlertTriangle className="w-8 h-8 text-amber-500/50" />
               <p className="text-sm text-slate-500 dark:text-slate-400">
                 No traffic data found. Connect Google Search Console or ensure your crawl CSV includes traffic metrics (clicks/sessions).
               </p>
             </div>
          ) : (
            <div className="flex-1 flex flex-col justify-end relative">
              <div className="absolute inset-0 flex items-end opacity-20 dark:opacity-30">
                {/* Mock sparkline graph using SVG */}
                <svg viewBox="0 0 100 40" className="w-full h-full preserve-aspect-ratio-none stroke-cyan-500 fill-cyan-500/20">
                  <path d={upliftPercentage >= 0 ? "M0,40 L0,30 C20,25 30,35 50,20 C70,5 80,15 100,10 L100,40 Z" : "M0,10 L0,20 C20,15 30,25 50,20 C70,25 80,35 100,40 L100,40 Z"} />
                </svg>
              </div>
              <div className="relative z-10 space-y-4">
                <div>
                  <div className={`text-2xl font-bold font-mono ${upliftPercentage >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                    {upliftPercentage > 0 ? '+' : ''}{(upliftPercentage * 100).toFixed(1)}%
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Estimated Post-Launch {upliftPercentage >= 0 ? 'Uplift' : 'Drop'}</div>
                </div>
                <div className="flex gap-4">
                  <div>
                    <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">Current</div>
                    <div className="text-sm font-bold text-slate-800 dark:text-white">{currentTraffic.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">Projected</div>
                    <div className={`text-sm font-bold ${upliftPercentage >= 0 ? 'text-cyan-600 dark:text-cyan-400' : 'text-red-600 dark:text-red-400'}`}>
                      {projectedTraffic.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Recent Audit Summary Card */}
        <div className="lg:col-span-4 glass-panel glass-panel-hover rounded-2xl p-6 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">Recent Audit Summary</span>
            <Milestone className="w-5 h-5 text-indigo-500" />
          </div>
          <div className="space-y-4 flex-1">
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-500 dark:text-slate-400">Total Crawled Pages</span>
              <span className="text-sm font-bold text-slate-800 dark:text-white">{stats.totalSourceUrls}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-500 dark:text-slate-400">Successfully Mapped</span>
              <span className="text-sm font-bold text-brand-600 dark:text-brand-400">{stats.autoMatchedCount}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-500 dark:text-slate-400">Unmapped (Needs Action)</span>
              <span className="text-sm font-bold text-amber-600 dark:text-amber-400">{stats.unmappedCount}</span>
            </div>
            <div className="flex justify-between items-center pt-3 border-t border-slate-200 dark:border-slate-800">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Migration Status</span>
              <span className="text-xs px-2 py-1 bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-400 rounded-full font-bold">Active</span>
            </div>
          </div>
        </div>

      </div>

      {/* 4 Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="glass-panel glass-panel-hover rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-semibold">Source URLs</span>
            <Layers className="h-4 w-4 text-brand-500" />
          </div>
          <div>
            <div className="text-2xl font-extrabold text-slate-800 dark:text-white font-mono">{stats.totalSourceUrls}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Across legacy site</div>
          </div>
        </div>

        <div className="glass-panel glass-panel-hover rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-semibold">Auto-Matched</span>
            <CheckCircle2 className="h-4 w-4 text-brand-500" />
          </div>
          <div>
            <div className="text-2xl font-extrabold text-brand-600 dark:text-brand-400 font-mono">
              {stats.autoMatchedCount}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {Math.round((stats.autoMatchedCount / (stats.totalSourceUrls || 1)) * 100)}% coverage
            </div>
          </div>
        </div>

        <div className="glass-panel glass-panel-hover rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-semibold">Needs Review</span>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </div>
          <div>
            <div className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 font-mono">
              {stats.needsReviewCount}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {stats.unmappedCount} unmapped
            </div>
          </div>
        </div>

        <div className="glass-panel glass-panel-hover rounded-xl p-4 flex flex-col justify-between glow-danger border-red-200 dark:border-red-500/30">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-semibold">SEO Blockers</span>
            <AlertOctagon className="h-4 w-4 text-red-500" />
          </div>
          <div>
            <div className="text-2xl font-extrabold text-red-600 dark:text-red-400 font-mono">
              {stats.criticalDiscrepanciesCount}
            </div>
            <div className="text-[11px] text-red-500 dark:text-red-300/80 mt-0.5 font-medium">Critical Landmines</div>
          </div>
        </div>
      </div>

      {/* Critical SEO Risk Alerts Section */}
      {criticalIssues.length > 0 && (
        <div className="p-6 rounded-2xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-500/30 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400">
                <AlertOctagon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-red-900 dark:text-white">Critical SEO Landmines Detected ({criticalIssues.length})</h3>
                <p className="text-xs text-red-700 dark:text-red-300/80">These discrepancies will lead to de-indexing, broken links, or soft 404s if launched.</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setCurrentIssuePage(p => Math.max(1, p - 1))}
                disabled={currentIssuePage === 1}
                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-500/20 hover:bg-red-50 dark:hover:bg-red-500/20 disabled:opacity-50 transition-all shadow-sm"
              >
                Prev
              </button>
              <span className="text-xs font-mono text-red-700 dark:text-red-300/80 px-1">
                {currentIssuePage} / {totalIssuePages}
              </span>
              <button
                onClick={() => setCurrentIssuePage(p => Math.min(totalIssuePages, p + 1))}
                disabled={currentIssuePage === totalIssuePages}
                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-500/20 hover:bg-red-50 dark:hover:bg-red-500/20 disabled:opacity-50 transition-all shadow-sm"
              >
                Next
              </button>
              
              <div className="w-px h-5 bg-red-200 dark:bg-red-500/30 mx-1"></div>

              <button
                onClick={() => onNavigateTab('parity')}
                className="inline-flex items-center space-x-1 text-xs font-bold text-red-700 dark:text-red-300 bg-white dark:bg-red-500/20 border border-red-200 dark:border-transparent hover:bg-red-50 dark:hover:bg-red-500/30 px-3 py-1.5 rounded-lg transition-all shadow-sm"
              >
                <span>View Full Screen</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {paginatedIssues.map((issue: any, index: number) => (
              <div key={`${issue.id}-${index}`} className="p-4 rounded-xl bg-white dark:bg-slate-900/90 border border-red-100 dark:border-red-500/20 shadow-sm space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-red-700 dark:text-red-400">{issue.title}</span>
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-red-100 dark:bg-red-500/20 text-red-800 dark:text-red-300 font-bold">
                    {issue.type}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{issue.description}</p>
                <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate">
                  Source: <span className="text-slate-800 dark:text-slate-200">{issue.sourceUrl}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* GSC Integration & Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2">
        <div className="lg:col-span-8">
          <GscIntegration
            onDataFetched={onMergeGscData}
            isConnected={isGscConnected}
            onConnected={onGscConnected}
          />
        </div>
        <div className="lg:col-span-4 glass-panel rounded-2xl p-6 flex flex-col items-center justify-center">
          <div className="w-full flex items-center justify-between text-xs mb-4">
            <span className="font-semibold text-slate-600 dark:text-slate-300">Status Distribution</span>
          </div>
          <MappingStatusChart mappings={mappings} />
        </div>
      </div>
      
    </div>
  );
};
