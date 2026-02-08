import { useState, useRef, useEffect } from 'react';
import { cn } from '../../lib/utils';

export function SimpleDropdown({ trigger, children, align = 'start' }) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);
    const triggerRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('touchstart', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside);
        };
    }, [isOpen]);

    useEffect(() => {
        const handleEscape = (event) => {
            if (event.key === 'Escape') {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
        }

        return () => {
            document.removeEventListener('keydown', handleEscape);
        };
    }, [isOpen]);

    const handleTriggerClick = (e) => {
        e.preventDefault();
        setIsOpen(!isOpen);
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <div ref={triggerRef} onClick={handleTriggerClick}>
                {trigger}
            </div>

            {isOpen && (
                <div
                    className={cn(
                        'absolute top-full mt-2 min-w-[200px]',
                        'bg-[var(--color-background)] border border-[var(--color-border)]',
                        'rounded-lg p-1',
                        'shadow-2xl',
                        'animate-slide-in-up',
                        align === 'end' ? 'right-0' : 'left-0'
                    )}
                    style={{ zIndex: 99999 }}
                >
                    <div onClick={() => setIsOpen(false)}>
                        {children}
                    </div>
                </div>
            )}
        </div>
    );
}

export function SimpleDropdownItem({ children, onClick, icon, destructive = false }) {
    const handleClick = (e) => {
        e.preventDefault();
        if (onClick) {
            onClick(e);
        }
    };

    return (
        <button
            onClick={handleClick}
            className={cn(
                'w-full flex items-center gap-3 px-3 py-2 rounded-md',
                'text-sm cursor-pointer',
                'transition-colors',
                'focus:outline-none',
                'text-left',
                destructive
                    ? 'text-red-400 hover:bg-red-500/10 focus:bg-red-500/10'
                    : 'text-[var(--color-foreground)] hover:bg-[var(--color-border)] focus:bg-[var(--color-border)]'
            )}
        >
            {icon && <span className="flex-shrink-0">{icon}</span>}
            <span className="flex-1">{children}</span>
        </button>
    );
}
