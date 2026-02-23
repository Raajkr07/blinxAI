import { cn } from '../../lib/utils';

export function EmptyState({
    icon,
    title,
    description,
    action,
    className,
}) {
    return (
        <div
            className={cn(
                'flex flex-col items-center justify-center',
                'py-12 px-4 text-center',
                className
            )}
        >
            {icon && (
                <div className="mb-4 text-gray-400">
                    {icon}
                </div>
            )}
            {title && (
                <h3 className="text-lg font-semibold text-white mb-2">
                    {title}
                </h3>
            )}
            {description && (
                <p className="text-sm text-gray-400 mb-6 max-w-sm">
                    {description}
                </p>
            )}
            {action && <div>{action}</div>}
        </div>
    );
}

export function NoMessagesIcon({ className }) {
    return (
        <svg
            className={cn('h-16 w-16', className)}
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
    );
}

export function NoConversationsIcon({ className }) {
    return (
        <svg
            className={cn('h-16 w-16', className)}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
        >
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z"
            />
        </svg>
    );
}

export function NoSearchResultsIcon({ className }) {
    return (
        <svg
            className={cn('h-16 w-16', className)}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
        >
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
        </svg>
    );
}
