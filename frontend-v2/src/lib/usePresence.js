import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { socketService } from '../services';

export function usePresence() {
    const queryClient = useQueryClient();

    useEffect(() => {
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
            } catch {
                // Socket not ready yet — the subscription will be
                // established on reconnect via socketService internals
            }
        };

        setup();

        return () => {
            isMounted = false;
            if (subscription) {
                subscription.unsubscribe();
            }
        };
    }, [queryClient]);
}
