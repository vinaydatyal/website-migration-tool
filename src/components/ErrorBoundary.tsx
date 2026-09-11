import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertOctagon, RefreshCw, Trash2, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class GlobalErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by GlobalErrorBoundary:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleHardReload = () => {
    window.location.reload();
  };

  private handleClearDataAndReset = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {
      console.warn('Could not clear storage', e);
    }
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6 font-sans">
          <div className="max-w-xl w-full bg-slate-900/90 border border-red-500/30 rounded-3xl p-8 shadow-2xl backdrop-blur-md space-y-6">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400">
                <AlertOctagon className="h-8 w-8" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Something went wrong</h1>
                <p className="text-sm text-slate-400">
                  The application encountered an unexpected runtime error.
                </p>
              </div>
            </div>

            {this.state.error && (
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 overflow-x-auto text-xs font-mono text-red-300">
                <p className="font-semibold">{this.state.error.name}: {this.state.error.message}</p>
                {this.state.errorInfo?.componentStack && (
                  <pre className="mt-2 text-slate-500 text-[11px] whitespace-pre-wrap">
                    {this.state.errorInfo.componentStack.slice(0, 500)}
                  </pre>
                )}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={this.handleHardReload}
                className="flex-1 flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl bg-brand-500 hover:bg-brand-600 text-slate-950 font-semibold transition-all shadow-lg shadow-brand-500/20 cursor-pointer"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Reload Page</span>
              </button>

              <button
                onClick={this.handleClearDataAndReset}
                className="flex-1 flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium transition-all cursor-pointer"
              >
                <Trash2 className="h-4 w-4 text-slate-400" />
                <span>Clear Cache & Reset</span>
              </button>

              <a
                href="/"
                className="flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium transition-all cursor-pointer"
              >
                <Home className="h-4 w-4 text-slate-400" />
                <span>Home</span>
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
