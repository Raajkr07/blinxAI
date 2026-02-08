import { useState, useEffect } from 'react';
import { AnimatePresence, motion as Motion } from 'framer-motion';
import { Button, Input } from '../ui';
import toast from 'react-hot-toast';

export function FilePermissionModal({ isOpen, onApprove, onDeny, fileInfo }) {
    const [editedFileName, setEditedFileName] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (fileInfo?.fileName) {
            setEditedFileName(fileInfo.fileName);
        }
    }, [fileInfo]);

    const { location, content, targetPath } = fileInfo || {};

    const handleSave = async () => {
        if (!editedFileName.trim()) {
            toast.error('Filename cannot be empty');
            return;
        }

        setIsSaving(true);
        try {
            // Use File System Access API if supported
            if ('showSaveFilePicker' in window) {
                const handle = await window.showSaveFilePicker({
                    suggestedName: editedFileName.includes('.') ? editedFileName : `${editedFileName}.txt`,
                    types: [{
                        description: 'Text File',
                        accept: { 'text/plain': ['.txt', '.md', '.json', '.csv'] },
                    }],
                });

                const writable = await handle.createWritable();
                await writable.write(content);
                await writable.close();

                toast.success('File saved successfully');
                onApprove();
            } else {
                // Fallback: Create blob and trigger download
                const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = editedFileName.includes('.') ? editedFileName : `${editedFileName}.txt`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);

                toast.success('File downloaded successfully');
                onApprove();
            }
        } catch (error) {
            // Don't show error if user simply cancelled the picker
            if (error.name !== 'AbortError') {
                console.error('Save failed:', error);
                toast.error('Failed to save file');
            }
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <Motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
                        onClick={onDeny}
                    />

                    {/* Modal */}
                    <Motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg"
                    >
                        <div className="bg-[var(--color-background)] border border-[var(--color-border)] rounded-2xl shadow-2xl overflow-hidden">
                            <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 p-6 border-b border-[var(--color-border)]">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-blue-500/20 rounded-lg">
                                            <span className="text-2xl">📄</span>
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-semibold text-[var(--color-foreground)]">
                                                Confirm File Save
                                            </h2>
                                            <p className="text-sm text-[var(--color-gray-500)] mt-1">
                                                Review the filename and location
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={onDeny}
                                        className="p-2 hover:bg-[var(--color-border)] rounded-lg transition-colors"
                                    >
                                        <span className="text-xl text-[var(--color-gray-500)]">×</span>
                                    </button>
                                </div>
                            </div>

                            <div className="p-6 space-y-4">
                                <div className="space-y-3">
                                    <div className="space-y-1">
                                        <label className="text-sm text-[var(--color-gray-500)]">File Name</label>
                                        <Input
                                            value={editedFileName}
                                            onChange={(e) => setEditedFileName(e.target.value)}
                                            placeholder="Enter filename..."
                                            className="bg-[var(--color-background)]"
                                        />
                                    </div>

                                    <div className="flex items-center justify-between p-3 bg-[var(--color-border)]/50 rounded-lg">
                                        <span className="text-sm text-[var(--color-gray-500)]">Location:</span>
                                        <span className="text-sm font-medium text-[var(--color-foreground)]">
                                            {location}
                                        </span>
                                    </div>

                                    {targetPath && (
                                        <div className="p-3 bg-[var(--color-border)]/50 rounded-lg">
                                            <span className="text-xs text-[var(--color-gray-500)] block mb-1">
                                                Target Path:
                                            </span>
                                            <span className="text-xs font-mono text-[var(--color-foreground)] break-all">
                                                {targetPath.replace(fileInfo.fileName, editedFileName)}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {content && (
                                    <div>
                                        <label className="text-sm text-[var(--color-gray-500)] mb-2 block">
                                            Content Preview:
                                        </label>
                                        <div className="max-h-32 overflow-y-auto p-3 bg-[var(--color-border)]/30 rounded-lg border border-[var(--color-border)]">
                                            <pre className="text-xs text-[var(--color-foreground)] whitespace-pre-wrap font-mono">
                                                {content.length > 500 ? content.substring(0, 500) + '...' : content}
                                            </pre>
                                        </div>
                                    </div>
                                )}

                                <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                                    <span className="text-lg mt-0.5 flex-shrink-0">ℹ️</span>
                                    <p className="text-xs text-blue-600 dark:text-blue-400">
                                        You can edit the filename above before saving.
                                    </p>
                                </div>
                            </div>

                            <div className="p-6 bg-[var(--color-border)]/30 border-t border-[var(--color-border)] flex gap-3">
                                <Button
                                    onClick={onDeny}
                                    variant="outline"
                                    className="flex-1"
                                    disabled={isSaving}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    loading={isSaving}
                                    className="flex-1 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
                                >
                                    <span className="mr-2">💾</span>
                                    {isSaving ? 'Saving...' : 'Save File'}
                                </Button>
                            </div>
                        </div>
                    </Motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
