import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[400px] flex flex-col items-center justify-center p-8 text-center bg-slate-50 rounded-[2.5rem] border-2 border-dashed border-slate-200">
          <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mb-6">
            <AlertTriangle className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter italic mb-2">
            Algo deu errado
          </h2>
          <p className="text-sm font-bold text-slate-500 uppercase tracking-widest max-w-md mb-8">
            Ocorreu um erro ao carregar esta seção. Tente recarregar a página ou entre em contato com o suporte.
          </p>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 mb-8 w-full max-w-lg overflow-auto max-h-40">
            <code className="text-[10px] font-mono text-red-600 text-left block whitespace-pre-wrap">
              {this.state.error?.toString()}
            </code>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
          >
            <RefreshCw className="w-4 h-4" />
            Recarregar Página
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
