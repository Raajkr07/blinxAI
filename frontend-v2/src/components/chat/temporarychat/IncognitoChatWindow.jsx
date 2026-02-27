import { useState, useRef, useEffect } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { useAuthStore, useTempViewsStore } from '../../../stores';
import { cn, generateId } from '../../../lib/utils';
import { Button, Textarea, Avatar, AILogo } from '../../ui';
import { aiService } from '../../../services';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export function IncognitoChatWindow({ onClose }) {
    const { user } = useAuthStore();
    const { incognitoMessages, addIncognitoMessage, clearIncognitoMessages } = useTempViewsStore();
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);

    // Auto-scroll
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [incognitoMessages, isTyping]);

    const handleSend = async (e) => {
        e?.preventDefault();
        const trimmed = input.trim();
        if (!trimmed) return;

        // User message
        const userMsg = {
            id: `msg-${generateId()}`,
            senderId: 'me',
            body: trimmed,
            createdAt: new Date().toISOString()
        };

        addIncognitoMessage(userMsg);
        setInput('');
        setIsTyping(true);

        try {
            // Await actual AI service logic for incognito feature
            const response = await aiService.chatWithIncognitoAi(trimmed);

            // Extract text from standard response wrapper
            const aiBody = response.body || response.message || response.reply || response.data || String(response);

            const aiMsg = {
                id: `msg-${generateId()}`,
                senderId: 'ai-incognito',
                body: aiBody,
                createdAt: new Date().toISOString()
            };

            addIncognitoMessage(aiMsg);
        } catch (error) {
            console.error('Failed incognito AI response:', error);
            addIncognitoMessage({
                id: `msg-${generateId()}`,
                senderId: 'ai-incognito',
                body: "I'm currently unable to reach the AI engine securely. Please try again.",
                createdAt: new Date().toISOString()
            });
        } finally {
            setIsTyping(false);
        }
    };

    const handleClear = () => {
        clearIncognitoMessages();
    };

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
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400 border border-indigo-500/30">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 17a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9.5C2 7 4 5 6.5 5H18c2.2 0 4 1.8 4 4v8Z" />
                            <polyline points="15,9 18,9 22,15" />
                            <path d="M2 15h4.5c.5 0 1-.2 1.4-.5l3.5-3.5" />
                            <circle cx="9" cy="13" r="1.5" />
                            <circle cx="16" cy="13" r="1.5" />
                        </svg>
                    </div>
                    <div>
                        <h1 className="font-semibold text-sm tracking-wide">Incognito</h1>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={handleClear} className="h-8 text-[11px] text-[var(--color-gray-500)] hover:text-[var(--color-foreground)] group">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-1.5 group-hover:rotate-180 transition-transform duration-500">
                            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                            <path d="M3 3v5h5" />
                        </svg>
                        Obliviate
                    </Button>
                    <div className="w-px h-4 bg-[var(--color-border)] mx-1"></div>
                    <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 text-[var(--color-gray-500)] hover:text-[var(--color-foreground)] rounded-full hover:bg-[var(--color-foreground)]/10">
                        <svg width="14" height="14" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M11.7816 4.03157C12.0062 3.80702 12.0062 3.44295 11.7816 3.2184C11.5571 2.99385 11.193 2.99385 10.9685 3.2184L7.50005 6.68682L4.03164 3.2184C3.80708 2.99385 3.44301 2.99385 3.21846 3.2184C2.99391 3.44295 2.99391 3.80702 3.21846 4.03157L6.68688 7.49999L3.21846 10.9684C2.99391 11.193 2.99391 11.557 3.21846 11.7816C3.44301 12.0061 3.80708 12.0061 4.03164 11.7816L7.50005 8.31316L10.9685 11.7816C11.193 12.0061 11.5571 12.0061 11.7816 11.7816C12.0062 11.557 12.0062 11.193 11.7816 10.9684L8.31322 7.49999L11.7816 4.03157Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd" />
                        </svg>
                    </Button>
                </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto px-4 py-6 scroll-smooth custom-scrollbar relative">

                {/* Background watermarks */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden flex items-center justify-center opacity-[0.03]">
                    <svg className="w-96 h-96 transform -rotate-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                        <path d="M2 12C2 17.5 6.5 22 12 22C17.5 22 22 17.5 22 12" strokeDasharray="4 4" />
                        <path d="M12 2C6.5 2 2 6.5 2 12" strokeDasharray="4 4" />
                        <path d="M22 12C22 6.5 17.5 2 12 2" strokeDasharray="4 4" />
                        <path d="M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" />
                        <path d="M12 15L12 22" />
                    </svg>
                </div>

                <div className="max-w-4xl mx-auto space-y-6 relative z-10">
                    <AnimatePresence initial={false}>
                        {incognitoMessages.map((msg) => {
                            const isOwn = msg.senderId === 'me';
                            return (
                                <Motion.div
                                    key={msg.id}
                                    initial={{ opacity: 0, y: 10, scale: 0.98 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    transition={{ duration: 0.3, type: "spring", stiffness: 300, damping: 25 }}
                                    className={cn("flex gap-3", isOwn ? "flex-row-reverse" : "")}
                                >
                                    {/* Avatar */}
                                    <div className="shrink-0 mt-auto">
                                        {isOwn ? (
                                            <Avatar src={user?.avatarUrl} name={user?.username} size="sm" className="opacity-70 grayscale" />
                                        ) : (
                                            <div className="w-8 h-8 rounded-full bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.2)]">
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M12 2a2 2 0 0 1 2 2c0 1.1-.9 2-2 2s-2-.9-2-2a2 2 0 0 1 2-2Z" />
                                                    <path d="M12 6v6" />
                                                    <path d="M8 8h8" />
                                                    <path d="m14 14 3-3" />
                                                    <path d="m10 14-3-3" />
                                                    <path d="m12 16v6" />
                                                    <path d="m16 22-4-2-4 2" />
                                                </svg>
                                            </div>
                                        )}
                                    </div>

                                    <div className={cn(
                                        "px-5 py-3.5 max-w-[85%] text-sm leading-relaxed backdrop-blur-md transition-all shadow-sm",
                                        isOwn
                                            ? "bg-[var(--color-foreground)]/10 text-[var(--color-foreground)] rounded-2xl rounded-br-sm border border-[var(--color-border)]"
                                            : "glass-strong text-[var(--color-foreground)] rounded-2xl rounded-bl-sm border border-indigo-500/20"
                                    )}>
                                        {isOwn ? (
                                            msg.body
                                        ) : (
                                            <div className="prose prose-sm dark:prose-invert max-w-none 
                                                prose-p:leading-relaxed prose-pre:bg-black/20 prose-pre:border prose-pre:border-indigo-500/20 prose-pre:rounded-lg
                                                prose-a:text-indigo-400 prose-strong:text-[var(--color-foreground)] mt-[-0.5rem] mb-[-0.5rem]
                                            ">
                                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                    {msg.body}
                                                </ReactMarkdown>
                                            </div>
                                        )}
                                    </div>
                                </Motion.div>
                            )
                        })}
                    </AnimatePresence>

                    {/* Typing Indicator */}
                    {isTyping && (
                        <Motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="flex gap-3"
                        >
                            <div className="shrink-0 mt-auto">
                                <div className="w-8 h-8 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                                    <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                </div>
                            </div>
                            <div className="px-5 py-4 bg-indigo-500/5 rounded-2xl rounded-bl-sm border border-indigo-500/10 flex items-center gap-1.5 shadow-sm">
                                <div className="w-1.5 h-1.5 bg-indigo-400/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                <div className="w-1.5 h-1.5 bg-indigo-400/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                <div className="w-1.5 h-1.5 bg-indigo-400/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                        </Motion.div>
                    )}

                    <div ref={messagesEndRef} className="h-4" />
                </div>
            </div>

            {/* Input Area */}
            <div className="p-4 bg-[var(--color-background)]/80 backdrop-blur-md border-t border-[var(--color-border)] relative shrink-0">
                <div className="max-w-4xl mx-auto">
                    <form onSubmit={handleSend} className="relative flex items-center bg-[var(--color-background)] border border-[var(--color-border)] rounded-2xl p-1 shadow-lg focus-within:border-indigo-500/50 transition-all duration-300">

                        <div className="pl-3 pr-2 text-indigo-400">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 2c-1.7 0-3 1.2-3 2.6v6.8c0 1.4 1.3 2.6 3 2.6s3-1.2 3-2.6V4.6C15 3.2 13.7 2 12 2z" />
                                <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
                                <line x1="12" y1="18" x2="12" y2="22" />
                            </svg>
                        </div>

                        <input
                            autoFocus
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Type a stealth message... (vanishes on refresh)"
                            className="flex-1 bg-transparent border-none text-[var(--color-foreground)] text-sm focus:ring-0 placeholder:text-[var(--color-gray-500)] px-2 py-3 outline-none"
                        />

                        <Button
                            type="submit"
                            disabled={!input.trim()}
                            className="h-9 w-9 p-0 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white shadow-[0_0_15px_rgba(99,102,241,0.4)] disabled:opacity-30 disabled:shadow-none transition-all duration-300 flex items-center justify-center shrink-0 mr-1"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="ml-0.5">
                                <line x1="22" y1="2" x2="11" y2="13"></line>
                                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                            </svg>
                        </Button>
                    </form>
                    <div className="mt-2 text-center flex items-center justify-center gap-2">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-500">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                        </svg>
                        <p className="text-[10px] text-gray-500 font-medium tracking-wide">END-TO-END ENCRYPTED</p>
                    </div>
                </div>
            </div>
        </Motion.div>
    );
}

