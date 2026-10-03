import React, { ReactNode, ErrorInfo } from 'react';
import { RefreshCw, AlertTriangle, ArrowLeft } from 'lucide-react';

interface Props {
  children: ReactNode;
  onBackToStore?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  isRetrying: boolean;
}

export class PortalErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      isRetrying: false,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, isRetrying: false };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Portal Error Boundary caught:', error, errorInfo);
  }

  private handleReload = () => {
    this.setState({ isRetrying: true });
    window.location.reload();
  };

  private handleRetryInPlace = () => {
    this.setState({ hasError: false, error: null, isRetrying: false });
  };

  public render() {
    if (this.state.hasError) {
      const isDynamicImportError =
        this.state.error?.message?.includes('Failed to fetch dynamically imported module') ||
        this.state.error?.message?.includes('error loading dynamically imported module');

      return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mb-4 text-amber-600 shadow-sm">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">
            {isDynamicImportError ? 'New App Version Available' : 'Portal Loading Notice'}
          </h2>
          <p className="text-sm text-slate-600 max-w-md mb-6 leading-relaxed">
            {isDynamicImportError
              ? 'A fresh update was recently published. Please refresh to load the latest admin portal components.'
              : 'The portal encountered a temporary network glitch while loading. Please retry or return to the store.'}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={this.handleReload}
              disabled={this.state.isRetrying}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 text-white font-semibold text-sm hover:bg-slate-800 transition-colors shadow-sm active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${this.state.isRetrying ? 'animate-spin' : ''}`} />
              {this.state.isRetrying ? 'Updating...' : 'Reload Latest Version'}
            </button>

            <button
              onClick={this.handleRetryInPlace}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-semibold text-sm hover:bg-slate-100 transition-colors shadow-sm active:scale-95"
            >
              Retry
            </button>

            {this.props.onBackToStore && (
              <button
                onClick={this.props.onBackToStore}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-transparent text-slate-600 font-semibold text-sm hover:text-slate-900 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Store
              </button>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
