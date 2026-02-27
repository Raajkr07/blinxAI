import { useState, useEffect, useCallback, useRef } from 'react';
import { cn } from '../../lib/utils';
import { useUIStore } from '../../stores';
import { Button } from '../ui';

export function Sidebar({ children }) {
    const { isSidebarOpen, isSidebarCollapsed, toggleSidebar, isMobile, sidebarWidth, setSidebarWidth } = useUIStore();
    const [isResizing, setIsResizing] = useState(false);
    const sidebarRef = useRef(null);

    useEffect(() => {
        if (isMobile) {
            setSidebarWidth(window.innerWidth);
        } else {
            if (sidebarWidth < 240 || sidebarWidth > 600) {
                setSidebarWidth(300);
            }
        }
    }, [isMobile, setSidebarWidth, sidebarWidth]);

    const startResizing = useCallback((e) => {
        e.preventDefault();
        setIsResizing(true);
        document.body.style.cursor = 'col-resize';
    }, []);

    const stopResizing = useCallback(() => {
        setIsResizing(false);
        document.body.style.cursor = '';
    }, []);

    const resize = useCallback(
        (e) => {
            if (isResizing && !isMobile) {
                e.preventDefault();
                const newWidth = e.clientX;
                if (newWidth >= 240 && newWidth <= 600) {
                    setSidebarWidth(newWidth);
                }
            }
        },
        [isResizing, isMobile, setSidebarWidth]
    );

    useEffect(() => {
        if (isResizing) {
            window.addEventListener('mousemove', resize);
            window.addEventListener('mouseup', stopResizing);
        }
        return () => {
            window.removeEventListener('mousemove', resize);
            window.removeEventListener('mouseup', stopResizing);
        };
    }, [isResizing, resize, stopResizing]);

    if (isMobile && !isSidebarOpen) {
        return null;
    }

    const collapsedWidth = 60;

    return (
        <>
            {isMobile && isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40"
                    onClick={toggleSidebar}
                />
            )}

            <div
                className={cn(
                    'group/sidebar relative flex-shrink-0 h-full',
                    'transition-[width,min-width,max-width] ease-[cubic-bezier(0.4,0,0.2,1)]',
                    isResizing ? 'duration-0' : 'duration-1000',
                    isMobile ? 'fixed left-0 top-0 z-50' : 'z-20',
                    !isSidebarOpen && isMobile && 'hidden',
                )}
                style={{
                    width: isMobile ? '100%' : (isSidebarCollapsed ? collapsedWidth : sidebarWidth),
                    minWidth: isSidebarCollapsed ? collapsedWidth : 240,
                    maxWidth: isSidebarCollapsed ? collapsedWidth : 600,
                }}
            >
                <aside
                    ref={sidebarRef}
                    className={cn(
                        'h-full w-full bg-[var(--color-background)] border-r border-[var(--color-border)]',
                        'flex flex-col',
                        'pointer-events-auto'
                    )}
                >
                    {children}

                    {/* Desktop resize handle hidden when collapsed */}
                    {!isMobile && !isSidebarCollapsed && (
                        <div
                            className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-blue-500/50 active:bg-blue-500 transition-colors z-50"
                            onMouseDown={startResizing}
                        />
                    )}
                </aside>

                {/* Sidebar toggle — outside aside, never clipped by overflow */}
                {!isMobile && (
                    <button
                        onClick={toggleSidebar}
                        className={cn(
                            'absolute top-1/2 -translate-y-1/2 -right-4 z-50',
                            'w-4 h-8 rounded-r-md',
                            'bg-[var(--color-border)] hover:bg-white/20',
                            'flex items-center justify-center',
                            'text-[var(--color-gray-400)] hover:text-[var(--color-foreground)]',
                            'cursor-pointer border-y border-r border-white/5',
                            'opacity-0 group-hover/sidebar:opacity-100',
                            'transition-all duration-200'
                        )}
                        aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                    >
                        <svg
                            width="10"
                            height="10"
                            viewBox="0 0 15 15"
                            fill="none"
                            className={cn(
                                'transition-transform duration-1000',
                                isSidebarCollapsed ? 'rotate-0' : 'rotate-180'
                            )}
                        >
                            <path
                                d="M6.18194 4.18185C6.35767 4.00611 6.64236 4.00611 6.81809 4.18185L9.81809 7.18185C9.90672 7.27048 9.95652 7.3903 9.95652 7.51497C9.95652 7.63964 9.90672 7.75945 9.81809 7.84809L6.81809 10.8481C6.64236 11.0238 6.35767 11.0238 6.18194 10.8481C6.0062 10.6724 6.0062 10.3877 6.18194 10.2119L8.87891 7.51497L6.18194 4.81809C6.0062 4.64236 6.0062 4.35759 6.18194 4.18185Z"
                                fill="currentColor"
                                fillRule="evenodd"
                                clipRule="evenodd"
                            />
                        </svg>
                    </button>
                )}
            </div>
        </>
    );
}

export function SidebarHeader({ children }) {
    const { isSidebarCollapsed } = useUIStore();

    return (
        <div className={cn(
            "h-14 flex items-center justify-between border-b border-[var(--color-border)] flex-shrink-0 transition-all duration-1000 overflow-hidden",
            isSidebarCollapsed ? "px-2 justify-center" : "px-3"
        )}>
            {children}
        </div>
    );
}

export function SidebarContent({ children, className }) {
    return (
        <div className={cn('flex-1 overflow-y-auto overflow-x-hidden', className)}>
            {children}
        </div>
    );
}

export function SidebarFooter({ children }) {
    const { theme, toggleTheme, isSidebarCollapsed } = useUIStore();

    return (
        <div className={cn(
            "flex border-t border-[var(--color-border)] flex-shrink-0 transition-all duration-1000 bg-[var(--color-background)]",
            isSidebarCollapsed ? "p-2 flex-col items-center gap-2 h-[109px] py-4" : "px-3 items-center justify-between gap-2 h-16"
        )}>
            <div className={cn(
                "flex items-center",
                isSidebarCollapsed ? "justify-center" : "gap-2"
            )}>
                {children}
            </div>

            <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                aria-label="Toggle theme"
                className={cn("transition-all duration-1000", isSidebarCollapsed ? "h-9 w-9" : "")}
            >
                {theme === 'dark' ? (
                    <svg width="18" height="18" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M7.5 1.5V2.5M7.5 12.5V13.5M2.5 7.5H1.5M13.5 7.5H12.5M3.96447 3.96447L3.25736 3.25736M11.7426 11.7426L11.0355 11.0355M3.96447 11.0355L3.25736 11.7426M11.7426 3.25736L11.0355 3.96447M7.5 10C8.88071 10 10 8.88071 10 7.5C10 6.11929 8.88071 5 7.5 5C6.11929 5 5 6.11929 5 7.5C5 8.88071 6.11929 10 7.5 10Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                ) : (
                    <svg width="18" height="18" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M10.4 10.4C10.4 11.4 9.2 12.5 7.5 12.5C4.73858 12.5 2.5 10.2614 2.5 7.5C2.5 5.8 3.6 4.6 4.6 4.6C4.6 4.6 4.6 7.00001 7.00001 9.4C9.4 11.8 11.8 11.8 11.8 11.8C11.5 12.2 11 12.5 10.4 12.5V12.5Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M12.5 4.5C12.5 5.05228 12.0523 5.5 11.5 5.5C10.9477 5.5 10.5 5.05228 10.5 4.5C10.5 3.94772 10.9477 3.5 11.5 3.5C12.0523 3.5 12.5 3.94772 12.5 4.5Z" fill="currentColor" />
                    </svg>
                )}
            </Button>
        </div>
    );
}

export function SidebarToggle() {
    const { toggleSidebar, isMobile } = useUIStore();

    return (
        <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className={cn(isMobile && 'md:hidden')}
            aria-label="Toggle sidebar"
        >
            <svg
                width="20"
                height="20"
                viewBox="0 0 15 15"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
            >
                <path
                    d="M1.5 3C1.22386 3 1 3.22386 1 3.5C1 3.77614 1.22386 4 1.5 4H13.5C13.7761 4 14 3.77614 14 3.5C14 3.22386 13.7761 3 13.5 3H1.5ZM1 7.5C1 7.22386 1.22386 7 1.5 7H13.5C13.7761 7 14 7.22386 14 7.5C14 7.77614 13.7761 8 13.5 8H1.5C1.22386 8 1 7.77614 1 7.5ZM1 11.5C1 11.2239 1.22386 11 1.5 11H13.5C13.7761 11 14 11.2239 14 11.5C14 11.7761 13.7761 12 13.5 12H1.5C1.22386 12 1 11.7761 1 11.5Z"
                    fill="currentColor"
                    fillRule="evenodd"
                    clipRule="evenodd"
                />
            </svg>
        </Button>
    );
}
