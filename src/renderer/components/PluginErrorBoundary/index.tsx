import React, { Component } from 'react';
import s from './index.module.css';

interface Props {
  pluginId: string;
  pluginName?: string;
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Per-window error boundary. Catches React render errors in plugin
 * components so a crash in one window does NOT unmount the entire
 * React tree — only the crashed window shows an error state.
 */
export default class PluginErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error(
      `[PluginErrorBoundary] Plugin "${this.props.pluginId}" crashed:`,
      error,
      '\nComponent stack:', info.componentStack,
    );
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  handleClose = (): void => {
    // Let the parent close the window via its own mechanism
    this.setState({ hasError: false, error: null });
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className={s.crash}>
          <div className={s.icon}>⚠</div>
          <div className={s.title}>App Crashed</div>
          <div className={s.subtitle}>
            {this.props.pluginName || this.props.pluginId} encountered an error
          </div>
          {this.state.error && (
            <div className={s.errorMessage}>{this.state.error.message}</div>
          )}
          <button className={s.retryBtn} onClick={this.handleRetry}>
            Reload
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
