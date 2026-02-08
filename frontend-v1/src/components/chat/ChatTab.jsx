export default function ChatTab({
  conversation,
  isActive,
  onSelect,
  onClose,
  getConversationTitle,
  getInitials,
}) {
  const title = getConversationTitle(conversation);
  const initials = getInitials(title);

  return (
    <div
      className={`group relative flex items-center gap-2 border-r border-neutral-200 dark:border-neutral-800 px-3 py-2 min-w-0 ${
        isActive
          ? 'bg-white dark:bg-neutral-950 border-b-2 border-b-indigo-500'
          : 'bg-neutral-50 dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800'
      } transition cursor-pointer`}
      onClick={() => onSelect(conversation.id)}
    >
      {/* Avatar */}
      <div className="h-6 w-6 shrink-0 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white flex items-center justify-center text-[0.65rem] font-semibold">
        {conversation.type === 'AI_ASSISTANT' ? '🤖' : initials}
      </div>

      {/* Title */}
      <div className="flex-1 min-w-0 truncate text-xs font-medium text-neutral-900 dark:text-neutral-50">
        {title}
      </div>

      {/* Close Button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose(conversation.id);
        }}
        className="opacity-0 group-hover:opacity-100 shrink-0 h-5 w-5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 flex items-center justify-center transition"
        aria-label="Close tab"
      >
        <svg
          className="h-3 w-3 text-neutral-500 dark:text-neutral-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  );
}
