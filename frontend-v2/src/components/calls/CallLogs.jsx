import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { callsApi } from '../../api/calls';
import { useAuthStore, useCallStore } from '../../stores';
import { cn } from '../../lib/utils';
import { Avatar, Button, EmptyState, Skeleton } from '../ui';
import { formatDistanceToNow } from 'date-fns';

export function CallLogs() {
    const { user } = useAuthStore();
    const { initiateCall } = useCallStore();
    const [filter, setFilter] = useState('all'); // all, video, audio
    const [statusFilter, setStatusFilter] = useState('all'); // all, missed, completed
    const [page, setPage] = useState(0);
    const pageSize = 20;

    // Prepare API params based on what user has selected in filters
    const queryParams = {
        page,
        size: pageSize,
    };

    if (filter !== 'all') {
        queryParams.type = filter.toUpperCase();
    }

    if (statusFilter === 'missed') {
        queryParams.status = 'MISSED';
    } else if (statusFilter === 'completed') {
        queryParams.status = 'ENDED';
    }

    // Fetch call history from backend, auto-refresh every 30 seconds
    const { data: historyData, isLoading, error, refetch } = useQuery({
        queryKey: ['callHistory', queryParams],
        queryFn: () => callsApi.getCallHistory(queryParams),
        refetchInterval: 30000,
    });

    const callLogs = historyData?.calls || [];
    const totalPages = historyData?.totalPages || 0;
    const hasNext = historyData?.hasNext || false;
    const hasPrevious = historyData?.hasPrevious || false;

    const handleVideoCall = (userId) => {
        initiateCall(null, 'VIDEO', [{ id: userId }]);
    };

    const handleAudioCall = (userId) => {
        initiateCall(null, 'AUDIO', [{ id: userId }]);
    };

    const getCallIcon = (type, status) => {
        const isMissed = status === 'MISSED' || status === 'REJECTED';
        const color = isMissed ? 'text-red-500' : 'text-green-500';

        if (type === 'VIDEO') {
            return (
                <svg width="20" height="20" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" className={color}>
                    <path d="M1 4.5C1 3.67157 1.67157 3 2.5 3H8.5C9.32843 3 10 3.67157 10 4.5V10.5C10 11.3284 9.32843 12 8.5 12H2.5C1.67157 12 1 11.3284 1 10.5V4.5ZM11 5.5L14 3.5V11.5L11 9.5V5.5Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd" />
                </svg>
            );
        }
        return (
            <svg width="20" height="20" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" className={color}>
                <path d="M7.5 1C7.22386 1 7 1.22386 7 1.5V2.5C7 2.77614 7.22386 3 7.5 3C7.77614 3 8 2.77614 8 2.5V1.5C8 1.22386 7.77614 1 7.5 1ZM3.5 5C3.22386 5 3 5.22386 3 5.5V9.5C3 9.77614 3.22386 10 3.5 10H11.5C11.7761 10 12 9.77614 12 9.5V5.5C12 5.22386 11.7761 5 11.5 5H3.5ZM2 5.5C2 4.67157 2.67157 4 3.5 4H11.5C12.3284 4 13 4.67157 13 5.5V9.5C13 10.3284 12.3284 11 11.5 11H8V12H9.5C9.77614 12 10 12.2239 10 12.5C10 12.7761 9.77614 13 9.5 13H5.5C5.22386 13 5 12.7761 5 12.5C5 12.2239 5.22386 12 5.5 12H7V11H3.5C2.67157 11 2 10.3284 2 9.5V5.5Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd" />
            </svg>
        );
    };

    const getCallStatusText = (call) => {
        const isIncoming = call.receiverId === user?.id;
        const isMissed = call.status === 'MISSED';
        const isRejected = call.status === 'REJECTED';

        if (isMissed) return 'Missed';
        if (isRejected) return isIncoming ? 'Declined' : 'Rejected';
        if (call.status === 'ENDED') return 'Completed';
        if (call.status === 'ANSWERED') return 'Answered';
        return call.status;
    };

    const getCallDuration = (call) => {
        if (!call.answeredAt || !call.endedAt) return null;
        const start = new Date(call.answeredAt);
        const end = new Date(call.endedAt);
        const durationMs = end - start;
        const seconds = Math.floor(durationMs / 1000);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;

        if (minutes > 0) {
            return `${minutes}m ${remainingSeconds}s`;
        }
        return `${seconds}s`;
    };

    const getOtherUserId = (call) => {
        return call.callerId === user?.id ? call.receiverId : call.callerId;
    };

    // When user changes filter, bring them back to first page
    useEffect(() => {
        setPage(0);
    }, [filter, statusFilter]);

    if (isLoading) {
        return (
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {[...Array(8)].map((_, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-lg">
                        <Skeleton className="w-12 h-12 rounded-full" />
                        <div className="flex-1 space-y-2">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-3 w-24" />
                        </div>
                        <div className="flex gap-2">
                            <Skeleton className="w-9 h-9 rounded-lg" />
                            <Skeleton className="w-9 h-9 rounded-lg" />
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex-1 flex items-center justify-center p-4">
                <EmptyState
                    title="Failed to load call logs"
                    description="There was an error loading your call history. Please try again."
                    action={
                        <Button onClick={() => refetch()}>
                            Retry
                        </Button>
                    }
                />
            </div>
        );
    }

    if (!callLogs || callLogs.length === 0) {
        return (
            <div className="flex-1 flex items-center justify-center p-4">
                <EmptyState
                    icon={
                        <svg width="48" height="48" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-gray-400">
                            <path d="M7.5 1C7.22386 1 7 1.22386 7 1.5V2.5C7 2.77614 7.22386 3 7.5 3C7.77614 3 8 2.77614 8 2.5V1.5C8 1.22386 7.77614 1 7.5 1ZM3.5 5C3.22386 5 3 5.22386 3 5.5V9.5C3 9.77614 3.22386 10 3.5 10H11.5C11.7761 10 12 9.77614 12 9.5V5.5C12 5.22386 11.7761 5 11.5 5H3.5ZM2 5.5C2 4.67157 2.67157 4 3.5 4H11.5C12.3284 4 13 4.67157 13 5.5V9.5C13 10.3284 12.3284 11 11.5 11H8V12H9.5C9.77614 12 10 12.2239 10 12.5C10 12.7761 9.77614 13 9.5 13H5.5C5.22386 13 5 12.7761 5 12.5C5 12.2239 5.22386 12 5.5 12H7V11H3.5C2.67157 11 2 10.3284 2 9.5V5.5Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd" />
                        </svg>
                    }
                    title="No call logs"
                    description={filter === 'all' && statusFilter === 'all'
                        ? "You haven't made or received any calls yet."
                        : "No calls match the selected filters."}
                />
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto">
            {/* Filter Tabs */}
            <div className="sticky top-0 bg-[var(--color-background)] border-b border-[var(--color-border)] z-10">
                <div className="flex items-center gap-2 p-4 overflow-x-auto">
                    <Button
                        variant={filter === 'all' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setFilter('all')}
                    >
                        All
                    </Button>
                    <Button
                        variant={filter === 'video' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setFilter('video')}
                    >
                        <svg width="16" height="16" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" className="mr-1.5">
                            <path d="M1 4.5C1 3.67157 1.67157 3 2.5 3H8.5C9.32843 3 10 3.67157 10 4.5V10.5C10 11.3284 9.32843 12 8.5 12H2.5C1.67157 12 1 11.3284 1 10.5V4.5ZM11 5.5L14 3.5V11.5L11 9.5V5.5Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd" />
                        </svg>
                        Video
                    </Button>
                    <Button
                        variant={filter === 'audio' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setFilter('audio')}
                    >
                        <svg width="16" height="16" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" className="mr-1.5">
                            <path d="M7.5 1C7.22386 1 7 1.22386 7 1.5V2.5C7 2.77614 7.22386 3 7.5 3C7.77614 3 8 2.77614 8 2.5V1.5C8 1.22386 7.77614 1 7.5 1ZM3.5 5C3.22386 5 3 5.22386 3 5.5V9.5C3 9.77614 3.22386 10 3.5 10H11.5C11.7761 10 12 9.77614 12 9.5V5.5C12 5.22386 11.7761 5 11.5 5H3.5Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd" />
                        </svg>
                        Audio
                    </Button>
                    <div className="flex-1" />
                    <Button
                        variant={statusFilter === 'all' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setStatusFilter('all')}
                    >
                        All Status
                    </Button>
                    <Button
                        variant={statusFilter === 'missed' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setStatusFilter('missed')}
                    >
                        Missed
                    </Button>
                </div>
            </div>

            {/* Call Logs List */}
            <div className="p-4 space-y-2">
                {callLogs.map((call) => {
                    const otherUserId = getOtherUserId(call);
                    const isIncoming = call.receiverId === user?.id;
                    const duration = getCallDuration(call);
                    const statusText = getCallStatusText(call);
                    const timestamp = call.startedAt ? formatDistanceToNow(new Date(call.startedAt), { addSuffix: true }) : '';

                    return (
                        <div
                            key={call.id}
                            className={cn(
                                "flex items-center gap-3 p-3 rounded-lg transition-colors",
                                "hover:bg-white/5 border border-transparent hover:border-[var(--color-border)]"
                            )}
                        >
                            {/* Call Icon & Avatar */}
                            <div className="relative">
                                <Avatar
                                    name={`User ${otherUserId}`}
                                    size="md"
                                />
                                <div className="absolute -bottom-1 -right-1 bg-[var(--color-background)] rounded-full p-0.5">
                                    {getCallIcon(call.type, call.status)}
                                </div>
                            </div>

                            {/* Call Info */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <h3 className="font-medium text-[var(--color-foreground)] truncate">
                                        User {otherUserId}
                                    </h3>
                                    {isIncoming && (
                                        <svg width="14" height="14" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-gray-400 flex-shrink-0">
                                            <path d="M8.14645 3.14645C8.34171 2.95118 8.65829 2.95118 8.85355 3.14645L12.8536 7.14645C13.0488 7.34171 13.0488 7.65829 12.8536 7.85355L8.85355 11.8536C8.65829 12.0488 8.34171 12.0488 8.14645 11.8536C7.95118 11.6583 7.95118 11.3417 8.14645 11.1464L11.2929 8H2.5C2.22386 8 2 7.77614 2 7.5C2 7.22386 2.22386 7 2.5 7H11.2929L8.14645 3.85355C7.95118 3.65829 7.95118 3.34171 8.14645 3.14645Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd" />
                                        </svg>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 text-sm text-[var(--color-gray-500)]">
                                    <span>{statusText}</span>
                                    {duration && (
                                        <>
                                            <span>•</span>
                                            <span>{duration}</span>
                                        </>
                                    )}
                                    {timestamp && (
                                        <>
                                            <span>•</span>
                                            <span>{timestamp}</span>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-2 flex-shrink-0">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleVideoCall(otherUserId)}
                                    title="Start video call"
                                    className="hover:bg-blue-500/10 hover:text-blue-500"
                                >
                                    <svg width="18" height="18" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M1 4.5C1 3.67157 1.67157 3 2.5 3H8.5C9.32843 3 10 3.67157 10 4.5V10.5C10 11.3284 9.32843 12 8.5 12H2.5C1.67157 12 1 11.3284 1 10.5V4.5ZM11 5.5L14 3.5V11.5L11 9.5V5.5Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd" />
                                    </svg>
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleAudioCall(otherUserId)}
                                    title="Start audio call"
                                    className="hover:bg-green-500/10 hover:text-green-500"
                                >
                                    <svg width="18" height="18" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M7.5 1C7.22386 1 7 1.22386 7 1.5V2.5C7 2.77614 7.22386 3 7.5 3C7.77614 3 8 2.77614 8 2.5V1.5C8 1.22386 7.77614 1 7.5 1ZM3.5 5C3.22386 5 3 5.22386 3 5.5V9.5C3 9.77614 3.22386 10 3.5 10H11.5C11.7761 10 12 9.77614 12 9.5V5.5C12 5.22386 11.7761 5 11.5 5H3.5ZM2 5.5C2 4.67157 2.67157 4 3.5 4H11.5C12.3284 4 13 4.67157 13 5.5V9.5C13 10.3284 12.3284 11 11.5 11H8V12H9.5C9.77614 12 10 12.2239 10 12.5C10 12.7761 9.77614 13 9.5 13H5.5C5.22386 13 5 12.7761 5 12.5C5 12.2239 5.22386 12 5.5 12H7V11H3.5C2.67157 11 2 10.3284 2 9.5V5.5Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd" />
                                    </svg>
                                </Button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="sticky bottom-0 bg-[var(--color-background)] border-t border-[var(--color-border)] p-4">
                    <div className="flex items-center justify-between">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setPage(p => p - 1)}
                            disabled={!hasPrevious}
                        >
                            <svg width="16" height="16" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" className="mr-1">
                                <path d="M8.84182 3.13514C9.04327 3.32401 9.05348 3.64042 8.86462 3.84188L5.43521 7.49991L8.86462 11.1579C9.05348 11.3594 9.04327 11.6758 8.84182 11.8647C8.64036 12.0535 8.32394 12.0433 8.13508 11.8419L4.38508 7.84188C4.20477 7.64955 4.20477 7.35027 4.38508 7.15794L8.13508 3.15794C8.32394 2.95648 8.64036 2.94628 8.84182 3.13514Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd" />
                            </svg>
                            Previous
                        </Button>
                        <span className="text-sm text-[var(--color-gray-500)]">
                            Page {page + 1} of {totalPages}
                        </span>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setPage(p => p + 1)}
                            disabled={!hasNext}
                        >
                            Next
                            <svg width="16" height="16" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" className="ml-1">
                                <path d="M6.1584 3.13508C6.35985 2.94621 6.67627 2.95642 6.86514 3.15788L10.6151 7.15788C10.7954 7.3502 10.7954 7.64949 10.6151 7.84182L6.86514 11.8418C6.67627 12.0433 6.35985 12.0535 6.1584 11.8646C5.95694 11.6757 5.94673 11.3593 6.1356 11.1579L9.565 7.49985L6.1356 3.84182C5.94673 3.64036 5.95694 3.32394 6.1584 3.13508Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd" />
                            </svg>
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}