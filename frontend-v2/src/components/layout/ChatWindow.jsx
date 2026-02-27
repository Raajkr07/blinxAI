import { cn } from '../../lib/utils';
import { ChatWindowEmpty } from './ChatWindowEmpty';

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
        <div className={cn('flex-1 flex flex-col min-h-0 overflow-hidden', className)}>
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
