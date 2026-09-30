import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error inside ErrorBoundary:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-6 text-center space-y-4 bg-apple-secondary dark:bg-[#1a1a1b] rounded-2xl border border-apple-primary/10 transition-colors duration-200">
          <div className="p-3.5 bg-red-500/10 text-red-500 rounded-full border border-red-500/20">
            <svg className="w-8 h-8 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-sm font-black text-apple-primary">เกิดข้อผิดพลาดในการโหลดส่วนนี้</h3>
          <p className="text-xs text-apple-secondary max-w-md leading-relaxed">
            {this.state.error?.message || "เกิดข้อผิดพลาดในการประมวลผลของหน้าจอ กรุณาลองใหม่อีกครั้ง"}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-5 py-2.5 bg-neutral-900 dark:bg-white text-white dark:text-black text-xs font-bold rounded-xl transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
          >
            ลองใหม่อีกครั้ง
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
