import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

// Without this, an uncaught render error unmounts the whole app and leaves
// just the bare page background — no message, no way back in, just a
// frozen-looking screen until the user figures out to reload.
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error(error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
          <div className="text-5xl">😔</div>
          <h1 className="text-xl font-bold">حدث خطأ غير متوقع</h1>
          <p className="text-[var(--color-ink-dim)]">جرب إعادة تحميل الصفحة، وإذا استمرت المشكلة أخبرنا.</p>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>
            إعادة تحميل
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
