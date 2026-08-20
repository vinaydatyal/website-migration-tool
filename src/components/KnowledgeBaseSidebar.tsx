import React, { useState, useEffect, useMemo } from 'react';
import { X, BookOpen, ChevronDown, ChevronRight, HelpCircle, Activity, Merge, Search, Server, Sparkles, AlertTriangle, ArrowRight } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  activeContext?: string;
}

export const KnowledgeBaseSidebar: React.FC<Props> = ({ isOpen, onClose, activeContext }) => {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    process: true,
  });
  const [searchQuery, setSearchQuery] = useState('');

  // Auto-expand based on activeContext
  useEffect(() => {
    if (activeContext) {
      setExpandedSections(prev => ({ ...prev, [activeContext]: true }));
    }
  }, [activeContext]);


  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const sections = [
    {
      id: 'process',
      title: 'How Website Migration Works',
      icon: Activity,
      keywords: ['process', 'how to', 'screaming frog', 'crawl', 'map urls', 'redirects', 'audit'],
      content: (
        <div className="space-y-4 text-sm text-slate-600 dark:text-slate-300">
          <p>Website migration involves moving your legacy website to a new environment without losing your hard-earned SEO rankings. Here is the general process:</p>
          <ol className="list-decimal pl-5 space-y-3">
            <li><strong>Crawl the Legacy Site:</strong> Use a tool like Screaming Frog to crawl your existing live website and extract all URLs, metadata, and traffic metrics.</li>
            <li><strong>Crawl the Staging Site:</strong> Crawl the new development (staging) version of the website.</li>
            <li><strong>Map the URLs:</strong> Match the old legacy URLs to the new staging URLs so search engines know where the content moved (using 301 redirects).</li>
            <li><strong>Audit for SEO Parity:</strong> Ensure the new pages haven't lost important SEO value (like H1s, Titles, Indexability, Canonical tags, or Word Count).</li>
            <li><strong>Implement Redirects:</strong> Export the redirect map and provide it to your developers to implement in `.htaccess`, Nginx, or via a CMS plugin.</li>
          </ol>
        </div>
      )
    },
    {
      id: 'features',
      title: 'Tool Features & Capabilities',
      icon: Sparkles,
      keywords: ['features', 'capabilities', 'smart matching', 'parity auditor', 'refresh', 'domain swap', 'regex', 'history'],
      content: (
        <div className="space-y-4 text-sm text-slate-600 dark:text-slate-300">
          <ul className="list-disc pl-5 space-y-3">
            <li><strong>Smart Matching Engine:</strong> Automatically maps legacy URLs to staging URLs based on exact paths, matching titles, or fuzzy token-based similarities.</li>
            <li><strong>SEO Parity Auditor:</strong> Automatically checks your mapped URLs for critical SEO drops (e.g., Target is a 404, missing H1, NOINDEX tag on target).</li>
            <li><strong>Incremental Target Refreshes (Smart Merge):</strong> When developers fix staging site issues, you can upload a fresh crawl. The tool merges the new data while preserving all your manual mapping approvals and custom edits.</li>
            <li><strong>Domain Swapping:</strong> Convert staging URLs (e.g., `staging.client.com`) to production URLs (e.g., `client.com`) with one click just before exporting.</li>
            <li><strong>Regex Synthesizer:</strong> Identifies URL pattern changes (like moving a directory) and generates Regex rules.</li>
            <li><strong>Version History & Snapshots:</strong> Automatically saves snapshots of your progress so you can rollback if a mistake is made.</li>
          </ul>
        </div>
      )
    },
    {
      id: 'workflow',
      title: 'The Standard Workflow',
      icon: Merge,
      keywords: ['workflow', 'steps', 'start project', 'review', 'export', 'refresh target data'],
      content: (
        <div className="space-y-4 text-sm text-slate-600 dark:text-slate-300">
          <ol className="list-decimal pl-5 space-y-3">
            <li><strong>Start Project:</strong> Upload your legacy site crawl (source) and the new staging site crawl (target) from Screaming Frog.</li>
            <li><strong>Map URLs:</strong> The tool will automatically match URLs. Go to the "Mapping Table" to manually approve matches or override them.</li>
            <li><strong>Review Parity Warnings:</strong> Check the "SEO Parity" tab to ensure the new site isn't missing Critical SEO elements (like canonicals or indexability).</li>
            <li><strong>Refresh Target Data:</strong> As developers fix issues on staging, use the "Refresh Target Data" button on the Dashboard to upload new staging crawls. This preserves your work while updating the parity checks!</li>
            <li><strong>Domain Swap:</strong> Right before launch, use "Swap Domain" to change the staging URLs to production URLs in bulk.</li>
            <li><strong>Export:</strong> Download your final Redirect Map as a CSV.</li>
          </ol>
          <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700/50">
            <button className="flex items-center gap-2 text-sm font-semibold text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 transition-colors" onClick={onClose}>
              Go to Dashboard <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )
    },
    {
      id: 'matching',
      title: 'How Smart Matching Works',
      icon: Search,
      keywords: ['smart matching', 'algorithm', 'exact path', 'exact title', 'fuzzy match', 'jaccard', 'levenshtein', 'confidence score', 'needs review'],
      content: (
        <div className="space-y-4 text-sm text-slate-600 dark:text-slate-300">
          <p>The tool uses a multi-tier algorithm to find the best match for every legacy URL:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong className="text-brand-500">Exact Path:</strong> The URLs have the exact same slug. (High Confidence)</li>
            <li><strong className="text-emerald-500">Exact Title/H1:</strong> The slug changed, but the Title or H1 tags match perfectly. (Medium/High Confidence)</li>
            <li className="relative group">
              <strong className="text-teal-500 border-b border-dashed border-teal-500/50 cursor-help">Fuzzy Match:</strong> The tool uses token-based Jaccard similarity and Levenshtein distance on URL paths, Titles, and H1s to guess the best match. (Variable Confidence)
              {/* Tooltip */}
              <div className="absolute left-0 bottom-full mb-2 w-64 p-2 bg-slate-800 text-xs text-white rounded shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 pointer-events-none">
                Jaccard measures similarity based on shared words. Levenshtein measures how many character edits it takes to change one string into another.
              </div>
            </li>
          </ul>
          <p className="mt-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg text-xs">
            <strong>Confidence Score:</strong> If the confidence score is below your threshold (default 75%), the URL is flagged as "Needs Review".
          </p>
        </div>
      )
    },
    {
      id: 'parity',
      title: 'SEO Parity Warnings',
      icon: Server,
      keywords: ['parity', 'seo warnings', 'critical', 'high', '404', 'noindex', 'missing h1'],
      content: (
        <div className="space-y-4 text-sm text-slate-600 dark:text-slate-300">
          <p>Parity warnings alert you if the Target page is missing SEO value that the Source page had.</p>
          
          <div className="space-y-3 mt-3">
            <div className="p-3 border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 rounded-lg">
              <h4 className="font-bold text-red-600 dark:text-red-400 mb-1 flex items-center gap-2">Critical</h4>
              <p className="text-xs">These will cause de-indexing or broken links. Examples: Target is a 404, Target has a NOINDEX tag, Target canonical points to the wrong domain.</p>
            </div>
            
            <div className="p-3 border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 rounded-lg">
              <h4 className="font-bold text-amber-600 dark:text-amber-400 mb-1 flex items-center gap-2">High</h4>
              <p className="text-xs">Significant SEO equity loss. Examples: Missing H1, drastically shorter Word Count, Title tags stripped of keywords.</p>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700/50">
            <button className="flex items-center gap-2 text-sm font-semibold text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 transition-colors" onClick={onClose}>
              Go to SEO Parity View <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )
    },
    {
      id: 'manual',
      title: 'What Still Needs To Be Done Manually',
      icon: AlertTriangle,
      keywords: ['manual', 'needs review', 'unmapped', '410', 'discrepancies', 'developer', 'server implementation'],
      content: (
        <div className="space-y-4 text-sm text-slate-600 dark:text-slate-300">
          <p>While this tool automates the heavy lifting of matching and auditing, the following tasks require human expertise:</p>
          <ul className="list-disc pl-5 space-y-3">
            <li><strong className="text-brand-500">Reviewing "Needs Review" URLs:</strong> You must manually verify URLs where the tool's confidence score was below the threshold. Approve them or assign a custom target.</li>
            <li><strong className="text-amber-500">Resolving "Unmapped" URLs:</strong> For URLs the tool couldn't find a match for, you must manually hunt down the appropriate target page on the new site or intentionally mark them as <strong>410 (Gone)</strong>.</li>
            <li><strong className="text-red-500">Fixing Parity Discrepancies:</strong> The tool only highlights SEO issues. You must take the Parity Audit report to the development team or content team so they can actually fix the missing titles, H1s, or canonicals on the staging site.</li>
            <li><strong className="text-slate-700 dark:text-slate-200">Server Implementation:</strong> The tool exports a redirect map (CSV, .htaccess), but you still need a developer to upload and apply these redirects to the live server environment.</li>
          </ul>
        </div>
      )
    },
    {
      id: 'faq',
      title: 'Frequently Asked Questions (FAQ)',
      icon: HelpCircle,
      keywords: ['faq', 'questions', 'override target', 'refresh staging', 'unmapped', 'regex', 'rules', 'gsc', 'search console', '410', 'export'],
      content: (
        <div className="space-y-6 text-sm text-slate-600 dark:text-slate-300">
          
          <div>
            <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-1">How does the GSC Integration work?</h4>
            <p>You can upload a Google Search Console (GSC) export for your legacy site. The tool merges this data to show Clicks and Impressions for each URL, helping you prioritize the highest-traffic pages when mapping.</p>
          </div>

          <div>
            <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-1">What do I do with URLs marked as "410 (Gone)"?</h4>
            <p>If a legacy page has no equivalent on the new site and you want search engines to drop it immediately, map it to 410. This is an explicit signal that the page is permanently deleted.</p>
          </div>

          <div>
            <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-1">How do I manually override a bad match?</h4>
            <p>In the "Mapping Table" tab, find the row and click "Override Target" in the Actions column. You can paste the exact URL of the new target page.</p>
          </div>

          <div>
            <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-1">The developers updated the staging site, do I have to start over?</h4>
            <p>No! Go to the Dashboard and click <strong className="text-brand-500">Refresh Target Data</strong>. Upload the new crawl. The tool will "Smart Merge" the data—preserving your manual approvals, custom targets, and notes while updating the parity warnings.</p>
          </div>

          <div>
            <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-1">What does "Unmapped" mean?</h4>
            <p>It means the tool couldn't find any target page that matched the source page well enough. You must manually override the target, or hide it if it's intentionally deleted (returning a 410).</p>
          </div>
          
          <div>
            <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-1">How do I generate regex rules?</h4>
            <p>The "Regex Synthesizer" tab analyzes your matched URLs to find common folder structures (e.g., `/blog/2023/` moving to `/insights/`). It auto-generates regex redirect rules that you can export for the developer's `.htaccess` or Nginx config.</p>
          </div>

          <div>
            <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-1">Can I export my project and come back later?</h4>
            <p>Yes, the application automatically saves your progress locally. You can also manually download a Snapshot (JSON) file and re-load it later, or export a CSV Redirect Map when you're finished.</p>
          </div>

        </div>
      )
    }
  ];

  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return sections;
    const query = searchQuery.toLowerCase();
    return sections.filter(s => 
      s.title.toLowerCase().includes(query) || 
      s.keywords.some(k => k.toLowerCase().includes(query))
    );
  }, [searchQuery, sections]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-950/20 backdrop-blur-sm z-[70] transition-opacity duration-300" 
        onClick={onClose}
      />

      {/* Sidebar */}
      <div className="fixed inset-y-0 right-0 w-[450px] max-w-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl z-[80] flex flex-col transform transition-transform duration-300 ease-in-out">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-brand-500">
              <BookOpen className="h-5 w-5" />
              <h2 className="font-bold text-slate-800 dark:text-white">Knowledge Base & Help</h2>
            </div>
            <button 
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-slate-400" />
            </div>
            <input
              type="text"
              placeholder="Search help topics..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:text-slate-200 placeholder-slate-400 transition-shadow"
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          
          {/* Intro */}
          {!searchQuery && (
            <div className="p-6 pb-2">
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Welcome to the Agency Migration Tool! This knowledge base contains everything you need to know about navigating the application, understanding the data, and completing a successful SEO migration.
              </p>
            </div>
          )}

          <div className="mt-4 pb-12">
            {filteredSections.map((section) => {
              const Icon = section.icon;
              const isExpanded = expandedSections[section.id] || (searchQuery.trim().length > 0);
              
              return (
                <div key={section.id} className="border-t border-slate-200 dark:border-slate-700/50">
                  <button 
                    onClick={() => toggleSection(section.id)}
                    className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 rounded-lg bg-brand-500/10 text-brand-500">
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">{section.title}</span>
                    </div>
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-slate-400 transition-transform" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-slate-400 transition-transform" />
                    )}
                  </button>
                  
                  {/* CSS Grid Animation for Accordion */}
                  <div 
                    className={`grid transition-all duration-300 ease-in-out ${isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
                  >
                    <div className="overflow-hidden">
                      <div className="p-5 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
                        {section.content}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredSections.length === 0 && (
              <div className="p-8 text-center text-slate-500 dark:text-slate-400">
                <Search className="h-8 w-8 mx-auto mb-3 opacity-50" />
                <p>No results found for "{searchQuery}"</p>
                <button 
                  onClick={() => setSearchQuery('')}
                  className="mt-2 text-sm text-brand-500 hover:underline"
                >
                  Clear search
                </button>
              </div>
            )}
          </div>

        </div>
      </div>
    </>
  );
};
