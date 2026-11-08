import { Component, type ReactNode } from "react";

/**
 * Catches a failed lazy-loaded screen (typically: a phone still holding an old cached app after a
 * deploy, or a flaky connection) and offers a one-tap fix instead of a dead page.
 */
interface State {
  failed: boolean;
}

declare global {
  interface Window {
    mmRecover?: (force?: boolean) => boolean;
  }
}

const CHUNK_RE = /dynamically imported module|importing a module script|loading chunk|loading css chunk|unable to preload/i;

export default class RouteErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    const msg = (error as Error)?.message ?? String(error);
    // Stale/missing script after a deploy: clear the old cache and reload once, automatically.
    if (CHUNK_RE.test(msg)) window.mmRecover?.(false);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="mx-auto flex max-w-sm flex-col items-center gap-3 py-20 text-center">
        <p style={{ fontWeight: 700, fontSize: 16 }}>This page didn&apos;t finish loading</p>
        <p style={{ fontSize: 13, opacity: 0.7 }}>
          Your connection may have dropped, or the app was just updated. Tap below to refresh it.
        </p>
        <button
          onClick={() => (window.mmRecover ? window.mmRecover(true) : window.location.reload())}
          className="rounded-xl px-5 py-2.5 text-sm font-bold"
          style={{ backgroundColor: "#8A5CFF", color: "#fff" }}
        >
          Refresh
        </button>
      </div>
    );
  }
}
