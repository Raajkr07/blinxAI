import { useState, useEffect } from 'react';
import { Modal, ModalFooter, Button, Input } from '../ui';
import toast from 'react-hot-toast';
import { chatService } from '../../services';

export function FilePermissionModal({ isOpen, onApprove, onDeny, fileInfo }) {
    const [editedFileName, setEditedFileName] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (fileInfo?.fileName) {
            setEditedFileName(fileInfo.fileName);
        }
    }, [fileInfo]);

    const { content } = fileInfo || {};

    const handleSave = async (method = 'api') => {
        if (!editedFileName.trim()) {
            toast.error('File name required');
            return;
        }

        setIsSaving(true);
        try {
            if (method === 'api') {
                await chatService.saveFile(editedFileName, content);
                toast.success('File saved');
                onApprove();
            } else if ('showSaveFilePicker' in window) {
                const handle = await window.showSaveFilePicker({
                    suggestedName: editedFileName.includes('.') ? editedFileName : `${editedFileName}.txt`,
                    types: [{
                        description: 'Text files',
                        accept: { 'text/plain': ['.txt', '.md', '.json', '.csv'] },
                    }],
                });
                const writable = await handle.createWritable();
                await writable.write(content);
                await writable.close();
                toast.success('File saved locally');
                onApprove();
            } else {
                const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = editedFileName.includes('.') ? editedFileName : `${editedFileName}.txt`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);
                toast.success('Download started');
                onApprove();
            }
        } catch (error) {
            if (error.name !== 'AbortError') {
                toast.error('Save failed');
            }
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Modal
            open={isOpen}
            onOpenChange={(open) => !open && onDeny()}
            title="Save File"
            description="Save this file to your device"
            size="md"
        >
            <div className="space-y-5 py-2">
                {/* Icon */}
                <div className="flex flex-col items-center py-4">
                    <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-2xl">
                        📄
                    </div>
                </div>

                {/* File Name */}
                <div className="rounded-2xl bg-white/[0.03] border border-white/5 p-4">
                    <label className="text-[10px] uppercase font-medium tracking-wider text-[var(--color-gray-500)] mb-1 block">File Name</label>
                    <Input
                        id="file-name"
                        name="fileName"
                        value={editedFileName}
                        onChange={(e) => setEditedFileName(e.target.value)}
                        placeholder="document.txt"
                        className="bg-transparent border-white/5 focus:border-blue-500/40 h-10"
                    />
                </div>

                {/* Preview */}
                {content && (
                    <div>
                        <label className="text-[10px] uppercase font-medium tracking-wider text-[var(--color-gray-500)] mb-2 block px-1">
                            Preview
                        </label>
                        <div className="p-4 rounded-2xl bg-black/30 border border-white/5 max-h-40 overflow-y-auto custom-scrollbar">
                            <pre className="text-[11px] font-mono text-[var(--color-gray-400)] leading-relaxed whitespace-pre-wrap">
                                {content.length > 800 ? content.substring(0, 800) + '…' : content}
                            </pre>
                        </div>
                    </div>
                )}
            </div>

            <ModalFooter>
                <Button
                    onClick={onDeny}
                    variant="ghost"
                    className="text-xs font-medium text-[var(--color-gray-400)]"
                    disabled={isSaving}
                >
                    Cancel
                </Button>
                <Button
                    onClick={() => handleSave('api')}
                    variant="default"
                    disabled={isSaving}
                    loading={isSaving}
                    className="text-xs font-semibold h-9 px-6"
                >
                    Save File
                </Button>
            </ModalFooter>
        </Modal>
    );
}
