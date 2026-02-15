import { Modal, ModalFooter, Button } from '../ui';

export function CalendarPreviewModal({ isOpen, onClose, eventInfo }) {
    if (!eventInfo) return null;

    return (
        <Modal
            open={isOpen}
            onOpenChange={(open) => !open && onClose()}
            title="Event Scheduled"
            description="Successfully added to your Google Calendar."
            size="lg"
        >
            <div className="space-y-6">
                <div className="space-y-4">
                    <h4 className="text-2xl font-bold text-[var(--color-foreground)] leading-tight">
                        {eventInfo.title || eventInfo.summary}
                    </h4>

                    <div className="grid gap-4">
                        {/* Time */}
                        <div className="flex items-center gap-4 text-[var(--color-gray-300)]">
                            <div className="w-10 h-10 rounded-lg border border-[var(--color-border)] bg-white/5 flex items-center justify-center text-lg">
                                🕒
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] text-[var(--color-gray-500)] uppercase font-bold tracking-widest">Time</span>
                                <span className="text-sm font-medium">
                                    {eventInfo.startTime || eventInfo.start?.dateTime || 'Not specified'}
                                </span>
                            </div>
                        </div>

                        {/* Location */}
                        {eventInfo.location && (
                            <div className="flex items-center gap-4 text-[var(--color-gray-300)]">
                                <div className="w-10 h-10 rounded-lg border border-[var(--color-border)] bg-white/5 flex items-center justify-center text-lg">
                                    📍
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] text-[var(--color-gray-500)] uppercase font-bold tracking-widest">Location</span>
                                    <span className="text-sm font-medium">{eventInfo.location}</span>
                                </div>
                            </div>
                        )}

                        {/* Description */}
                        <div className="flex items-start gap-4 text-[var(--color-gray-300)]">
                            <div className="w-10 h-10 rounded-lg border border-[var(--color-border)] bg-white/5 flex items-center justify-center text-lg">
                                📝
                            </div>
                            <div className="flex flex-col flex-1">
                                <span className="text-[10px] text-[var(--color-gray-500)] uppercase font-bold tracking-widest">Description</span>
                                <p className="text-sm text-[var(--color-gray-400)] mt-1 leading-relaxed">
                                    {eventInfo.description || 'No description provided.'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {eventInfo.error && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                        <p className="text-xs text-red-500 flex items-center gap-2">
                            <span>⚠️</span> Sync Error: {eventInfo.error}
                        </p>
                    </div>
                )}
            </div>

            <ModalFooter>
                {eventInfo.googleCalendarUrl && (
                    <Button
                        variant="ghost"
                        onClick={() => window.open(eventInfo.googleCalendarUrl, '_blank')}
                        className="text-blue-500 hover:text-blue-400 hover:bg-blue-500/10 mr-auto"
                    >
                        View in Browser
                    </Button>
                )}
                <Button
                    onClick={onClose}
                    variant="outline"
                    className="px-8"
                >
                    Close
                </Button>
            </ModalFooter>
        </Modal>
    );
}
