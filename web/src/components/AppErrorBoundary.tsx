import type { ReactNode } from "react";
import { Component } from "react";
import { Button } from "@/components/ui/button";


interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class AppErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error(error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-[100dvh] flex items-center justify-center bg-background text-foreground px-4">
          <div className="max-w-md w-full rounded-xl border border-border bg-card p-5 shadow-sm">
            <h1 className="text-base font-semibold">A runtime error occurred</h1>
            <p className="text-sm text-muted-foreground mt-2">
              Reload the page to recover. The error has been reported.
            </p>
            <Button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 bg-primary text-sm text-white hover:bg-primary/90"
            >
              Reload
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
