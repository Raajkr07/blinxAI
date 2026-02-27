import { useEffect, useMemo, useRef, useState } from 'react';
import { motion as Motion } from 'framer-motion';
import { Button } from '../../ui';
import { useTempViewsStore } from '../../../stores';
import { newsService } from '../../../services';
import toast from 'react-hot-toast';
import { formatDistanceToNowStrict, parseISO } from 'date-fns';

export function WebToolsWindow({ onClose }) {
    const {
        newsSources,
        addNewsSource,
        removeNewsSource,
        selectNewsSource,
    } = useTempViewsStore();
    const [targetUrl, setTargetUrl] = useState('');
    const [targetAlias, setTargetAlias] = useState('');

    const [isLoadingFeed, setIsLoadingFeed] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [feedItems, setFeedItems] = useState([]);
    const [nextOffset, setNextOffset] = useState(null);
    const [imageFailures, setImageFailures] = useState({});

    const PAGE_SIZE = 20;

    const formatWhen = (isoString) => {
        if (!isoString) return null;
        try {
            const date = parseISO(isoString);
            return formatDistanceToNowStrict(date, { addSuffix: true });
        } catch {
            return isoString;
        }
    };

    const normalizedNewsItems = useMemo(() => {
        return (feedItems || []).filter(Boolean);
    }, [feedItems]);

    const selectedSources = useMemo(() => {
        return (newsSources || []).filter((s) => s?.selected);
    }, [newsSources]);

    const selectedSourceUrls = useMemo(() => {
        return selectedSources.map((s) => s.url);
    }, [selectedSources]);

    const normalizeHttpUrl = (rawUrl) => {
        const trimmed = (rawUrl || '').trim();
        if (!trimmed) return null;
        if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
        return `https://${trimmed}`;
    };

    const resolveImageUrl = (rawUrl) => {
        const url = normalizeHttpUrl(rawUrl);
        if (!url) return null;
        // Avoid mixed-content issues when the app is served over https.
        if (typeof window !== 'undefined' && window.location?.protocol === 'https:' && url.startsWith('http://')) {
            return url.replace(/^http:\/\//i, 'https://');
        }
        return url;
    };

    useEffect(() => {
        let isCancelled = false;

        const load = async () => {
            if (!selectedSourceUrls || selectedSourceUrls.length === 0) {
                setFeedItems([]);
                setNextOffset(null);
                return;
            }

            setIsLoadingFeed(true);
            setNextOffset(null);
            try {
                const data = await newsService.getFeed({ sources: selectedSourceUrls, limit: PAGE_SIZE, offset: 0 });
                const items = Array.isArray(data?.items) ? data.items : [];
                const nxt = typeof data?.nextOffset === 'number' ? data.nextOffset : null;
                if (!isCancelled) {
                    setFeedItems(items);
                    setNextOffset(nxt);
                }
            } catch (err) {
                if (!isCancelled) {
                    setFeedItems([]);
                    setNextOffset(null);
                    toast.error(err?.message || 'Failed to load news feed.');
                }
            } finally {
                if (!isCancelled) setIsLoadingFeed(false);
            }
        };

        load();
        return () => {
            isCancelled = true;
        };
    }, [selectedSourceUrls]);

    const handleLoadMore = async () => {
        if (!selectedSourceUrls || selectedSourceUrls.length === 0) return;
        if (isLoadingFeed || isLoadingMore) return;
        if (typeof nextOffset !== 'number') return;

        setIsLoadingMore(true);
        try {
            const data = await newsService.getFeed({
                sources: selectedSourceUrls,
                limit: PAGE_SIZE,
                offset: nextOffset,
            });
            const items = Array.isArray(data?.items) ? data.items : [];
            const nxt = typeof data?.nextOffset === 'number' ? data.nextOffset : null;
            setFeedItems((prev) => [...(prev || []), ...items]);
            setNextOffset(nxt);
        } catch (err) {
            toast.error(err?.message || 'Failed to load more news.');
        } finally {
            setIsLoadingMore(false);
        }
    };

    const handleAddLink = () => {
        const trimmed = targetUrl.trim();
        if (!trimmed) {
            toast.error('Please enter a URL.');
            return;
        }

        addNewsSource({ url: trimmed, alias: targetAlias.trim() });
        setTargetUrl('');
        setTargetAlias('');
    };

    const handleOpenUrl = (url) => {
        try {
            const normalized = normalizeHttpUrl(url);
            if (!normalized) throw new Error('Missing url');
            window.open(normalized, '_blank', 'noopener,noreferrer');
        } catch {
            toast.error('Unable to open the link.');
        }
    };

    const clickTimersRef = useRef(new Map());

    const handleSourceTap = (source) => {
        const key = source.id;
        const existingTimer = clickTimersRef.current.get(key);
        if (existingTimer) {
            clearTimeout(existingTimer);
            clickTimersRef.current.delete(key);
            handleOpenUrl(source.url.startsWith('http') ? source.url : `https://${source.url}`);
            return;
        }

        const timer = setTimeout(() => {
            clickTimersRef.current.delete(key);
            selectNewsSource(source.id);
        }, 240);

        clickTimersRef.current.set(key, timer);
    };

    const FeedSkeleton = ({ count = 6 } = {}) => {
        return (
            <div className="space-y-3">
                {Array.from({ length: count }).map((_, idx) => (
                    <div
                        key={idx}
                        className="w-full p-5 rounded-2xl bg-[var(--color-background)]/60 border border-[var(--color-border)] shadow-sm animate-pulse"
                    >
                        <div className="flex items-start gap-4">
                            <div className="shrink-0 w-40 h-40 rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)]/80" />
                            <div className="min-w-0 flex-1">
                                <div className="h-4 w-3/4 rounded bg-[var(--color-foreground)]/10" />
                                <div className="mt-3 space-y-2">
                                    <div className="h-3 w-full rounded bg-[var(--color-foreground)]/10" />
                                    <div className="h-3 w-11/12 rounded bg-[var(--color-foreground)]/10" />
                                    <div className="h-3 w-10/12 rounded bg-[var(--color-foreground)]/10" />
                                </div>
                                <div className="mt-4 h-3 w-40 rounded bg-[var(--color-foreground)]/10" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        );
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
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400 border border-emerald-500/30">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M19 20H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h11l5 5v9a2 2 0 0 1-2 2Z" />
                            <path d="M17 20v-8H7v8" />
                            <path d="M7 8h8" />
                        </svg>
                    </div>
                    <div>
                        <h1 className="font-semibold text-emerald-400 text-sm tracking-wide">News</h1>
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

            <div className="flex-1 overflow-hidden flex flex-col md:flex-row relative z-10 custom-scrollbar">
                {/* Main Content Area */}
                <div className="flex-1 overflow-y-auto px-4 py-6">
                    <div className="max-w-3xl mx-auto">
                        <div className="mb-5 text-center">
                            <h2 className="text-xl font-semibold text-[var(--color-foreground)]">Today’s News</h2>
                            <p className="text-xs text-[var(--color-gray-500)] mt-1">Select a source on the right. Tap a story to read.</p>
                        </div>

                        {isLoadingFeed && normalizedNewsItems.length === 0 ? (
                            <FeedSkeleton count={6} />
                        ) : null}

                        {!isLoadingFeed && normalizedNewsItems.length === 0 ? (
                            <div className="text-center py-16 bg-[var(--color-background)]/60 border border-[var(--color-border)] rounded-2xl">
                                <div className="mx-auto w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20">
                                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M19 20H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h11l5 5v9a2 2 0 0 1-2 2Z" />
                                        <path d="M8 7h6" />
                                        <path d="M8 11h8" />
                                        <path d="M8 15h8" />
                                    </svg>
                                </div>
                                <p className="text-sm text-[var(--color-gray-400)] mt-4">No source selected.</p>
                                <p className="text-xs text-[var(--color-gray-500)] mt-1">Select a source on the right, or add one.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {normalizedNewsItems.map((item) => (
                                    <button
                                        key={item.id || item.url}
                                        type="button"
                                        onClick={() => handleOpenUrl(item.url)}
                                        className="w-full text-left p-5 rounded-2xl bg-[var(--color-background)]/60 border border-[var(--color-border)] hover:border-emerald-500/40 hover:bg-emerald-500/5 transition-colors shadow-sm"
                                    >
                                        <div className="flex items-start gap-4">
                                            {(() => {
                                                const imgUrl = resolveImageUrl(item.imageUrl);
                                                const canShowImg = !!imgUrl && !imageFailures[imgUrl];
                                                return (
                                                    <div className="shrink-0 w-40 h-40 rounded-2xl overflow-hidden border border-[var(--color-border)] bg-[var(--color-background)]/60">
                                                        {canShowImg ? (
                                                            <img
                                                                src={imgUrl}
                                                                alt={item.title || 'News'}
                                                                className="w-full h-full object-cover"
                                                                loading="lazy"
                                                                decoding="async"
                                                                onError={() => {
                                                                    setImageFailures((prev) => ({
                                                                        ...(prev || {}),
                                                                        [imgUrl]: true,
                                                                    }));
                                                                }}
                                                            />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center text-emerald-400/70">
                                                                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                    <path d="M19 20H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h11l5 5v9a2 2 0 0 1-2 2Z" />
                                                                    <path d="M8 11h8" />
                                                                    <path d="M8 15h6" />
                                                                </svg>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })()}
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center justify-between gap-3">
                                                    <p className="text-sm font-semibold text-[var(--color-foreground)] truncate">
                                                        {item.title || item.url}
                                                    </p>
                                                    <span className="shrink-0 text-[11px] text-emerald-400/90">Read</span>
                                                </div>
                                                {item.summary ? (
                                                    <p className="text-sm leading-relaxed text-[var(--color-gray-300)] mt-2 whitespace-normal">
                                                        {item.summary}
                                                    </p>
                                                ) : (
                                                    <p className="text-xs text-[var(--color-gray-500)] mt-1 truncate">
                                                        {item.url}
                                                    </p>
                                                )}

                                                <div className="flex items-center gap-2 mt-2 text-[11px] text-[var(--color-gray-500)]">
                                                    {item.source ? <span className="truncate max-w-[10rem]">{item.source}</span> : null}
                                                    {item.source && item.publishedAt ? <span>•</span> : null}
                                                    {item.publishedAt ? <span className="truncate">{formatWhen(item.publishedAt)}</span> : null}
                                                </div>
                                            </div>
                                        </div>
                                    </button>
                                ))}

                                {isLoadingMore ? (
                                    <div className="pt-2">
                                        <FeedSkeleton count={2} />
                                    </div>
                                ) : null}

                                {!isLoadingFeed && !isLoadingMore && typeof nextOffset === 'number' ? (
                                    <div className="flex justify-center pt-2">
                                        <Button
                                            onClick={handleLoadMore}
                                            variant="default"
                                            className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl px-6"
                                        >
                                            Load more
                                        </Button>
                                    </div>
                                ) : null}
                            </div>
                        )}
                    </div>
                </div>

                {/* Sidebar area for successful websites */}
                <div className="w-full md:w-72 border-t md:border-t-0 md:border-l border-[var(--color-border)] bg-[var(--color-background)]/50 py-4 pr-4 pl-6 overflow-y-auto">
                    <h3 className="text-xs font-semibold text-[var(--color-gray-400)] uppercase tracking-wider mb-3 border-b border-[var(--color-border)] pb-2">Link Attachments</h3>

                    <div className="mb-4">
                        <label className="block text-[11px] text-[var(--color-gray-500)] mb-2">Add source URL + alias</label>
                        <div className="space-y-2">
                            <input
                                type="text"
                                value={targetAlias}
                                onChange={(e) => setTargetAlias(e.target.value)}
                                placeholder="Alias (e.g. Way2News)"
                                className="w-full bg-[var(--color-background)]/80 border border-[var(--color-border)] rounded-xl px-3 py-2 text-xs text-[var(--color-foreground)] focus:outline-none focus:border-emerald-500/50 transition-colors shadow-inner"
                            />
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                value={targetUrl}
                                onChange={(e) => setTargetUrl(e.target.value)}
                                placeholder="https://example.com"
                                className="flex-1 min-w-0 bg-[var(--color-background)]/80 border border-[var(--color-border)] rounded-xl px-3 py-2 text-xs text-[var(--color-foreground)] focus:outline-none focus:border-emerald-500/50 transition-colors shadow-inner font-mono"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleAddLink();
                                }}
                                />
                                <Button
                                    onClick={handleAddLink}
                                    variant="default"
                                    className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl px-3"
                                >
                                    Add
                                </Button>
                            </div>
                        </div>
                        <p className="mt-2 text-[11px] text-[var(--color-gray-500)]">Tap once to select source • tap twice to open source</p>
                    </div>

                    {(!newsSources || newsSources.length === 0) ? (
                        <p className="text-xs text-[var(--color-gray-500)] text-center py-4">No links added yet.</p>
                    ) : (
                        <ul className="space-y-2">
                            {newsSources.map((source) => (
                                <li key={source.id}>
                                    <div className={`w-full p-3 rounded-xl border transition-all shadow-sm text-sm flex items-center gap-3 group ${source.selected ? 'border-emerald-500/50 bg-emerald-500/10' : 'bg-[var(--color-background)]/60 border-[var(--color-border)] hover:border-emerald-500/50 hover:bg-emerald-500/10'} `}>
                                        <button
                                            type="button"
                                            onClick={() => handleSourceTap(source)}
                                            className="flex items-center gap-3 min-w-0 flex-1 text-left"
                                        >
                                        <div className="bg-emerald-500/20 p-2 rounded-lg text-emerald-500 group-hover:scale-110 transition-transform">
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                            </svg>
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="truncate group-hover:text-emerald-400 transition-colors font-semibold">{source.alias || source.url}</span>
                                                {source.selected ? <span className="text-[10px] text-emerald-400/90">Selected</span> : null}
                                            </div>
                                            <div className="text-[11px] text-[var(--color-gray-500)] truncate mt-0.5">{source.url}</div>
                                        </div>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                removeNewsSource(source.id);
                                            }}
                                            aria-label={`Remove ${source.url}`}
                                            className="shrink-0 rounded-lg p-2 text-[var(--color-gray-500)] hover:text-[var(--color-foreground)] hover:bg-[var(--color-foreground)]/10 transition-colors"
                                        >
                                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M3 6h18" />
                                                <path d="M8 6V4h8v2" />
                                                <path d="M19 6l-1 14H6L5 6" />
                                                <path d="M10 11v6" />
                                                <path d="M14 11v6" />
                                            </svg>
                                        </button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </Motion.div>
    );
}
