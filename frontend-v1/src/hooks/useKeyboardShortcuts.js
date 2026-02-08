import { useEffect } from 'react';

export function useKeyboardShortcuts({
  onSearch,
  onNewChat,
  onEscape,
}) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl+K or Cmd+K for search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        if (onSearch) {
          onSearch();
        }
      }
      
      // Ctrl+N or Cmd+N for new chat
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        if (onNewChat) {
          onNewChat();
        }
      }
      
      // Escape key
      if (e.key === 'Escape') {
        if (onEscape) {
          onEscape();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSearch, onNewChat, onEscape]);
}
