import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<
  { children: ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'An unexpected error occurred.',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Application ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="relative z-10 flex min-h-[100dvh] items-center justify-center bg-[#241209] p-6 text-[#f7ecdc]">
          <div className="w-full max-w-md rounded-2xl border border-[#e4c29b]/40 foam-paper p-6 text-center text-[#241209] shadow-2xl">
            <h1 className="text-xl font-semibold">Something went wrong</h1>
            <p className="mt-2 text-sm text-[#6b3f24]">
              Please refresh the page to continue. If this persists, check your
              connection and try again.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 inline-flex min-h-[44px] items-center justify-center rounded-xl bg-[#4a2a1a] px-5 py-2.5 text-sm font-semibold text-[#f7ecdc] hover:bg-[#361c10]"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
