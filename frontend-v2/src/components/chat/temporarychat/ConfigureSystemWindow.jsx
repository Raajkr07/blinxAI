import { useState } from 'react';
import { motion as Motion } from 'framer-motion';
import { Button } from '../../ui';
import { aiService } from '../../../services';
import toast from 'react-hot-toast';

export function ConfigureSystemWindow({ onClose }) {
    const [instructions, setInstructions] = useState('');
    const [chatType, setChatType] = useState('funny');
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    const handleSave = async () => {
        setIsSaving(true);
        setSaveSuccess(false);
        try {
            await aiService.saveIncognitoConfig({ instructions, chatType });
            setSaveSuccess(true);

            const toastMessages = {
                funny: "🤪 Config updated! Let's get chaotic.",
                casual: "😌 Cool, got it. We're chilling now.",
                emotional: "🥺 I'm here for you. Settings saved.",
                professional: "💻 System configuration updated successfully."
            };
            toast.success(toastMessages[chatType] || "Settings saved!", {
                duration: 3000,
                position: 'top-right',
            });

            setTimeout(() => setSaveSuccess(false), 3000);
        } catch {
            toast.error("Failed to update system config.");
        } finally {
            setIsSaving(false);
        }
    };

    const chatTypes = [
        { id: 'funny', label: 'Funny & Rebellious', emoji: '🤪' },
        { id: 'casual', label: 'Casual & Laid-back', emoji: '😌' },
        { id: 'emotional', label: 'Emotional & Empathetic', emoji: '🥺' },
        { id: 'professional', label: 'Professional & Strict', emoji: '💻' }
    ];
    return (
        <Motion.div
            initial={{ opacity: 0, scale: 0.97, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 15 }}
            transition={{ duration: 0.4, type: "spring", stiffness: 300, damping: 25 }}
            className="flex-1 flex flex-col h-full bg-[var(--color-background)] text-[var(--color-foreground)]"
        >
            {/* Header */}
            <div className="h-14 px-6 flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-background)]/40 backdrop-blur-md shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-rose-500/20 flex items-center justify-center text-rose-400 border border-rose-500/30">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                            <circle cx="12" cy="12" r="3" />
                        </svg>
                    </div>
                    <div>
                        <h1 className="font-semibold text-sm tracking-wide">Configure Incognito</h1>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 text-[var(--color-gray-500)] hover:text-[var(--color-foreground)] rounded-full hover:bg-[var(--color-foreground)]/10">
                        <svg width="14" height="14" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M11.7816 4.03157C12.0062 3.80702 12.0062 3.44295 11.7816 3.2184C11.5571 2.99385 11.193 2.99385 10.9685 3.2184L7.50005 6.68682L4.03164 3.2184C3.80708 2.99385 3.44301 2.99385 3.21846 3.2184C2.99391 3.44295 2.99391 3.80702 3.21846 4.03157L6.68688 7.49999L3.21846 10.9684C2.99391 11.193 2.99391 11.557 3.21846 11.7816C3.44301 12.0061 3.80708 12.0061 4.03164 11.7816L7.50005 8.31316L10.9685 11.7816C11.193 12.0061 11.5571 12.0061 11.7816 11.7816C12.0062 11.557 12.0062 11.193 11.7816 10.9684L8.31322 7.49999L11.7816 4.03157Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd" />
                        </svg>
                    </Button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-8 flex flex-col items-center justify-center text-center relative z-10 custom-scrollbar">
                <div className="w-full max-w-2xl bg-[var(--color-background)]/40 border border-[var(--color-border)] p-6 rounded-2xl shadow-xl flex flex-col items-center">
                    <div className="p-4 rounded-3xl bg-rose-500/10 mb-6 shadow-[inset_0_0_20px_rgba(244,63,94,0.1)]">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-rose-500">
                            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                            <polyline points="14 2 14 8 20 8" />
                            <line x1="16" y1="13" x2="8" y2="13" />
                            <line x1="16" y1="17" x2="8" y2="17" />
                            <line x1="10" y1="9" x2="8" y2="9" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-semibold mb-2 text-[var(--color-foreground)]">System Instructions</h2>
                    <p className="text-sm text-[var(--color-gray-400)] max-w-sm mx-auto mb-6 leading-relaxed">
                        Inject persistent system prompts, restrict context windows, and define custom persona rules for AI interaction.
                    </p>

                    <div className="w-full mb-6">
                        <label className="block text-left text-sm font-medium text-[var(--color-gray-400)] mb-3">Personal Tone</label>
                        <div className="grid grid-cols-2 gap-3 mb-6">
                            {chatTypes.map(type => (
                                <button
                                    key={type.id}
                                    onClick={() => setChatType(type.id)}
                                    className={`p-3 rounded-xl border flex items-center justify-start gap-3 transition-all ${chatType === type.id
                                        ? 'bg-rose-500/20 border-rose-500/50 text-rose-400 shadow-[inset_0_0_10px_rgba(244,63,94,0.1)]'
                                        : 'bg-[var(--color-background)]/60 border-[var(--color-border)] text-[var(--color-gray-400)] hover:border-[var(--color-gray-500)]'
                                        }`}
                                >
                                    <span className="text-xl">{type.emoji}</span>
                                    <span className="text-sm font-medium">{type.label}</span>
                                </button>
                            ))}
                        </div>

                        <label className="block text-left text-sm font-medium text-[var(--color-gray-400)] mb-2">Prompt</label>
                        <textarea
                            value={instructions}
                            onChange={(e) => setInstructions(e.target.value)}
                            className="w-full h-32 bg-[var(--color-background)]/80 border border-[var(--color-border)] rounded-xl p-4 text-sm text-[var(--color-foreground)] resize-none focus:outline-none focus:border-rose-500/50 transition-colors shadow-inner font-mono"
                            placeholder="Type additional constraints, memory bounds, or custom rules here..."
                        />
                    </div>

                    <div className="flex items-center gap-4 w-full justify-between">
                        <p className="text-sm text-emerald-400 font-medium h-5">
                            {saveSuccess && "✓ Core rules updated successfully."}
                        </p>
                        <Button
                            onClick={handleSave}
                            disabled={isSaving}
                            variant="default"
                            className="bg-rose-600 hover:bg-rose-500 text-white rounded-xl shadow-lg shadow-rose-500/20 w-48 relative overflow-hidden transition-all"
                        >
                            {isSaving ? (
                                <span className="flex items-center gap-2">
                                    <svg className="animate-spin h-4 w-4 text-white/70" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                    Flashing ROM...
                                </span>
                            ) : "Save Instructions"}
                        </Button>
                    </div>
                </div>
            </div>
        </Motion.div>
    );
}
