import { cn } from '../../lib/utils';

export function ChatWindow({ children, className }) {
    return (
        <div className={cn('h-full flex flex-col overflow-hidden bg-[var(--color-background)]', className)}>
            {children ? (
                children
            ) : (
                <ChatWindowEmpty />
            )}
        </div>
    );
}

export function ChatWindowHeader({ children }) {
    return (
        <div className="h-13 px-6 flex items-center justify-between border-b border-[var(--color-border)] flex-shrink-0">
            {children}
        </div>
    );
}

export function ChatWindowContent({ children, className }) {
    return (
        <div className={cn('flex-1 overflow-y-auto min-h-0 px-2', className)}>
            {children}
        </div>
    );
}

export function ChatWindowFooter({ children }) {
    return (
        <div className="chat-window-footer h-16 px-6 flex items-center border-t border-[var(--color-border)] flex-shrink-0 bg-[var(--color-background)] z-10">
            {children}
        </div>
    );
}

function ChatWindowEmpty() {
    return (
        <div className="h-full flex flex-col items-center justify-center p-8 text-center">
            <div className="glass-strong rounded-2xl p-12 max-w-md">
                <div className="mb-6">
                    <svg
                        className="h-20 w-20 mx-auto text-gray-600"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                        />
                    </svg>
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">
                    Select a conversation
                </h3>
                <p className="text-sm text-gray-400">
                    Choose a conversation from the sidebar to start chatting
                </p>
            </div>

            <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
                <div className="absolute top-1/3 left-1/3 h-96 w-96 rounded-full bg-white/5 blur-3xl" />
                <div className="absolute bottom-1/3 right-1/3 h-96 w-96 rounded-full bg-white/5 blur-3xl" />
            </div>
        </div>
    );
}
