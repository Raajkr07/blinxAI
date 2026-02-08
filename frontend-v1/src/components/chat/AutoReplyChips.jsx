import { useState, useEffect } from 'react';
import { getAutoReplies } from '../../api/aiApi';

export default function AutoReplyChips({ token, lastMessage, onSelectReply }) {
    const [replies, setReplies] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!token || !lastMessage || lastMessage.senderId === 'ai-assistant') {
            setReplies([]);
            return;
        }

        // Only suggest for messages from others
        // and if the message is recent (e.g., last 5 mins) to avoid stale suggestions
        // For now, we'll just fetch if it's not our own message

        // logic: if I am the sender, don't auto-reply to myself
        // Context is usually passed from parent. We'll assume parent checks this.

        const fetchReplies = async () => {
            setLoading(true);
            try {
                const data = await getAutoReplies(token, lastMessage.id, lastMessage.body, lastMessage.senderId);
                if (data && data.suggested_replies) {
                    setReplies(data.suggested_replies);
                }
            } catch (err) {
                // quiet failure
                console.warn("Failed to get auto-replies", err);
            } finally {
                setLoading(false);
            }
        };

        // Debounce or just run? Recent message check:
        fetchReplies();

    }, [token, lastMessage?.id]);

    if (replies.length === 0) return null;

    return (
        <div className="flex gap-2 mb-2 overflow-x-auto pb-1 px-1 custom-scrollbar">
            {loading && <div className="text-xs text-slate-500 animate-pulse">Thinking...</div>}
            {replies.map((reply, i) => (
                <button
                    key={i}
                    onClick={() => onSelectReply(reply)}
                    className="flex-shrink-0 animate-[fadeIn_0.3s_ease-out] px-3 py-1.5 rounded-full bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 text-xs font-medium text-indigo-300 transition-colors whitespace-nowrap"
                >
                    {reply}
                </button>
            ))}
        </div>
    );
}
