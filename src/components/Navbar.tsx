import React from 'react';
import { 
  ShieldCheck, 
  Sparkles, 
  RefreshCw, 
  Download, 
  AlertTriangle,
  Layers,
  FolderOpen,
  History,
  Save,
  Network,
  Sun,
  Moon,
  HelpCircle,
  Database,
  Server
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { slugify } from '../utils/text';
import { MigrationSummaryStats } from '../types/migration';
import { useTheme } from '../contexts/ThemeContext';

interface NavbarProps {
  stats: MigrationSummaryStats | null;
  onLoadSample: () => void;
  onReset: () => void;
  onRestartPipeline?: () => void;
  onOpenExport: () => void;
  onOpenImportMap?: () => void;
  onOpenHistory: () => void;
  onOpenProjectManager: () => void;
  onOpenHelp: () => void;
  onNewProject: () => void;
  hasData: boolean;
  projectName?: string;
  setProjectName?: (name: string) => void;
  onSaveVersion?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  stats,
  onLoadSample,
  onReset,
  onRestartPipeline,
  onOpenExport,
  onOpenImportMap,
  onOpenHistory,
  onOpenProjectManager,
  onOpenHelp,
  onNewProject,
  hasData,
  projectName = 'Untitled Project',
  setProjectName,
  onSaveVersion,
}) => {
  const [isEditingName, setIsEditingName] = React.useState(false);
  const nameInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
    }
  }, [isEditingName]);

  const location = useLocation();
  const pathParts = location.pathname.split('/').filter(Boolean);
  const activeTab = pathParts.length > 1 ? pathParts[1] : 'dashboard';
  const projectSlug = slugify(projectName || 'Untitled Project');
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-950/80 backdrop-blur-md transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left: Branding & Project */}
          <div className="flex-shrink-0 flex items-center justify-start space-x-4">
            
            {/* Projects Button */}
            <button 
              onClick={onOpenProjectManager}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-brand-600 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-all cursor-pointer shadow-sm"
              title="Open Project Manager"
            >
              <FolderOpen className="h-5 w-5" />
            </button>

            {/* App Logo */}
            <div className="flex items-center space-x-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-brand-500 to-brand-400 dark:from-brand-600 dark:to-brand-400 flex items-center justify-center shadow-lg shadow-brand-500/20">
                <ShieldCheck className="h-6 w-6 text-slate-950 stroke-[2.5]" />
              </div>
              
              {/* Editable Project Name */}
              <div className="flex flex-col justify-center">
                <div className="flex items-center space-x-1.5 group">
                  {isEditingName ? (
                    <input
                      ref={nameInputRef}
                      type="text"
                      value={projectName}
                      onChange={(e) => setProjectName?.(e.target.value)}
                      onBlur={() => setIsEditingName(false)}
                      onKeyDown={(e) => e.key === 'Enter' && setIsEditingName(false)}
                      className="text-lg font-bold tracking-tight text-slate-900 dark:text-white font-sans bg-white dark:bg-slate-900 border border-brand-500 rounded px-1.5 py-0 focus:outline-none w-48 shadow-sm"
                    />
                  ) : (
                    <span 
                      onClick={() => setIsEditingName(true)}
                      className="text-lg font-bold tracking-tight text-slate-900 dark:text-white font-sans cursor-text hover:text-brand-600 dark:hover:text-brand-300 transition-colors px-1 border border-transparent rounded hover:bg-slate-100 dark:hover:bg-slate-800/50 truncate max-w-[150px] lg:max-w-[250px]"
                      title="Click to rename project"
                    >
                      {projectName}
                    </span>
                  )}
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider border border-slate-200 dark:border-transparent">
                    Autosaved
                  </span>
                </div>
                <div className="flex items-center space-x-1.5 px-1">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-brand-500">MigrateShield Pro</span>
                </div>
              </div>
            </div>
          </div>

          {/* Center Navigation Tabs (when data is loaded) */}
          {hasData && (
            <div className="flex-1 flex justify-center hidden lg:flex px-4 min-w-0">
              <nav className="flex items-center space-x-1 bg-slate-100/80 dark:bg-slate-900/90 p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-inner overflow-x-auto no-scrollbar">
              <Link
                to={`/${projectSlug}/dashboard`}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'dashboard'
                    ? 'bg-brand-500 text-white dark:text-slate-950 shadow-md shadow-brand-500/20'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
                }`}
              >
                Overview
              </Link>
              <Link
                to={`/${projectSlug}/mapping`}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all ${
                  activeTab === 'mapping'
                    ? 'bg-brand-500 text-white dark:text-slate-950 shadow-md shadow-brand-500/20'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
                }`}
              >
                <Layers className="h-3.5 w-3.5" />
                <span>301 Mapping Grid</span>
                {stats && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    activeTab === 'mapping' ? 'bg-white/30 dark:bg-slate-950/20 text-white dark:text-slate-950 font-bold' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}>
                    {stats.totalSourceUrls}
                  </span>
                )}
              </Link>
              <Link
                to={`/${projectSlug}/parity`}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all ${
                  activeTab === 'parity'
                    ? 'bg-brand-500 text-white dark:text-slate-950 shadow-md shadow-brand-500/20'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
                }`}
              >
                <AlertTriangle className={`h-3.5 w-3.5 ${activeTab === 'parity' ? 'text-amber-200 dark:text-amber-600' : 'text-amber-500 dark:text-amber-400'}`} />
                <span>SEO Parity Audit</span>
                {stats && stats.criticalDiscrepanciesCount > 0 && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-300 border border-red-200 dark:border-red-500/30 font-mono font-bold">
                    {stats.criticalDiscrepanciesCount}
                  </span>
                )}
              </Link>
              <Link
                to={`/${projectSlug}/architecture`}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all ${
                  activeTab === 'architecture'
                    ? 'bg-brand-500 text-white dark:text-slate-950 shadow-md shadow-brand-500/20'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
                }`}
              >
                <Network className="h-3.5 w-3.5" />
                <span>Architecture</span>
              </Link>
              <Link
                to={`/${projectSlug}/infrastructure`}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all ${
                  activeTab === 'infrastructure'
                    ? 'bg-brand-500 text-white dark:text-slate-950 shadow-md shadow-brand-500/20'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
                }`}
              >
                <Server className="h-3.5 w-3.5" />
                <span>Tech & Infra</span>
              </Link>
              <Link
                to={`/${projectSlug}/crawl-data`}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all ${
                  activeTab === 'crawl-data'
                    ? 'bg-brand-500 text-white dark:text-slate-950 shadow-md shadow-brand-500/20'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
                }`}
              >
                <Database className="h-3.5 w-3.5" />
                <span>Crawl Data</span>
              </Link>
              <Link
                to={`/${projectSlug}/regex`}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'regex'
                    ? 'bg-brand-500 text-white dark:text-slate-950 shadow-md shadow-brand-500/20'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
                }`}
              >
                Regex
              </Link>
              <Link
                to={`/${projectSlug}/playbook`}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all ${
                  activeTab === 'playbook'
                    ? 'bg-brand-500 text-white dark:text-slate-950 shadow-md shadow-brand-500/20'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
                }`}
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Playbook</span>
              </Link>
              <Link
                to={`/${projectSlug}/validation`}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all ${
                  activeTab === 'validation'
                    ? 'bg-brand-500 text-white dark:text-slate-950 shadow-md shadow-brand-500/20'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
                }`}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Validation</span>
              </Link>
              <Link
                to={`/${projectSlug}/link-audit`}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'link-audit'
                    ? 'bg-brand-500 text-white dark:text-slate-950 shadow-md shadow-brand-500/20'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
                }`}
              >
                Link Audit
              </Link>
            </nav>
            </div>
          )}

          {/* Right: Actions */}
          <div className="flex-shrink-0 flex items-center justify-end space-x-2.5 ml-auto">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg text-slate-500 hover:text-brand-600 dark:text-slate-400 dark:hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors mr-2"
              title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            >
              {theme === 'light' ? (
                <Moon className="h-5 w-5" />
              ) : (
                <Sun className="h-5 w-5" />
              )}
            </button>
            
            <button
              onClick={onOpenHelp}
              className="p-2 rounded-lg text-slate-500 hover:text-brand-600 dark:text-slate-400 dark:hover:text-brand-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors mr-2 flex items-center justify-center"
              title="Help & Knowledge Base"
            >
              <HelpCircle className="h-5 w-5" />
            </button>
            
            {!hasData ? (
              <button
                onClick={onLoadSample}
                className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-xs font-bold bg-brand-50 text-brand-600 border border-brand-200 hover:bg-brand-100 dark:bg-brand-500/10 dark:text-brand-400 dark:border-brand-500/30 dark:hover:bg-brand-500/20 transition-all cursor-pointer shadow-sm"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Load Sample Crawls</span>
              </button>
            ) : (
              <>
                <div className="flex items-center space-x-1 border-r border-slate-200 dark:border-slate-800 pr-2 mr-1">
                  <button
                    onClick={onSaveVersion}
                    className="p-2 rounded-lg text-slate-500 hover:text-brand-600 hover:bg-brand-50 dark:text-slate-400 dark:hover:text-brand-400 dark:hover:bg-brand-500/10 transition-all cursor-pointer"
                    title="Save Version (Snapshot)"
                  >
                    <Save className="h-4 w-4" />
                  </button>
                  <button
                    onClick={onOpenHistory}
                    className="p-2 rounded-lg text-slate-500 hover:text-amber-600 hover:bg-amber-50 dark:text-slate-400 dark:hover:text-amber-400 dark:hover:bg-amber-500/10 transition-all cursor-pointer"
                    title="View Versions History"
                  >
                    <History className="h-4 w-4" />
                  </button>
                </div>
                <button
                  onClick={onReset}
                  className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-200 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800/80 transition-all"
                  title="Upload New Crawls"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
                {onRestartPipeline && (
                  <button
                    onClick={onRestartPipeline}
                    className="p-2 rounded-lg text-brand-600 hover:text-brand-700 hover:bg-brand-50 border border-transparent hover:border-brand-200 dark:text-brand-400 dark:hover:text-brand-300 dark:hover:bg-brand-500/10 dark:hover:border-brand-500/30 transition-all"
                    title="Re-run Matching Algorithm"
                  >
                    <Sparkles className="h-4 w-4" />
                  </button>
                )}

                {onOpenImportMap && (
                  <button
                    onClick={onOpenImportMap}
                    className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer mr-2"
                  >
                    <Download className="h-3.5 w-3.5 stroke-[2.5] rotate-180" />
                    <span>Import Map</span>
                  </button>
                )}

                <button
                  onClick={onOpenExport}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-brand-500 hover:bg-brand-600 text-white dark:bg-gradient-to-r dark:from-brand-500 dark:to-emerald-500 dark:text-slate-950 dark:hover:from-brand-400 dark:hover:to-emerald-400 shadow-md shadow-brand-500/20 transition-all cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5 stroke-[2.5]" />
                  <span>Export Redirects</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
