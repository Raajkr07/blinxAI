import { useState } from 'react';
import { motion as Motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { callService } from '../../services';
import { queryKeys } from '../../lib/queryClient';
import { useAuthStore, useCallStore } from '../../stores';
import { cn } from '../../lib/utils';
import { Avatar, Button, EmptyState } from '../ui';
import { formatDistanceToNow } from 'date-fns';
import { CallDetailModal } from './CallDetailModal';

const EmptyStateDisplay = ({ filter, statusFilter, onClearFilters }) => (
    <Motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex-1 flex flex-col items-center justify-center p-8 text-center"
    >
        <div className="p-8 rounded-[2rem] border border-[var(--color-border)] bg-[var(--color-background)]">
            <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 text-[var(--color-gray-500)] bg-[var(--color-border)]">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91" /></svg>
            </div>
            <h3 className="text-xl font-bold text-[var(--color-foreground)] mb-2">No call history</h3>
            <p className="text-[var(--color-gray-400)] max-w-xs">
                {filter === 'all' && statusFilter === 'all'
                    ? "You haven't made or received any calls yet. Start a conversation to connect!"
                    : "No results found for the current filters."}
            </p>
            {(filter !== 'all' || statusFilter !== 'all') && (
                <Button
                    variant="ghost"
                    size="sm"
                    className="mt-6 text-blue-500"
                    onClick={onClearFilters}
                >
                    Clear Filters
                </Button>
            )}
        </div>
    </Motion.div>
);

export function CallLogs() {
    const { user } = useAuthStore();
    const { initiateCall } = useCallStore();
    const [filter, setFilterState] = useState('all');
    const [statusFilter, setStatusFilterState] = useState('all');
    const [page, setPage] = useState(0);
    const [selectedCallId, setSelectedCallId] = useState(null);
    const pageSize = 20;

    const setFilter = (newFilter) => {
        setFilterState(newFilter);
        setPage(0);
    };

    const setStatusFilter = (newStatusFilter) => {
        setStatusFilterState(newStatusFilter);
        setPage(0);
    };

    // Build API params from filter state
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
    } else if (statusFilter === 'rejected') {
        queryParams.status = 'REJECTED';
    }

    const { data: historyData, isLoading, error, refetch } = useQuery({
        queryKey: queryKeys.callHistory(queryParams),
        queryFn: () => callService.getCallHistory(queryParams),
        refetchInterval: 30000,
    });

    const callLogs = historyData?.calls || [];
    const totalPages = historyData?.totalPages || 0;
    const hasNext = historyData?.hasNext || false;
    const hasPrevious = historyData?.hasPrevious || false;

    // Fetch active calls
    const { data: activeCalls } = useQuery({
        queryKey: ['activeCalls'],
        queryFn: callService.getActiveCalls,
        refetchInterval: 10000,
    });

    const handleVideoCall = (userId) => {
        initiateCall(userId, 'VIDEO');
    };

    const handleAudioCall = (userId) => {
        initiateCall(userId, 'AUDIO');
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

    const getStatusBadge = (call) => {
        const isMissed = call.status === 'MISSED';
        const isRejected = call.status === 'REJECTED';
        const isIncoming = call.receiverId === user?.id;

        if (isMissed) return (
            <span className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-500 text-[10px] font-bold uppercase tracking-wider">
                Missed
            </span>
        );
        if (isRejected) return (
            <span className="px-2 py-0.5 rounded-full bg-[var(--color-border)] text-[var(--color-gray-500)] text-[10px] font-bold uppercase tracking-wider">
                {isIncoming ? 'Declined' : 'Rejected'}
            </span>
        );
        return (
            <span className="px-2 py-0.5 rounded-full bg-green-500/10 text-green-500 text-[10px] font-bold uppercase tracking-wider">
                Completed
            </span>
        );
    };

    const getOtherUserId = (call) => {
        return call.callerId === user?.id ? call.receiverId : call.callerId;
    };

    const getOtherUserName = (call) => {
        const isIncoming = call.receiverId === user?.id;
        return isIncoming ? call.callerName : call.receiverName;
    };

    const getOtherUserAvatar = (call) => {
        const isIncoming = call.receiverId === user?.id;
        return isIncoming ? call.callerAvatar : call.receiverAvatar;
    };

    const animationProps = {
        initial: { opacity: 0, y: 10 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, scale: 0.95 },
        transition: { duration: 0.2 }
    };

    const isActiveFilter = (filterType, filterValue) => {
        if (filterType === 'type') return filter === filterValue;
        if (filterType === 'status') return statusFilter === filterValue;
        return false;
    };

    return (
        <>
            <Motion.div
                {...animationProps}
                className="flex-1 flex flex-col overflow-hidden bg-[var(--color-background)] relative"
            >
                {/* Filter Tabs */}
                <div className="sticky top-0 border-b border-[var(--color-border)] z-10 shrink-0 bg-[var(--color-background)]">
                    <div className="flex items-center gap-2 p-4 overflow-x-auto no-scrollbar">
                        <Button
                            variant={filter === 'all' && statusFilter === 'all' ? 'glass' : 'ghost'}
                            size="sm"
                            onClick={() => { setFilter('all'); setStatusFilter('all'); }}
                            className={cn("rounded-full px-5", filter === 'all' && statusFilter === 'all' && "bg-[var(--color-border)] border-[var(--color-border)]")}
                        >
                            All
                        </Button>
                        <Button
                            variant={isActiveFilter('type', 'video') ? 'glass' : 'ghost'}
                            size="sm"
                            onClick={() => setFilter(filter === 'video' ? 'all' : 'video')}
                            className={cn("rounded-full px-5", isActiveFilter('type', 'video') && "bg-blue-500/10 text-blue-500 border-blue-500/20")}
                        >
                            Video
                        </Button>
                        <Button
                            variant={isActiveFilter('type', 'audio') ? 'glass' : 'ghost'}
                            size="sm"
                            onClick={() => setFilter(filter === 'audio' ? 'all' : 'audio')}
                            className={cn("rounded-full px-5", isActiveFilter('type', 'audio') && "bg-blue-500/10 text-blue-500 border-blue-500/20")}
                        >
                            Audio
                        </Button>
                        <Button
                            variant={isActiveFilter('status', 'missed') ? 'glass' : 'ghost'}
                            size="sm"
                            onClick={() => setStatusFilter(statusFilter === 'missed' ? 'all' : 'missed')}
                            className={cn("rounded-full px-5", isActiveFilter('status', 'missed') && "bg-red-500/10 text-red-500 border-red-500/20")}
                        >
                            Missed
                        </Button>
                        <Button
                            variant={isActiveFilter('status', 'completed') ? 'glass' : 'ghost'}
                            size="sm"
                            onClick={() => setStatusFilter(statusFilter === 'completed' ? 'all' : 'completed')}
                            className={cn("rounded-full px-5", isActiveFilter('status', 'completed') && "bg-green-500/10 text-green-500 border-green-500/20")}
                        >
                            Completed
                        </Button>
                    </div>
                </div>

                {/* Active Calls Banner */}
                {activeCalls && activeCalls.length > 0 && (
                    <div className="border-b border-[var(--color-border)] bg-green-500/5 p-3">
                        <div className="flex items-center gap-2 text-sm">
                            <span className="relative flex h-2.5 w-2.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
                            </span>
                            <span className="font-semibold text-green-500">
                                {activeCalls.length} active call{activeCalls.length > 1 ? 's' : ''}
                            </span>
                            {activeCalls.map(c => (
                                <span key={c.id} className="text-xs text-[var(--color-gray-400)] ml-1">
                                    {c.callerName || c.receiverName}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto no-scrollbar pb-20">
                    {isLoading ? (
                        <div className="p-4 space-y-4">
                            {[...Array(6)].map((_, i) => (
                                <div key={i} className="flex items-center gap-4 p-4 rounded-3xl border border-[var(--color-border)] animate-pulse">
                                    <div className="w-14 h-14 rounded-full bg-[var(--color-border)]" />
                                    <div className="flex-1 space-y-3">
                                        <div className="h-4 w-32 bg-[var(--color-border)] rounded" />
                                        <div className="h-3 w-24 bg-[var(--color-border)] rounded opacity-50" />
                                    </div>
                                    <div className="flex gap-2">
                                        <div className="w-10 h-10 rounded-2xl bg-[var(--color-border)]" />
                                        <div className="w-10 h-10 rounded-2xl bg-[var(--color-border)]" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : error ? (
                        <div className="flex items-center justify-center p-8 h-full">
                            <EmptyState
                                title="Connection error"
                                description="We couldn't reach the server to fetch your call logs."
                                action={<Button onClick={() => refetch()} className="rounded-2xl px-8">Retry Connection</Button>}
                            />
                        </div>
                    ) : (!callLogs || callLogs.length === 0) ? (
                        <EmptyStateDisplay
                            filter={filter}
                            statusFilter={statusFilter}
                            onClearFilters={() => { setFilter('all'); setStatusFilter('all'); }}
                        />
                    ) : (
                        <div className="p-4 space-y-3">
                            {callLogs.map((call) => {
                                const otherUserId = getOtherUserId(call);
                                const otherUserName = getOtherUserName(call);
                                const otherUserAvatar = getOtherUserAvatar(call);

                                const isIncoming = call.receiverId === user?.id;
                                const duration = getCallDuration(call);
                                const startedAt = call.startedAt ? new Date(call.startedAt + (call.startedAt.endsWith('Z') ? '' : 'Z')) : null;
                                const timestamp = startedAt ? formatDistanceToNow(startedAt, { addSuffix: true }) : '';

                                return (
                                    <Motion.div
                                        key={call.id}
                                        layout
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        onClick={() => setSelectedCallId(call.id)}
                                        className="flex items-center gap-4 p-4 rounded-3xl hover:bg-[var(--color-border)]/50 transition-all duration-300 border border-[var(--color-border)] group cursor-pointer"
                                    >
                                        {/* Avatar */}
                                        <div className="relative shrink-0">
                                            <div className="absolute inset-0 rounded-full bg-blue-500/10 scale-125 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                            <Avatar
                                                src={otherUserAvatar}
                                                name={otherUserName || `User ${otherUserId}`}
                                                size="lg"
                                            />
                                            <div className={cn(
                                                "absolute -bottom-1 -right-1 rounded-full p-1.5 shadow-xl border border-[var(--color-border)]",
                                                isIncoming ? "bg-green-600" : "bg-blue-600"
                                            )}>
                                                {isIncoming ? (
                                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-white"><line x1="17" y1="7" x2="7" y2="17" /><polyline points="7 7 7 17 17 17" /></svg>
                                                ) : (
                                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-white"><line x1="7" y1="17" x2="17" y2="7" /><polyline points="7 7 17 7 17 17" /></svg>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h3 className="font-bold text-[var(--color-foreground)] truncate text-lg tracking-tight">
                                                    {otherUserName || `User ${otherUserId}`}
                                                </h3>
                                                {call.type === 'VIDEO' ? (
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-blue-500"><path d="m22 8-6 4 6 4V8Z" /><rect width="14" height="12" x="2" y="6" rx="2" ry="2" /></svg>
                                                ) : (
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-green-500"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                {getStatusBadge(call)}
                                                <span className="text-[var(--color-gray-500)] text-xs">•</span>
                                                <span className="text-[var(--color-gray-500)] text-xs font-medium">{timestamp}</span>
                                                {duration && (
                                                    <>
                                                        <span className="text-[var(--color-gray-500)] text-xs">•</span>
                                                        <span className="text-[var(--color-gray-400)] text-xs font-bold">{duration}</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex gap-2 shrink-0 sm:opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleVideoCall(otherUserId)}
                                                className="rounded-2xl w-11 h-11 bg-blue-500/10 border border-blue-500/20 text-blue-500 hover:bg-blue-500 hover:text-white"
                                            >
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m22 8-6 4 6 4V8Z" /><rect width="14" height="12" x="2" y="6" rx="2" ry="2" /></svg>
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleAudioCall(otherUserId)}
                                                className="rounded-2xl w-11 h-11 bg-[var(--color-border)] border border-[var(--color-border)] text-[var(--color-gray-400)] hover:bg-[var(--color-foreground)] hover:text-[var(--color-background)]"
                                            >
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91" /></svg>
                                            </Button>
                                        </div>
                                    </Motion.div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="absolute bottom-0 left-0 right-0 border-t border-[var(--color-border)] p-4 flex items-center justify-between z-20 bg-[var(--color-background)]/90 backdrop-blur-md">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setPage(p => Math.max(0, p - 1))}
                            disabled={!hasPrevious || page === 0}
                            className="rounded-xl px-4 min-w-[100px]"
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><path d="m15 18-6-6 6-6" /></svg>
                            Previous
                        </Button>
                        <div className="flex gap-1.5 flex-wrap justify-center max-w-[50%]">
                            {totalPages <= 8 ? (
                                [...Array(totalPages)].map((_, i) => (
                                    <div
                                        key={i}
                                        onClick={() => setPage(i)}
                                        className={cn(
                                            "w-1.5 h-1.5 rounded-full transition-all duration-300 cursor-pointer",
                                            page === i ? "bg-blue-500 w-4" : "bg-[var(--color-border)]"
                                        )}
                                    />
                                ))
                            ) : (
                                <span className="text-xs font-medium text-[var(--color-gray-400)]">
                                    Page <span className="text-[var(--color-foreground)]">{page + 1}</span> of {totalPages}
                                </span>
                            )}
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setPage(p => p + 1)}
                            disabled={!hasNext}
                            className="rounded-xl px-4 min-w-[100px]"
                        >
                            Next
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="ml-2"><path d="m9 18 6-6-6-6" /></svg>
                        </Button>
                    </div>
                )}
            </Motion.div>

            <CallDetailModal
                isOpen={!!selectedCallId}
                onClose={() => setSelectedCallId(null)}
                callId={selectedCallId}
            />
        </>
    );
}
