import * as React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<any, any> {
  state = {
    hasError: false,
    error: null
  };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-bg-main flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-bg-sidebar border border-missed p-8 gold-top-border">
            <h1 className="text-missed text-3xl mb-4 uppercase">SYSTEM FAILURE</h1>
            <p className="font-mono text-text-main mb-6 uppercase">AN UNEXPECTED ERROR OCCURRED IN THE FORGE.</p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full bg-gold text-bg-main font-bebas text-xl py-3 tracking-widest"
            >
              REBOOT SYSTEM
            </button>
          </div>
        </div>
      );
    }

    return (this as any).props.children;
  }
}
