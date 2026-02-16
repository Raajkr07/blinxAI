import { useQuery } from '@tanstack/react-query';
import { callService } from '../../services';
import { useAuthStore } from '../../stores';
import { Modal, ModalFooter, Avatar, Button } from '../ui';
import { cn } from '../../lib/utils';
import { format } from 'date-fns';

export function CallDetailModal({ isOpen, onClose, callId }) {
    const { user } = useAuthStore();

    const { data: call, isLoading } = useQuery({
        queryKey: ['call', callId],
        queryFn: () => callService.getCall(callId),
        enabled: isOpen && !!callId,
    });

    if (!isOpen) return null;

    const isIncoming = call?.receiverId === user?.id;
    const otherName = isIncoming ? call?.callerName : call?.receiverName;
    const otherAvatar = isIncoming ? call?.callerAvatar : call?.receiverAvatar;

    const getCallDuration = () => {
        if (!call?.answeredAt || !call?.endedAt) return null;
        const start = new Date(call.answeredAt);
        const end = new Date(call.endedAt);
        const durationMs = end - start;
        const seconds = Math.floor(durationMs / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        const remainingSeconds = seconds % 60;

        if (hours > 0) return `${hours}h ${remainingMinutes}m ${remainingSeconds}s`;
        if (minutes > 0) return `${minutes}m ${remainingSeconds}s`;
        return `${seconds}s`;
    };

    const statusStyles = {
        MISSED: 'text-red-400',
        REJECTED: 'text-[var(--color-gray-500)]',
        RINGING: 'text-blue-400',
        IN_PROGRESS: 'text-blue-400',
        ENDED: 'text-green-400',
    };

    return (
        <Modal
            open={isOpen}
            onOpenChange={(val) => !val && onClose()}
            title="Call Details"
            size="sm"
        >
            {isLoading ? (
                <div className="flex items-center justify-center py-16">
                    <div className="w-8 h-8 border-2 border-white/10 border-t-white/60 rounded-full animate-spin" />
                </div>
            ) : call ? (
                <div className="space-y-5 py-2">
                    {/* Caller */}
                    <div className="flex flex-col items-center gap-2 py-2">
                        <Avatar
                            src={otherAvatar}
                            name={otherName || 'Unknown'}
                            size="xl"
                            className="w-20 h-20 ring-2 ring-white/10"
                        />
                        <h2 className="text-lg font-bold text-[var(--color-foreground)]">
                            {otherName || 'Unknown'}
                        </h2>
                        <span className={cn(
                            'text-[10px] font-semibold uppercase tracking-wider',
                            statusStyles[call.status] || 'text-[var(--color-gray-400)]'
                        )}>
                            {call.status?.replace('_', ' ')}
                        </span>
                    </div>

                    {/* Info Rows */}
                    <div className="rounded-2xl bg-white/[0.03] border border-white/5 divide-y divide-white/5">
                        <InfoRow label="Type" value={call.type === 'VIDEO' ? '📹 Video' : '📞 Audio'} />
                        <InfoRow label="Direction" value={isIncoming ? '📥 Incoming' : '📤 Outgoing'} />
                        {call.startedAt && (
                            <InfoRow
                                label="Started"
                                value={format(new Date(call.startedAt + (call.startedAt.endsWith('Z') ? '' : 'Z')), 'MMM d, yyyy h:mm a')}
                            />
                        )}
                        {call.answeredAt && (
                            <InfoRow
                                label="Answered"
                                value={format(new Date(call.answeredAt + (call.answeredAt.endsWith('Z') ? '' : 'Z')), 'h:mm:ss a')}
                            />
                        )}
                        {getCallDuration() && (
                            <InfoRow label="Duration" value={getCallDuration()} bold />
                        )}
                    </div>
                </div>
            ) : (
                <p className="text-center text-[var(--color-gray-500)] py-12 text-sm">Call not found</p>
            )}

            <ModalFooter>
                <Button
                    variant="default"
                    onClick={onClose}
                    className="text-xs font-semibold h-9 px-6 w-full"
                >
                    Close
                </Button>
            </ModalFooter>
        </Modal>
    );
}

function InfoRow({ label, value, bold }) {
    return (
        <div className="flex items-center justify-between px-4 py-3">
            <span className="text-[10px] uppercase font-medium tracking-wider text-[var(--color-gray-500)]">{label}</span>
            <span className={cn(
                "text-xs text-[var(--color-foreground)]",
                bold ? "font-bold" : "font-medium"
            )}>
                {value}
            </span>
        </div>
    );
}
