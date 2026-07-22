/**
 * Fail-silent React error boundary for the injected panel UI. If any child
 * throws during render/commit, we render NOTHING and log at debug — never let a
 * UI crash surface into YouTube's page (CLAUDE.md "fail silently"). An error
 * boundary must be a class component; this is the only one in the extension.
 */
import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class FailSilentBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.debug("[channelwatch] panel render error (suppressed)", error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}
