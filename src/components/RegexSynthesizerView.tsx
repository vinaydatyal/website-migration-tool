import React, { useState, useMemo } from 'react';
import { 
  FileCode2, 
  Sparkles, 
  ArrowRight, 
  ToggleLeft,
  ToggleRight,
  Play,
  Plus,
  Trash2,
  Eye,
  Info,
  CheckCircle2,
  Check,
  AlertTriangle
} from 'lucide-react';
import { SynthesizedPattern, UrlMapping } from '../types/migration';
import { toast } from 'sonner';

interface RegexSynthesizerViewProps {
  patterns: SynthesizedPattern[];
  mappings: UrlMapping[];
  onTogglePattern: (id: string) => void;
  onAddCustomPattern: (pattern: SynthesizedPattern) => void;
  onDeleteCustomPattern: (id: string) => void;
}

const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const isDangerousRegex = (pattern: string): boolean => {
  // Catch simple nested quantifiers which are a primary cause of ReDoS
  const dangerousPatterns = [
    /(\([^)]+[*+?]+\)+[*+?]+)/, // Nested grouping quantifiers
    /\[[^\]]+\][*+?]+\s*[*+?]+/, // Nested bracket quantifiers
    /[*+?]{2,}/ // Consecutive quantifiers like ++, *+, etc.
  ];
  return dangerousPatterns.some(regex => regex.test(pattern));
};

export const RegexSynthesizerView: React.FC<RegexSynthesizerViewProps> = ({
  patterns,
  mappings,
  onTogglePattern,
  onAddCustomPattern,
  onDeleteCustomPattern
}) => {
  // Sandbox State
  const [testInput, setTestInput] = useState('/blog/2022/10/how-to-train-for-first-marathon');
  
  // Visual Builder State
  const [matchType, setMatchType] = useState<'STARTS_WITH' | 'ENDS_WITH' | 'CONTAINS' | 'EXACT_REGEX'>('STARTS_WITH');
  const [searchStr, setSearchStr] = useState('');
  const [targetStr, setTargetStr] = useState('');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  // Evaluate the test input dynamically against active patterns
  const testMatch = useMemo(() => {
    if (!testInput) return null;
    
    let result = testInput;
    let matchedRule: SynthesizedPattern | null = null;

    for (const p of patterns.filter(p => p.isActive)) {
      try {
        const regex = new RegExp(p.sourcePattern);
        if (regex.test(result)) {
          result = result.replace(regex, p.targetPattern);
          matchedRule = p;
          break;
        }
      } catch (e) {
        // Ignore invalid regex in user rules
      }
    }

    return { result, matchedRule };
  }, [testInput, patterns]);

  // Compile visual rule into real regex
  const getCompiledPatterns = () => {
    let sourcePattern = '';
    if (matchType === 'STARTS_WITH') sourcePattern = `^${escapeRegex(searchStr)}`;
    else if (matchType === 'ENDS_WITH') sourcePattern = `${escapeRegex(searchStr)}$`;
    else if (matchType === 'CONTAINS') sourcePattern = escapeRegex(searchStr);
    else if (matchType === 'EXACT_REGEX') {
      if (isDangerousRegex(searchStr)) {
        throw new Error('Potentially dangerous regex (ReDoS risk)');
      }
      sourcePattern = searchStr;
    }

    return { sourcePattern, targetPattern: targetStr };
  };

  const previewMappings = useMemo(() => {
    if (!searchStr) return [];
    let sourcePattern, targetPattern;
    try {
      const compiled = getCompiledPatterns();
      sourcePattern = compiled.sourcePattern;
      targetPattern = compiled.targetPattern;
    } catch (e) {
      return [];
    }
    let regex: RegExp;
    try {
      regex = new RegExp(sourcePattern);
    } catch {
      return [];
    }

    const matches = mappings.filter(m => regex.test(m.source.normalizedPath));
    return matches.slice(0, 5).map(m => ({
      original: m.source.normalizedPath,
      transformed: m.source.normalizedPath.replace(regex, targetPattern)
    }));
  }, [mappings, matchType, searchStr, targetStr]);

  const totalAffected = useMemo(() => {
    if (!searchStr) return 0;
    let sourcePattern;
    try {
      const compiled = getCompiledPatterns();
      sourcePattern = compiled.sourcePattern;
    } catch (e) {
      return 0;
    }
    try {
      const regex = new RegExp(sourcePattern);
      return mappings.filter(m => regex.test(m.source.normalizedPath)).length;
    } catch {
      return 0;
    }
  }, [mappings, matchType, searchStr]);

  const handleSaveRule = () => {
    if (!searchStr || !targetStr) return;
    let sourcePattern, targetPattern;
    try {
      const compiled = getCompiledPatterns();
      sourcePattern = compiled.sourcePattern;
      targetPattern = compiled.targetPattern;
    } catch (e: any) {
      toast.error(e.message || 'Invalid pattern');
      return;
    }
    
    // Test if valid regex
    try {
      new RegExp(sourcePattern);
    } catch {
      toast.error('Invalid Regex Syntax');
      return;
    }

    const newPattern: SynthesizedPattern = {
      id: crypto.randomUUID(),
      name: `Custom Rule: ${searchStr}`,
      sourcePattern,
      targetPattern,
      affectedCount: totalAffected,
      sampleSource: previewMappings[0]?.original || '/example',
      sampleTarget: previewMappings[0]?.transformed || '/example-target',
      isActive: true,
      type: 'CUSTOM'
    };

    onAddCustomPattern(newPattern);
    setSearchStr('');
    setTargetStr('');
  };

  const totalPages = Math.ceil(patterns.length / itemsPerPage);
  const paginatedPatterns = patterns.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
        <div className="flex items-center space-x-2.5">
          <div className="p-2.5 rounded-xl bg-brand-500/10 text-brand-400">
            <FileCode2 className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Regex Pattern Synthesizer</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Automatically compresses repetitive shifts into clean rewrite rules, or build your own custom rules visually.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        
        {/* Left Column: Rules List & Sandbox */}
        <div className="xl:col-span-7 space-y-6">
          
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <Play className="h-4 w-4 text-brand-400" />
              <span>Interactive Regex Tester</span>
            </h3>
            <div className="flex flex-col space-y-3">
              <input
                type="text"
                value={testInput}
                onChange={(e) => setTestInput(e.target.value)}
                placeholder="Type an old URL path (e.g., /blog/article-1)..."
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-white focus:outline-none focus:border-brand-500/50"
              />
            </div>
            {testMatch && (
              <div className={`p-4 rounded-xl border font-mono text-xs transition-colors ${
                testMatch.matchedRule 
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-slate-950 border-slate-800 text-slate-400'
              }`}>
                {testMatch.matchedRule ? (
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2 text-emerald-400 font-bold mb-1">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Match Found! ({testMatch.matchedRule.name})</span>
                    </div>
                    <div>
                      <span className="text-emerald-500/70">Output URL: </span>
                      {testMatch.result}
                    </div>
                  </div>
                ) : (
                  <div>
                    <span className="text-slate-500">No active regex rule matched. Will fallback to specific 1-to-1 301 line.</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-4">
            {paginatedPatterns.length === 0 ? (
              <div className="p-12 text-center rounded-2xl border border-slate-800 bg-slate-900/40 space-y-2">
                <Sparkles className="h-8 w-8 text-slate-500 mx-auto" />
                <h4 className="text-sm font-bold text-white">No Patterns Active</h4>
              </div>
            ) : (
              paginatedPatterns.map((pattern) => (
                <div 
                  key={pattern.id}
                  className={`p-4 rounded-2xl border transition-all ${
                    pattern.isActive ? 'bg-slate-900/90 border-slate-700' : 'bg-slate-950/40 border-slate-800/60 opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => onTogglePattern(pattern.id)}
                        className="text-brand-400 hover:text-brand-300"
                      >
                        {pattern.isActive ? <ToggleRight className="h-6 w-6" /> : <ToggleLeft className="h-6 w-6 text-slate-500" />}
                      </button>
                      <h4 className="text-sm font-bold text-white">{pattern.name}</h4>
                      {pattern.type === 'CUSTOM' && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                          CUSTOM
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      <span className="text-xs font-mono text-brand-300">
                        ~{pattern.affectedCount} URLs
                      </span>
                      {pattern.type === 'CUSTOM' && (
                        <button onClick={() => onDeleteCustomPattern(pattern.id)} className="text-slate-500 hover:text-red-400 p-1">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3 font-mono text-xs">
                    <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80">
                      <span className="text-[10px] text-slate-500 block mb-1">Source Regex:</span>
                      <span className="text-amber-300 break-all">{pattern.sourcePattern}</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80">
                      <span className="text-[10px] text-slate-500 block mb-1">Target Replacement:</span>
                      <span className="text-emerald-300 break-all">{pattern.targetPattern}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between p-4 rounded-xl bg-slate-900/60 border border-slate-800">
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-50">Previous</button>
              <span className="text-xs font-mono text-slate-400">Page {currentPage} / {totalPages}</span>
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-50">Next</button>
            </div>
          )}
        </div>

        {/* Right Column: Visual Rule Builder */}
        <div className="xl:col-span-5">
          <div className="sticky top-24 space-y-4">
            <div className="p-5 rounded-2xl bg-slate-900 border border-brand-500/30 shadow-[0_0_30px_-10px_rgba(16,185,129,0.1)]">
              <h3 className="text-sm font-bold text-white mb-4 flex items-center space-x-2">
                <Sparkles className="h-4 w-4 text-brand-400" />
                <span>Visual Rule Builder</span>
              </h3>
              
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Condition</label>
                  <select 
                    value={matchType}
                    onChange={(e) => setMatchType(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm font-semibold text-white focus:outline-none focus:border-brand-500/50"
                  >
                    <option value="STARTS_WITH">Path Starts With</option>
                    <option value="ENDS_WITH">Path Ends With</option>
                    <option value="CONTAINS">Path Contains</option>
                    <option value="EXACT_REGEX">Custom Regex (Advanced)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Search String</label>
                  <input
                    type="text"
                    value={searchStr}
                    onChange={(e) => setSearchStr(e.target.value)}
                    placeholder={matchType === 'EXACT_REGEX' ? "^/blog/(.*)" : "/blog/"}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm font-mono text-amber-300 focus:outline-none focus:border-amber-500/50"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Replacement</label>
                  <input
                    type="text"
                    value={targetStr}
                    onChange={(e) => setTargetStr(e.target.value)}
                    placeholder={matchType === 'EXACT_REGEX' ? "/archive/$1" : "/archive/"}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm font-mono text-emerald-300 focus:outline-none focus:border-emerald-500/50"
                  />
                </div>

                <button
                  onClick={handleSaveRule}
                  disabled={!searchStr || !targetStr}
                  className="w-full py-2.5 mt-2 rounded-lg text-sm font-bold bg-brand-600 text-white hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center space-x-2"
                >
                  <Plus className="h-4 w-4" />
                  <span>Save Rule</span>
                </button>
              </div>
            </div>

            {/* Live Preview Box */}
            <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800">
              <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between mb-4">
                <span className="flex items-center space-x-2">
                  <Eye className="h-3.5 w-3.5" />
                  <span>Live Preview</span>
                </span>
                {totalAffected > 0 && (
                  <span className="bg-brand-500/20 text-brand-300 px-2 py-0.5 rounded-full border border-brand-500/30">
                    {totalAffected} URLs Affected
                  </span>
                )}
              </h3>
              
              {!searchStr ? (
                <div className="text-center py-6 text-slate-500 flex flex-col items-center space-y-2">
                  <Info className="h-6 w-6 opacity-40" />
                  <p className="text-xs">Type a search string to see affected URLs.</p>
                </div>
              ) : previewMappings.length === 0 ? (
                <div className="text-center py-6 text-slate-500 text-xs">
                  No URLs match this condition.
                </div>
              ) : (
                <div className="space-y-3">
                  {previewMappings.map((preview, i) => (
                    <div key={i} className="text-[10px] font-mono bg-slate-900/50 p-2.5 rounded-lg border border-slate-800/80">
                      <div className="text-slate-400 truncate">{preview.original}</div>
                      <ArrowRight className="h-3 w-3 text-brand-500 my-1 ml-1" />
                      <div className="text-emerald-400 font-bold truncate">{preview.transformed}</div>
                    </div>
                  ))}
                  {totalAffected > 5 && (
                    <div className="text-[10px] text-center font-bold text-slate-500 pt-1">
                      + {totalAffected - 5} more URLs...
                    </div>
                  )}
                </div>
              )}
            </div>
            
          </div>
        </div>
      </div>
    </div>
  );
};
