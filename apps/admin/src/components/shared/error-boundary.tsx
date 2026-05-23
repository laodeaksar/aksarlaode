import { Component, Fragment, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode; fallback?: ReactNode };
type State = { error: Error | null; info: ErrorInfo | null; attempt: number };

// ── Global Error Boundary ──────────────────────────────────────────────────
// FIX ADM-07: Prevents a single crashed component from blanking the entire
// admin panel. Renders a dismissible error card so the user can see what
// went wrong and try to recover.
// Also catches errors thrown from Effect-powered server functions —
// the `_tag` property on tagged errors is displayed in the message.
//
// Reset strategy: `attempt` increments on every reset. The children are
// wrapped in a keyed Fragment — when the key changes React fully unmounts
// and remounts the subtree, so a reset genuinely retries the render rather
// than immediately re-throwing the same error from a stale closure.

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null, info: null, attempt: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ info });
    if (import.meta.env.DEV) {
      console.error("[ErrorBoundary]", error, info.componentStack);
    }
  }

  reset = () =>
    this.setState((s) => ({ error: null, info: null, attempt: s.attempt + 1 }));

  override render() {
    const { error, info, attempt } = this.state;

    if (error) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex min-h-[200px] flex-col items-center justify-center rounded-xl border border-red-200 bg-red-50 p-8 text-center">
          <p className="mb-1 text-base font-semibold text-red-700">
            Something went wrong
          </p>
          <p className="mb-4 max-w-sm text-sm text-red-600">{error.message}</p>

          {import.meta.env.DEV && (
            <details className="mb-4 w-full max-w-lg text-left">
              <summary className="cursor-pointer text-xs font-medium text-red-500 hover:text-red-700">
                Stack trace (dev only)
              </summary>
              <pre className="mt-2 overflow-auto rounded bg-red-100 p-3 text-xs text-red-800 whitespace-pre-wrap">
                {error.stack}
                {info?.componentStack && (
                  <>
                    {"\n\nComponent stack:"}
                    {info.componentStack}
                  </>
                )}
              </pre>
            </details>
          )}

          <button
            onClick={this.reset}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
          >
            Try again
          </button>
        </div>
      );
    }

    return <Fragment key={attempt}>{this.props.children}</Fragment>;
  }
}
