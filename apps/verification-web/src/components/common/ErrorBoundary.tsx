import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught React Error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 max-w-4xl mx-auto my-8 bg-rose-50 border border-rose-200 rounded-2xl shadow-sm text-slate-800 space-y-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-8 h-8 text-rose-600" />
            <div>
              <h2 className="text-lg font-bold text-rose-900">Application Error Caught</h2>
              <p className="text-xs text-rose-700">An unexpected error occurred during rendering.</p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-rose-200 font-mono text-xs text-rose-900 overflow-x-auto">
            <strong>{this.state.error?.name}: </strong> {this.state.error?.message}
          </div>

          {this.state.errorInfo && (
            <details className="bg-slate-900 text-slate-200 p-4 rounded-xl text-[11px] font-mono whitespace-pre-wrap overflow-x-auto">
              <summary className="cursor-pointer text-amber-400 font-bold mb-2">Component Stack Trace</summary>
              {this.state.errorInfo.componentStack}
            </details>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-rose-700 text-white rounded-lg text-xs font-semibold hover:bg-rose-800 flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Reload Page</span>
            </button>
            <button
              onClick={() => {
                localStorage.clear();
                window.location.href = '/#officer';
                window.location.reload();
              }}
              className="px-4 py-2 bg-slate-800 text-white rounded-lg text-xs font-semibold hover:bg-slate-900"
            >
              Reset Local Storage & Reload
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
