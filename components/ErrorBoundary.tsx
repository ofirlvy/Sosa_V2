import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
}

export class CardErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-red-50 rounded-[24px] border border-red-200 p-4 text-center">
          <AlertTriangle size={24} className="text-red-400 mb-2" />
          <p className="text-[13px] font-medium text-red-600">Card failed to render</p>
          <button
            className="mt-2 text-[11px] text-red-500 underline"
            onClick={() => this.setState({ hasError: false })}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// App-level boundary so a single render error can never blank the whole app.
// Shows a recoverable fallback instead of an empty/gray screen.
export class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: any) {
    console.error('App render error:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-screen flex flex-col items-center justify-center bg-[#F9F8F6] p-6 text-center">
          <AlertTriangle size={28} className="text-[#5F2427] mb-3" />
          <p className="text-[15px] font-bold text-[#5F2427] mb-1">Something went wrong</p>
          <p className="text-[13px] text-gray-500 mb-4 max-w-sm">Your data is safe. Reloading usually fixes this.</p>
          <button
            className="h-10 px-5 rounded-xl bg-[#5F2427] text-[#FCCAE2] font-semibold text-[13px] hover:bg-[#4a1c1e] transition-colors"
            onClick={() => window.location.reload()}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
