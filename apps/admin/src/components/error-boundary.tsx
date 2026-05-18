import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode; fallback?: ReactNode };
type State = { error: Error | null };

// ── Global Error Boundary ──────────────────────────────────────────────────
// FIX ADM-07: Prevents a single crashed component from blanking the entire
// admin panel. Renders a dismissible error card so the user can see what
// went wrong and try to recover.
// Also catches errors thrown from Effect-powered server functions —
// the `_tag` property on tagged errors is displayed in the message.

export class ErrorBoundary extends Component<Props, State> {
  // `state` IS declared as `state: Readonly<S>` in Component — needs override.
  override state: State = { error: null };

  // getDerivedStateFromError lives on ComponentClass interface, not Component class —
  // TypeScript treats it as not-in-base, so omit `override`.
  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  // componentDidCatch IS declared in the ComponentLifecycle interface.
  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  override render() {
    const { error } = this.state;

    if (error) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex min-h-[200px] flex-col items-center justify-center rounded-xl border border-red-200 bg-red-50 p-8 text-center">
          <p className="mb-1 text-base font-semibold text-red-700">
            Something went wrong
          </p>
          <p className="mb-4 max-w-sm text-sm text-red-600">{error.message}</p>
          <button
            onClick={this.reset}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors"
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
