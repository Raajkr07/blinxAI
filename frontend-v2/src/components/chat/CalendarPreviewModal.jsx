import { Modal, ModalFooter, Button } from '../ui';

export function CalendarPreviewModal({ isOpen, onClose, eventInfo }) {
    if (!eventInfo) return null;

    const formattedTime = eventInfo.startTime || eventInfo.start?.dateTime;
    const dateStr = formattedTime ? new Date(formattedTime).toLocaleString([], {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }) : 'Scheduled Event';

    return (
        <Modal
            open={isOpen}
            onOpenChange={(open) => !open && onClose()}
            title="Calendar Event"
            description="Event details and scheduling"
            size="md"
        >
            <div className="space-y-5 py-2">
                {/* Event Header */}
                <div className="flex flex-col items-center gap-3 py-4">
                    <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-2xl">
                        🗓️
                    </div>
                    <div className="text-center">
                        <h4 className="text-lg font-bold text-[var(--color-foreground)] leading-tight">
                            {eventInfo.title || eventInfo.summary || 'Untitled Event'}
                        </h4>
                    </div>
                </div>

                {/* Details Card */}
                <div className="rounded-2xl bg-white/[0.03] border border-white/5 divide-y divide-white/5">
                    <div className="flex items-center gap-4 p-4">
                        <span className="text-lg">⏱️</span>
                        <div>
                            <p className="text-[10px] uppercase font-medium tracking-wider text-[var(--color-gray-500)] mb-0.5">Time</p>
                            <p className="text-sm font-medium text-[var(--color-foreground)]">{dateStr}</p>
                        </div>
                    </div>

                    {eventInfo.location && (
                        <div className="flex items-center gap-4 p-4">
                            <span className="text-lg">📍</span>
                            <div>
                                <p className="text-[10px] uppercase font-medium tracking-wider text-[var(--color-gray-500)] mb-0.5">Location</p>
                                <p className="text-sm font-medium text-[var(--color-foreground)]">{eventInfo.location}</p>
                            </div>
                        </div>
                    )}

                    <div className="flex items-start gap-4 p-4">
                        <span className="text-lg mt-0.5">📝</span>
                        <div className="flex-1">
                            <p className="text-[10px] uppercase font-medium tracking-wider text-[var(--color-gray-500)] mb-0.5">Description</p>
                            <p className="text-xs text-[var(--color-gray-300)] leading-relaxed">
                                {eventInfo.description || 'No description provided.'}
                            </p>
                        </div>
                    </div>
                </div>

                {eventInfo.error && (
                    <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center gap-3">
                        <span className="text-red-400 text-sm">⚠️</span>
                        <div>
                            <p className="text-[10px] uppercase font-semibold tracking-wider text-red-400">Sync Error</p>
                            <p className="text-xs text-red-300/70 mt-0.5">{eventInfo.error}</p>
                        </div>
                    </div>
                )}
            </div>

            <ModalFooter>
                {eventInfo.googleCalendarUrl && (
                    <Button
                        variant="ghost"
                        onClick={() => window.open(eventInfo.googleCalendarUrl, '_blank')}
                        className="text-xs font-medium text-blue-400 mr-auto"
                    >
                        Open in Calendar
                    </Button>
                )}
                <Button
                    onClick={onClose}
                    variant="default"
                    className="text-xs font-semibold h-9 px-6"
                >
                    Done
                </Button>
            </ModalFooter>
        </Modal>
    );
}
