import React, { useState, useEffect } from 'react';
import { ShieldCheck, LogIn, Database, CheckCircle2, AlertCircle, RefreshCw, BarChart } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface GoogleIntegrationsProps {
  onDataFetched: (gscData: any[], ga4Data: any[]) => void;
  isConnected: boolean;
  onConnected: () => void;
}

export const GoogleIntegrations: React.FC<GoogleIntegrationsProps> = ({ 
  onDataFetched, 
  isConnected,
  onConnected 
}) => {
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isFetchingSites, setIsFetchingSites] = useState(false);
  const [isFetchingData, setIsFetchingData] = useState(false);
  
  const [sites, setSites] = useState<string[]>([]);
  const [selectedSite, setSelectedSite] = useState<string>('');
  
  const [ga4Properties, setGa4Properties] = useState<any[]>([]);
  const [selectedGa4Property, setSelectedGa4Property] = useState<string>('');
  
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.data?.type === 'GSC_AUTH_SUCCESS') {
        setIsAuthenticating(false);
        onConnected();
        toast.success('Successfully connected to Google Accounts');
        fetchSitesAndProperties();
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onConnected]);

  useEffect(() => {
    if (isConnected && sites.length === 0 && !isFetchingSites) {
      fetchSitesAndProperties();
    }
  }, [isConnected]);

  const handleConnect = async () => {
    try {
      setIsAuthenticating(true);
      setError(null);
      const res = await fetch('/api/gsc/auth');
      const data = await res.json();
      
      if (data.error) {
        throw new Error(data.error);
      }

      const width = 600;
      const height = 600;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;
      window.open(
        data.url, 
        'GSC_Auth', 
        `width=${width},height=${height},left=${left},top=${top}`
      );
    } catch (err: any) {
      setError(err.message);
      setIsAuthenticating(false);
      toast.error('Failed to initiate Google connection');
    }
  };

  const fetchSitesAndProperties = async () => {
    try {
      setIsFetchingSites(true);
      
      const [gscRes, ga4Res] = await Promise.all([
        fetch('/api/gsc/sites').then(res => res.json()).catch(() => ({})),
        fetch('/api/ga4/properties').then(res => res.json()).catch(() => ({}))
      ]);
      
      if (gscRes.sites) {
        setSites(gscRes.sites);
        if (gscRes.sites.length > 0) setSelectedSite(gscRes.sites[0]);
      }
      
      if (ga4Res.properties) {
        setGa4Properties(ga4Res.properties);
        if (ga4Res.properties.length > 0) setSelectedGa4Property(ga4Res.properties[0].id);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsFetchingSites(false);
    }
  };

  const handleFetchData = async () => {
    if (!selectedSite && !selectedGa4Property) return;
    
    try {
      setIsFetchingData(true);
      setError(null);
      
      let gscData: any[] = [];
      let ga4Data: any[] = [];
      
      if (selectedSite) {
        const res = await fetch('/api/gsc/data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ siteUrl: selectedSite })
        });
        const json = await res.json();
        if (json.error) throw new Error(json.error);
        gscData = json.data || [];
      }
      
      if (selectedGa4Property) {
        const res = await fetch('/api/ga4/data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ propertyId: selectedGa4Property })
        });
        const json = await res.json();
        if (json.error) throw new Error(json.error);
        ga4Data = json.data || [];
      }
      
      toast.success(`Fetched metrics (GSC: ${gscData.length} URLs, GA4: ${ga4Data.length} URLs)`);
      onDataFetched(gscData, ga4Data);
    } catch (err: any) {
      setError(err.message);
      toast.error('Failed to fetch analytics data');
    } finally {
      setIsFetchingData(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center space-x-2">
            <Database className="h-5 w-5 text-brand-500" />
            <span>Google Analytics & Search Console</span>
          </h3>
          <p className="text-sm text-slate-400 mt-1">
            Connect your Google accounts to enrich source URLs with real clicks, impressions, sessions, and revenue data.
          </p>
        </div>
        <div className={`px-3 py-1 rounded-full text-xs font-bold border ${
          isConnected ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-slate-800 text-slate-400 border-slate-700'
        }`}>
          {isConnected ? 'Connected' : 'Not Connected'}
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-start space-x-3">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!isConnected ? (
        <div className="flex flex-col items-center justify-center py-8 px-4 border-2 border-dashed border-slate-800 rounded-xl bg-slate-900/50">
          <div className="h-16 w-16 rounded-full bg-brand-500/10 flex items-center justify-center mb-4">
            <ShieldCheck className="h-8 w-8 text-brand-500" />
          </div>
          <button
            onClick={handleConnect}
            disabled={isAuthenticating}
            className="flex items-center space-x-2 px-6 py-2.5 bg-brand-500 hover:bg-brand-400 text-slate-950 font-bold rounded-xl transition-all disabled:opacity-50"
          >
            {isAuthenticating ? (
              <RefreshCw className="h-5 w-5 animate-spin" />
            ) : (
              <LogIn className="h-5 w-5" />
            )}
            <span>{isAuthenticating ? 'Connecting...' : 'Connect Google Account'}</span>
          </button>
          <p className="text-xs text-slate-500 mt-4 text-center max-w-sm">
            You will be securely redirected to Google to authorize read-only access to your Search Console and GA4 properties.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                Select GSC Property
              </label>
              {isFetchingSites ? (
                <div className="flex items-center space-x-2 text-slate-400 text-sm py-2">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Loading properties...</span>
                </div>
              ) : (
                <select
                  value={selectedSite}
                  onChange={(e) => setSelectedSite(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                >
                  <option value="">Skip GSC (None)</option>
                  {sites.map(site => (
                    <option key={site} value={site}>{site}</option>
                  ))}
                </select>
              )}
            </div>
            
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                Select GA4 Property
              </label>
              {isFetchingSites ? (
                <div className="flex items-center space-x-2 text-slate-400 text-sm py-2">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Loading properties...</span>
                </div>
              ) : ga4Properties.length === 0 ? (
                <select disabled className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-slate-500">
                  <option>No GA4 Properties Found</option>
                </select>
              ) : (
                <select
                  value={selectedGa4Property}
                  onChange={(e) => setSelectedGa4Property(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                >
                  <option value="">Skip GA4 (None)</option>
                  {ga4Properties.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.account})</option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex items-end">
              <button
                onClick={handleFetchData}
                disabled={(!selectedSite && !selectedGa4Property) || isFetchingData}
                className="w-full flex justify-center items-center space-x-2 px-6 py-2 bg-brand-500 hover:bg-brand-400 text-slate-950 font-bold rounded-lg transition-all disabled:opacity-50"
              >
                {isFetchingData ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Pulling Data...</span>
                  </>
                ) : (
                  <>
                    <BarChart className="h-4 w-4" />
                    <span>Fetch Traffic Metrics</span>
                  </>
                )}
              </button>
            </div>
          </div>
          
          <div className="mt-4 p-4 rounded-lg bg-emerald-500/5 border border-emerald-500/10 flex items-start space-x-3 text-emerald-400/80">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <p className="text-sm">
              Metrics will automatically be merged into your <strong>Source URLs</strong> data. 
              High-traffic unmapped pages will be heavily penalized in Risk Score algorithms.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
