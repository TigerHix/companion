import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";


interface Props {
  children: ReactNode;
  /** Optional label shown in the error UI (e.g. section name) */
  label?: string;
}

interface State {
  hasError: boolean;
}

/**
 * Catches render errors within a section and displays a compact fallback,
 * preventing a single broken section from crashing the entire app.
 */
export class SectionErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error(error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="px-4 py-3 border-b border-border">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-destructive">
              {this.props.label ? `${this.props.label} failed to load` : "Section failed to load"}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="h-auto bg-accent px-2 py-0.5 text-[10px] text-muted-foreground"
              onClick={() => this.setState({ hasError: false })}
            >
              Retry
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
