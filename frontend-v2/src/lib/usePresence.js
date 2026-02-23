import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { socketService } from '../services/socketService';
import { reportErrorOnce } from './reportError';

export function usePresence(enabled = true) {
    const queryClient = useQueryClient();

    useEffect(() => {
        if (!enabled) return;

        let subscription = null;
        let isMounted = true;

        const setup = async () => {
            try {
                await socketService.connect();
                if (!isMounted) return;

                subscription = socketService.subscribe('/topic/presence', (event) => {
                    if (!event || !event.userId) return;

                    // Update the individual user cache entry
                    const cached = queryClient.getQueryData(['user', event.userId]);
                    if (cached) {
                        queryClient.setQueryData(['user', event.userId], {
                            ...cached,
                            online: event.online,
                        });
                    }

                    // Also update any batch-fetched user lists that contain this user
                    queryClient.setQueriesData(
                        { queryKey: ['users-batch'], exact: false },
                        (oldData) => {
                            if (!Array.isArray(oldData)) return oldData;
                            return oldData.map(u =>
                                u?.id === event.userId ? { ...u, online: event.online } : u
                            );
                        }
                    );
                });
            } catch (error) {
                reportErrorOnce('presence-realtime', error, 'Real-time updates unavailable');
            }
        };

        setup();

        return () => {
            isMounted = false;
            if (subscription) {
                subscription.unsubscribe();
            }
        };
    }, [queryClient, enabled]);
}
