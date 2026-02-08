import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';

const MessageInput = forwardRef(({ onSend, disabled = false, onTypingChange }, ref) => {
  const [text, setText] = useState('');
  const textareaRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const lastTypingStateRef = useRef(false);
  const MAX_LENGTH = 2000;

  useImperativeHandle(ref, () => ({
    setText: (newText) => {
      setText(newText);
      // Auto focus
      if (textareaRef.current) {
        textareaRef.current.focus();
        // Adjust height
        setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(
              textareaRef.current.scrollHeight,
              120
            )}px`;
          }
        }, 0);
      }
    }
  }));

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (onTypingChange && lastTypingStateRef.current) {
        onTypingChange(false);
      }
    };
  }, [onTypingChange]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        120
      )}px`;
    }
  }, [text]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || disabled) return;

    // Validate message length
    if (trimmed.length > MAX_LENGTH) {
      return;
    }

    // Stop typing indicator
    if (onTypingChange && lastTypingStateRef.current) {
      lastTypingStateRef.current = false;
      onTypingChange(false);
    }
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    onSend(trimmed);
    setText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const remainingChars = MAX_LENGTH - text.length;
  const isNearLimit = remainingChars < 100;
  const isOverLimit = remainingChars < 0;

  return (
    <div className="w-full">
      <form
        onSubmit={handleSubmit}
        className="flex items-end gap-3 max-w-full"
      >
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => {
              const newText = e.target.value;
              if (newText.length <= MAX_LENGTH) {
                setText(newText);

                // Handle typing indicator
                if (onTypingChange) {
                  const isTyping = newText.trim().length > 0;

                  // Clear existing timeout
                  if (typingTimeoutRef.current) {
                    clearTimeout(typingTimeoutRef.current);
                  }

                  // Update typing state if changed
                  if (isTyping !== lastTypingStateRef.current) {
                    lastTypingStateRef.current = isTyping;
                    onTypingChange(isTyping);
                  }

                  // Stop typing after 3 seconds of inactivity
                  if (isTyping) {
                    typingTimeoutRef.current = setTimeout(() => {
                      if (lastTypingStateRef.current) {
                        lastTypingStateRef.current = false;
                        onTypingChange(false);
                      }
                    }, 3000);
                  }
                }
              }
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="w-full min-h-12 max-h-32 resize-none overflow-y-auto rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-[0.95rem] leading-relaxed text-white placeholder:text-slate-500 transition focus:outline-none focus:border-indigo-500/50 focus:bg-black/50 focus:ring-1 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-60 custom-scrollbar"
            rows={1}
            disabled={disabled}
            maxLength={MAX_LENGTH}
          />
          {isNearLimit && (
            <div className={`absolute bottom-2 right-2 text-xs ${isOverLimit ? 'text-red-500' : 'text-slate-500'
              }`}>
              {remainingChars}
            </div>
          )}
        </div>
        <button
          type="submit"
          disabled={!text.trim() || disabled || isOverLimit}
          title="Send message (Enter)"
          className="inline-flex h-12 w-12 min-w-12 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-500 hover:-translate-y-0.5 hover:shadow-indigo-600/30 active:translate-y-0 disabled:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5 ml-0.5"
          >
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
        </button>
      </form>
    </div>
  );
});

MessageInput.displayName = 'MessageInput';
export default MessageInput;
