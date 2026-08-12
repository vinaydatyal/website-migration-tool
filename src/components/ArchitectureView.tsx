import React, { useMemo, useState } from 'react';
import { CrawlEntry } from '../types/migration';
import { Network, Folder, FolderOpen, FileText, AlertTriangle, ArrowRight, ChevronRight, ChevronDown } from 'lucide-react';

interface ArchitectureViewProps {
  sourceEntries: CrawlEntry[];
  targetEntries: CrawlEntry[];
  mappings?: import('../types/migration').UrlMapping[];
}

interface TreeNode {
  name: string;
  path: string;
  children: Map<string, TreeNode>;
  files: import('../types/migration').UrlMapping[];
  sourceCount: number;
  targetCount: number;
}

export const ArchitectureView: React.FC<ArchitectureViewProps> = ({ sourceEntries, targetEntries, mappings = [] }) => {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['/']));
  const [folderPages, setFolderPages] = useState<Record<string, number>>({});
  
  const PAGE_SIZE = 50;

  const toggleNode = (path: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const tree = useMemo(() => {
    const root: TreeNode = { name: '/', path: '/', children: new Map(), files: [], sourceCount: 0, targetCount: 0 };

    // Initialize counts from entries just to ensure accurate folder counts
    const addCountToTree = (entry: CrawlEntry, isSource: boolean) => {
      let path = entry.normalizedPath || '/';
      if (!path.startsWith('/')) path = '/' + path;
      
      const segments = path.split('/').filter(Boolean);
      let current = root;
      
      if (isSource) current.sourceCount++;
      else current.targetCount++;

      let currentPath = '';

      for (const segment of segments) {
        currentPath += '/' + segment;
        if (!current.children.has(segment)) {
          current.children.set(segment, {
            name: segment,
            path: currentPath,
            children: new Map(),
            files: [],
            sourceCount: 0,
            targetCount: 0
          });
        }
        current = current.children.get(segment)!;
        if (isSource) current.sourceCount++;
        else current.targetCount++;
      }
    };

    sourceEntries.forEach(e => addCountToTree(e, true));
    targetEntries.forEach(e => addCountToTree(e, false));

    // Attach mappings as files to their respective folders
    mappings.forEach(m => {
      let path = m.source.normalizedPath || '/';
      if (!path.startsWith('/')) path = '/' + path;
      
      const segments = path.split('/').filter(Boolean);
      // If it's the root itself, meaning segments is empty
      if (segments.length === 0) {
        root.files.push(m);
        return;
      }
      
      let current = root;
      // We don't add the file as a segment in the tree structure (since it's a leaf),
      // we navigate to the folder (all segments except the last one), or we navigate to all segments.
      // Wait, normalizedPath could be something like /blog/article-1. If we split by /, we get ['blog', 'article-1'].
      // If article-1 is not a directory but a page, we should attach it to the 'blog' folder.
      // However, the tree treats everything as a segment. 
      // To keep it simple, we attach the file to the exact node that matches its full path.
      for (const segment of segments) {
        if (!current.children.has(segment)) {
            // Shouldn't happen if we initialized counts above, but just in case
            current.children.set(segment, { name: segment, path: current.path + '/' + segment, children: new Map(), files: [], sourceCount: 0, targetCount: 0 });
        }
        current = current.children.get(segment)!;
      }
      current.files.push(m);
    });

    return root;
  }, [sourceEntries, targetEntries, mappings]);

  const renderTree = (node: TreeNode, depth: number = 0) => {
    const isExpanded = expandedNodes.has(node.path);
    const hasChildren = node.children.size > 0;
    const isOrphaned = node.sourceCount > 0 && node.targetCount === 0;
    
    // Sort children: directories first, then alphabetical
    const sortedChildren = Array.from(node.children.values()).sort((a, b) => {
      const aHasChildren = a.children.size > 0;
      const bHasChildren = b.children.size > 0;
      if (aHasChildren && !bHasChildren) return -1;
      if (!aHasChildren && bHasChildren) return 1;
      return a.name.localeCompare(b.name);
    });

    return (
      <div key={node.path} className="font-mono text-sm">
        <div 
          className={`flex items-center py-1.5 px-2 rounded-lg cursor-pointer transition-colors group ${
            isOrphaned ? 'bg-amber-100 dark:bg-amber-500/10 hover:bg-amber-200 dark:hover:bg-amber-500/20' : 'hover:bg-slate-100 dark:hover:bg-slate-800/50'
          }`}
          style={{ paddingLeft: `${Math.max(0.5, depth * 1.5)}rem` }}
          onClick={() => hasChildren && toggleNode(node.path)}
        >
          <div className="flex items-center space-x-2 flex-1">
            {hasChildren ? (
              <button className="text-slate-400 dark:text-slate-500 hover:text-brand-600 dark:hover:text-brand-400">
                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
            ) : (
              <span className="w-4" />
            )}
            
            {hasChildren ? (
              isExpanded ? <FolderOpen className="h-4 w-4 text-brand-500 dark:text-brand-400" /> : <Folder className="h-4 w-4 text-brand-400 dark:text-brand-500/70" />
            ) : (
              <FileText className="h-4 w-4 text-slate-400 dark:text-slate-500" />
            )}
            
            <span className={isOrphaned ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-slate-800 dark:text-slate-300'}>
              {node.name}
            </span>

            {isOrphaned && (
              <span className="ml-2 px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-500/20 text-[10px] text-amber-700 dark:text-amber-300 font-bold flex items-center border border-amber-200 dark:border-amber-500/30">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Missing on Target
              </span>
            )}
          </div>

          <div className="flex items-center space-x-6 text-xs w-48 justify-end">
            <span className={`w-16 text-right ${node.sourceCount > 0 ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400 dark:text-slate-600'}`}>
              {node.sourceCount} URLs
            </span>
            <span className={`w-16 text-right ${node.targetCount > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-600'}`}>
              {node.targetCount} URLs
            </span>
          </div>
        </div>

        {isExpanded && hasChildren && (
          <div>
            {sortedChildren.map(child => renderTree(child, depth + 1))}
          </div>
        )}

        {isExpanded && node.files.length > 0 && (
          <div>
            {(() => {
              const currentPage = folderPages[node.path] || 1;
              const totalPages = Math.ceil(node.files.length / PAGE_SIZE);
              const paginatedFiles = node.files.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
              
              return (
                <>
                  {paginatedFiles.map(file => (
              <div 
                key={file.id} 
                className="flex items-start py-2 px-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group border-t border-slate-100 dark:border-slate-800/50"
                style={{ paddingLeft: `${Math.max(0.5, (depth + 1) * 1.5)}rem` }}
              >
                <div className="flex-1 min-w-0 pr-4">
                  <div className="flex items-center space-x-2">
                    <FileText className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                    <span className="text-slate-700 dark:text-slate-300 truncate font-semibold text-xs">
                      {file.source.url}
                    </span>
                    {file.discrepancies.length > 0 && (
                      <div className="flex space-x-1">
                        {file.discrepancies.map(d => (
                          <span 
                            key={d.id} 
                            title={d.description}
                            className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                              d.severity === 'CRITICAL' ? 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-300 border border-red-200 dark:border-red-500/30' :
                              d.severity === 'HIGH' ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30' :
                              'bg-teal-100 dark:bg-teal-500/20 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-500/30'
                            }`}
                          >
                            {d.type.replace(/_/g, ' ')}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-500 mt-1 truncate pl-5 flex flex-col space-y-1">
                    <div className="flex gap-4">
                      <div className="flex-1 overflow-hidden truncate">
                        <span className="text-slate-600 dark:text-slate-400 font-semibold">Title:</span> {file.source.title}
                        {file.target && file.target.title !== file.source.title && (
                          <span className="text-amber-600 dark:text-amber-400 ml-2">→ {file.target.title}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <div className="flex-1 overflow-hidden truncate">
                        <span className="text-slate-600 dark:text-slate-400 font-semibold">Desc:</span> {file.source.metaDescription || 'None'}
                        {file.target && file.target.metaDescription !== file.source.metaDescription && (
                          <span className="text-amber-600 dark:text-amber-400 ml-2">→ {file.target.metaDescription || 'None'}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-4 text-[9px]">
                      <div className="flex-1 overflow-hidden truncate">
                        <span className="text-slate-600 dark:text-slate-400 font-semibold">Canonical:</span> {file.source.canonical || 'None'}
                        {file.target && file.target.canonical !== file.source.canonical && (
                          <span className="text-amber-600 dark:text-amber-400 ml-2">→ {file.target.canonical || 'None'}</span>
                        )}
                      </div>
                      <div className="flex-1 overflow-hidden truncate">
                        <span className="text-slate-600 dark:text-slate-400 font-semibold">Robots:</span> {file.source.metaRobots || 'None'}
                        {file.target && file.target.metaRobots !== file.source.metaRobots && (
                          <span className="text-amber-600 dark:text-amber-400 ml-2">→ {file.target.metaRobots || 'None'}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="w-1/3 min-w-0 text-xs flex items-start mt-0.5">
                  <ArrowRight className="h-3.5 w-3.5 text-brand-500/50 mr-2 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className={`truncate ${file.status === 'GONE_410' ? 'text-slate-400 dark:text-slate-500 line-through' : 'text-emerald-600 dark:text-emerald-400 font-semibold'}`}>
                      {file.status === 'GONE_410' ? '410 GONE' : (file.target ? file.target.normalizedPath : file.targetUrl || 'Unmapped')}
                    </div>
                  </div>
                </div>
              </div>
            ))}
              
              {totalPages > 1 && (
                <div 
                  className="flex items-center justify-between py-2 px-4 border-t border-slate-200 dark:border-slate-800/50 text-xs bg-slate-50 dark:bg-slate-900/30"
                  style={{ paddingLeft: `${Math.max(0.5, (depth + 1) * 1.5)}rem` }}
                >
                  <div className="text-slate-500">
                    Showing {(currentPage - 1) * PAGE_SIZE + 1} to {Math.min(currentPage * PAGE_SIZE, node.files.length)} of {node.files.length} URLs
                  </div>
                  <div className="flex items-center space-x-2">
                    <button 
                      onClick={() => setFolderPages(prev => ({...prev, [node.path]: Math.max(1, currentPage - 1)}))}
                      disabled={currentPage === 1}
                      className="px-2 py-1 rounded bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-transparent hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Prev
                    </button>
                    <span className="text-slate-600 dark:text-slate-400 font-semibold px-2">
                      {currentPage} / {totalPages}
                    </span>
                    <button 
                      onClick={() => setFolderPages(prev => ({...prev, [node.path]: Math.min(totalPages, currentPage + 1)}))}
                      disabled={currentPage === totalPages}
                      className="px-2 py-1 rounded bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-transparent hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          );
        })()}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-3 shadow-sm">
        <div className="flex items-center space-x-2.5">
          <div className="p-2.5 rounded-xl bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400">
            <Network className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Visual Site Architecture Diff</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Compare the folder structure of your Old Site against your New Site. 
              <span className="text-amber-600 dark:text-amber-400 font-semibold ml-1">Yellow folders indicate orphaned directory structures.</span>
            </p>
          </div>
        </div>
      </div>

      <div className="p-6 rounded-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-500 uppercase tracking-wider">
          <div className="flex-1">Directory Structure</div>
          <div className="flex items-center space-x-6 w-48 justify-end">
            <span className="w-16 text-right">Source</span>
            <span className="w-16 text-right">Target</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[600px]">
            {renderTree(tree)}
          </div>
        </div>
      </div>
    </div>
  );
};
