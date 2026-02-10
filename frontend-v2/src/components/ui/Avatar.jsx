import { cn, getInitials } from '../../lib/utils';

const avatarSizes = {
    xs: 'h-5 w-5 text-[10px]',
    sm: 'h-8 w-8 text-sm',
    md: 'h-10 w-10 text-base',
    lg: 'h-12 w-12 text-lg',
    xl: 'h-16 w-16 text-xl',
    '2xl': 'h-20 w-20 text-2xl',
};

export function Avatar({
    src,
    alt,
    name,
    size = 'md',
    online = false,
    showOffline = false,
    className,
    children,
}) {
    const initials = getInitials(name || alt);

    return (
        <div className={cn('relative inline-block flex-shrink-0', className)}>
            <div
                className={cn(
                    'rounded-full overflow-hidden',
                    'bg-gray-800 text-white',
                    'flex items-center justify-center',
                    'font-medium',
                    'border border-gray-700',
                    avatarSizes[size]
                )}
            >
                {src ? (
                    <img
                        src={src}
                        alt={alt || name}
                        className="h-full w-full object-cover"
                        onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                        }}
                    />
                ) : null}
                {children ? (
                    <div className="h-full w-full flex items-center justify-center">
                        {children}
                    </div>
                ) : (
                    <div
                        className={cn(
                            'h-full w-full flex items-center justify-center',
                            src && 'hidden'
                        )}
                    >
                        {initials}
                    </div>
                )}
            </div>
            {(online || showOffline) && (
                <span
                    className={cn(
                        'absolute bottom-0 right-0',
                        'h-3 w-3 rounded-full',
                        'border-2 border-black',
                        online ? 'bg-green-500' : 'bg-red-500',
                        size === 'xs' && 'h-2 w-2 border',
                        size === 'sm' && 'h-2.5 w-2.5 border',
                        (size === 'xl' || size === '2xl') && 'h-4 w-4'
                    )}
                />
            )}
        </div>
    );
}

export function AvatarGroup({ avatars = [], max = 3, size = 'md', className }) {
    const displayAvatars = avatars.slice(0, max);
    const remaining = Math.max(0, avatars.length - max);

    return (
        <div className={cn('flex -space-x-2', className)}>
            {displayAvatars.map((avatar, index) => (
                <div key={index} className="ring-2 ring-black rounded-full">
                    <Avatar {...avatar} size={size} />
                </div>
            ))}
            {remaining > 0 && (
                <div
                    className={cn(
                        'rounded-full bg-gray-800 text-white',
                        'flex items-center justify-center',
                        'font-medium border border-gray-700',
                        'ring-2 ring-black',
                        avatarSizes[size]
                    )}
                >
                    +{remaining}
                </div>
            )}
        </div>
    );
}
