import { Component } from 'react';
import { Button } from './ui';

class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
        };
    }

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        this.setState({
            error,
            errorInfo,
        });
    }

    formatError(error) {
        if (!error) return null;

        if (error instanceof Error) {
            return {
                name: error.name || 'Error',
                message: error.message || 'No message provided',
                stack: error.stack || null,
            };
        }

        // Handle non-Error throws
        return {
            name: 'Thrown value',
            message: typeof error === 'string'
                ? error
                : JSON.stringify(error, null, 2),
            stack: null,
        };
    }

    handleReset = () => {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null,
        });
    };

    render() {
        if (this.state.hasError) {
            const formattedError = this.formatError(this.state.error);

            return (
                <div className="fixed inset-0 z-50 bg-black flex items-center justify-center p-8">
                    <div className="max-w-md w-full glass-strong rounded-2xl p-8 text-center relative">

                        <div className="mb-6">
                            <svg
                                className="h-16 w-16 mx-auto text-red-500"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={1.5}
                                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                                />
                            </svg>
                        </div>

                        <h1 className="text-2xl font-bold text-white mb-2">
                            Oops! Something went wrong
                        </h1>
                        <p className="text-gray-400 mb-6">
                            We're sorry for the inconvenience. The application encountered an unexpected error.
                        </p>

                        {formattedError && null}

                        <div className="flex gap-3 justify-center">
                            <Button
                                variant="outline"
                                onClick={() => window.history.back()}
                            >
                                Go Back
                            </Button>
                            <Button
                                variant="default"
                                onClick={this.handleReset}
                            >
                                Try Again
                            </Button>
                        </div>
                    </div>

                    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
                        <div className="absolute top-1/3 left-1/3 h-96 w-96 rounded-full bg-red-500/10 blur-3xl" />
                        <div className="absolute bottom-1/3 right-1/3 h-96 w-96 rounded-full bg-red-500/10 blur-3xl" />
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
