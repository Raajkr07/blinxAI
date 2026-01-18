import { cn } from '../../lib/utils';

export function AppShell({ sidebar, children, className }) {
    return (
        <div className={cn('h-screen w-full flex flex-row overflow-hidden bg-[var(--color-background)]', className)}>
            {sidebar}

            <main className="flex-1 flex flex-col overflow-hidden min-w-0">
                {children}
            </main>
        </div>
    );
}
