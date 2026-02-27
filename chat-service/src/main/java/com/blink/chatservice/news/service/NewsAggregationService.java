package com.blink.chatservice.news.service;

import java.io.ByteArrayInputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashSet;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import com.rometools.rome.feed.synd.SyndEnclosure;
import com.rometools.rome.feed.synd.SyndEntry;
import com.rometools.rome.feed.synd.SyndFeed;
import com.rometools.rome.feed.synd.SyndLink;
import com.rometools.rome.io.SyndFeedInput;
import com.rometools.rome.io.XmlReader;

import jakarta.annotation.PreDestroy;

@Service
public class NewsAggregationService {

    private static final Logger log = LoggerFactory.getLogger(NewsAggregationService.class);

    public record FeedPage(List<NewsItem> items, Integer nextOffset) {}

    public record NewsItem(
            String id,
            String title,
            String summary,
        String imageUrl,
            String url,
            String source,
            String publishedAt
    ) {}

    private static final int MAX_BYTES = 1_500_000;
    private static final Duration TIMEOUT = Duration.ofSeconds(12);
    private static final int MAX_TOTAL_ITEMS = 200;
    private static final Duration CACHE_TTL = Duration.ofSeconds(60);
    private static final int MAX_CACHE_ENTRIES = 100;

    private static final class CacheEntry {
        private final Instant createdAt;
        private final List<NewsItem> items;

        private CacheEntry(Instant createdAt, List<NewsItem> items) {
            this.createdAt = createdAt;
            this.items = items;
        }
    }

    private final Map<String, CacheEntry> feedCache = new ConcurrentHashMap<>();

    // Bounded thread pool to prevent HttpClient from creating unbounded cached threads
    private final ExecutorService httpExecutor = Executors.newFixedThreadPool(3, r -> {
        Thread t = new Thread(r, "news-http");
        t.setDaemon(true);
        return t;
    });

    private final HttpClient httpClient = HttpClient.newBuilder()
            .followRedirects(HttpClient.Redirect.NORMAL)
            .connectTimeout(TIMEOUT)
            .executor(httpExecutor)
            .build();

    // Periodic cleanup of expired feed cache entries every 2 minutes.
    // Prevents unbounded memory growth from stale cache entries.
    @Scheduled(fixedDelay = 120_000)
    public void evictExpiredCacheEntries() {
        Instant now = Instant.now();
        Iterator<Map.Entry<String, CacheEntry>> it = feedCache.entrySet().iterator();
        int removed = 0;
        while (it.hasNext()) {
            Map.Entry<String, CacheEntry> entry = it.next();
            if (entry.getValue().createdAt.plus(CACHE_TTL).isBefore(now)) {
                it.remove();
                removed++;
            }
        }
        if (removed > 0) {
            log.debug("Evicted {} expired news feed cache entries, remaining: {}", removed, feedCache.size());
        }
    }

    @PreDestroy
    public void shutdown() {
        feedCache.clear();
        httpExecutor.shutdownNow();
    }

    public FeedPage getFeedPage(List<String> sources, int offset, int limit) {
        if (sources == null || sources.isEmpty()) return new FeedPage(List.of(), null);
        if (offset < 0) offset = 0;
        if (limit < 1) limit = 1;

        List<NewsItem> all = getCachedFeed(sources);
        if (all.isEmpty()) return new FeedPage(List.of(), null);

        int from = Math.min(offset, all.size());
        int to = Math.min(from + limit, all.size());

        List<NewsItem> page = new ArrayList<>(all.subList(from, to));
        Integer next = to < all.size() ? to : null;
        return new FeedPage(page, next);
    }

    public List<NewsItem> getFeed(List<String> sources, int limit) {
        FeedPage page = getFeedPage(sources, 0, limit);
        return page.items();
    }

    private List<NewsItem> getCachedFeed(List<String> sources) {
        String key = cacheKeyForSources(sources);
        Instant now = Instant.now();

        CacheEntry cached = feedCache.get(key);
        if (cached != null && cached.createdAt != null && cached.items != null) {
            if (cached.createdAt.plus(CACHE_TTL).isAfter(now)) {
                return cached.items;
            }
        }

        List<NewsItem> computed = getFeedUncached(sources, MAX_TOTAL_ITEMS);
        List<NewsItem> immutable = List.copyOf(computed);

        // Enforce max cache size to prevent memory leak
        if (feedCache.size() >= MAX_CACHE_ENTRIES) {
            evictExpiredCacheEntries();
            // If still over limit, remove oldest entry
            if (feedCache.size() >= MAX_CACHE_ENTRIES) {
                feedCache.entrySet().stream()
                        .min(Comparator.comparing(e -> e.getValue().createdAt))
                        .ifPresent(oldest -> feedCache.remove(oldest.getKey()));
            }
        }

        feedCache.put(key, new CacheEntry(now, immutable));
        return immutable;
    }

    private static String cacheKeyForSources(List<String> sources) {
        if (sources == null || sources.isEmpty()) return "";
        List<String> normalized = new ArrayList<>();
        for (String s : sources) {
            if (s == null) continue;
            String t = s.trim();
            if (t.isBlank()) continue;
            normalized.add(t.toLowerCase(Locale.ROOT));
        }
        Collections.sort(normalized);
        return sha256(String.join("\n", normalized));
    }

    private List<NewsItem> getFeedUncached(List<String> sources, int limit) {
        if (sources == null || sources.isEmpty()) return List.of();

        Map<String, NewsItem> dedup = new LinkedHashMap<>();

        for (String sourceUrl : sources) {
            if (dedup.size() >= limit) break;
            if (sourceUrl == null || sourceUrl.isBlank()) continue;

            String trimmed = sourceUrl.trim();
            String normalized = trimmed.startsWith("http") ? trimmed : "https://" + trimmed;

            Optional<URI> uriOpt = tryParseSafeHttpUri(normalized);
            if (uriOpt.isEmpty()) continue;

            try {
                // Attempt direct feed parsing
                List<NewsItem> items = fetchAndParseFeed(uriOpt.get(), limit);
                if (items.isEmpty()) {
                    // Try HTML discovery for RSS/Atom
                    items = discoverAndParseFromHtml(uriOpt.get(), limit);
                }
                if (items.isEmpty()) continue;

                for (NewsItem item : items) {
                    if (item == null || item.url() == null || item.url().isBlank()) continue;
                    dedup.putIfAbsent(item.url(), item);
                    if (dedup.size() >= limit) break;
                }
            } catch (Exception ignored) {
                // Intentionally ignore failures per-source.
            }
        }

        List<NewsItem> result = new ArrayList<>(dedup.values());
        result.sort((a, b) -> {
            Instant ia = parseInstant(a.publishedAt());
            Instant ib = parseInstant(b.publishedAt());
            if (ia == null && ib == null) return 0;
            if (ia == null) return 1;
            if (ib == null) return -1;
            return ib.compareTo(ia);
        });

        if (result.size() > limit) {
            return result.subList(0, limit);
        }
        return result;
    }

    private List<NewsItem> fetchAndParseFeed(URI uri, int limit) throws Exception {
        FetchResult fetch = fetch(uri);
        if (fetch == null || fetch.bodyBytes == null || fetch.bodyBytes.length == 0) return List.of();

        String contentType = fetch.contentType == null ? "" : fetch.contentType.toLowerCase(Locale.ROOT);
        boolean looksLikeXml = contentType.contains("xml") || contentType.contains("rss") || contentType.contains("atom");
        boolean looksLikeFeedText = startsWithAny(fetch.bodyBytes, "<rss", "<feed", "<?xml");

        if (!looksLikeXml && !looksLikeFeedText) {
            return List.of();
        }

        SyndFeedInput input = new SyndFeedInput();
        SyndFeed feed;
        try (XmlReader reader = new XmlReader(new ByteArrayInputStream(fetch.bodyBytes))) {
            feed = input.build(reader);
        }

        String sourceName = safeTrim(feed.getTitle());
        if (sourceName == null || sourceName.isBlank()) sourceName = hostOf(uri);

        List<NewsItem> items = new ArrayList<>();
        List<SyndEntry> entries = feed.getEntries();
        if (entries == null) return List.of();

        for (SyndEntry entry : entries) {
            if (items.size() >= Math.min(limit, 50)) break;

            String link = safeTrim(entry.getLink());
            if (link == null || link.isBlank()) continue;

            URI linkUri;
            try {
                linkUri = uri.resolve(link);
            } catch (Exception e) {
                continue;
            }

            Optional<URI> safeLink = tryParseSafeHttpUri(linkUri.toString());
            if (safeLink.isEmpty()) continue;

            String title = safeTrim(entry.getTitle());
            if (title == null || title.isBlank()) title = safeLink.get().getHost();

            String summary = null;
            if (entry.getDescription() != null) {
                summary = safeTrim(entry.getDescription().getValue());
            }
            if ((summary == null || summary.isBlank()) && entry.getContents() != null && !entry.getContents().isEmpty()) {
                summary = safeTrim(entry.getContents().get(0).getValue());
            }
            summary = cleanSnippet(summary, 420);

            String imageUrl = extractImageUrl(entry, safeLink.get(), uri);

            Instant published = null;
            if (entry.getPublishedDate() != null) {
                published = entry.getPublishedDate().toInstant();
            } else if (entry.getUpdatedDate() != null) {
                published = entry.getUpdatedDate().toInstant();
            }

            items.add(new NewsItem(
                    sha256(link),
                    title,
                    summary,
                    imageUrl,
                    safeLink.get().toString(),
                    sourceName,
                    published == null ? null : DateTimeFormatter.ISO_OFFSET_DATE_TIME.format(published.atOffset(ZoneOffset.UTC))
            ));
        }

        return items;
    }

    private List<NewsItem> discoverAndParseFromHtml(URI uri, int limit) throws Exception {
        FetchResult fetch = fetch(uri);
        if (fetch == null || fetch.bodyBytes == null || fetch.bodyBytes.length == 0) return List.of();

        String html = new String(fetch.bodyBytes, StandardCharsets.UTF_8);
        Document doc = Jsoup.parse(html, uri.toString());

        // Try RSS/Atom discovery
        Elements alternates = doc.select("link[rel=alternate][type*=rss], link[rel=alternate][type*=atom], link[type*=rss], link[type*=atom]");
        for (Element el : alternates) {
            String href = safeTrim(el.attr("href"));
            if (href == null || href.isBlank()) continue;
            URI candidate = uri.resolve(href);
            Optional<URI> safe = tryParseSafeHttpUri(candidate.toString());
            if (safe.isEmpty()) continue;

            List<NewsItem> feedItems = fetchAndParseFeed(safe.get(), limit);
            if (!feedItems.isEmpty()) return feedItems;
        }

        // Fallback: treat as a simple list of links (title only)
        String sourceName = safeTrim(doc.title());
        if (sourceName == null || sourceName.isBlank()) sourceName = hostOf(uri);

        List<NewsItem> items = new ArrayList<>();
        Set<String> seen = new HashSet<>();

        Elements links = doc.select("a[href]");
        for (Element a : links) {
            if (items.size() >= Math.min(limit, 30)) break;

            String text = cleanWhitespace(a.text());
            if (text == null || text.length() < 18) continue;

            String href = a.attr("href");
            if (href == null || href.isBlank()) continue;

            URI resolved;
            try {
                resolved = uri.resolve(href);
            } catch (Exception e) {
                continue;
            }

            Optional<URI> safe = tryParseSafeHttpUri(resolved.toString());
            if (safe.isEmpty()) continue;

            String finalUrl = safe.get().toString();
            if (!seen.add(finalUrl)) continue;

            items.add(new NewsItem(
                    sha256(finalUrl),
                    text,
                    null,
                    null,
                    finalUrl,
                    sourceName,
                    null
            ));
        }

        return items;
    }

    private FetchResult fetch(URI uri) throws Exception {
        if (!UrlSafety.isSafePublicHttpUrl(uri)) {
            return null;
        }

        HttpRequest request = HttpRequest.newBuilder(uri)
                .timeout(TIMEOUT)
                .GET()
                .header("User-Agent", "BlinkChatServiceNewsFetcher/1.0")
                .header("Accept", "application/rss+xml, application/atom+xml, application/xml, text/xml, text/html;q=0.9, */*;q=0.8")
                .build();

        HttpResponse<byte[]> response = httpClient.send(request, HttpResponse.BodyHandlers.ofByteArray());
        int status = response.statusCode();
        if (status < 200 || status >= 300) {
            return null;
        }

        byte[] body = response.body();
        if (body == null) return null;
        if (body.length > MAX_BYTES) {
            body = Arrays.copyOf(body, MAX_BYTES);
        }

        String contentType = response.headers().firstValue("content-type").orElse(null);
        return new FetchResult(body, contentType);
    }

    private static final class FetchResult {
        private final byte[] bodyBytes;
        private final String contentType;

        private FetchResult(byte[] bodyBytes, String contentType) {
            this.bodyBytes = bodyBytes;
            this.contentType = contentType;
        }
    }

    private static Optional<URI> tryParseSafeHttpUri(String raw) {
        try {
            URI uri = URI.create(raw);
            if (uri.getScheme() == null) return Optional.empty();
            String scheme = uri.getScheme().toLowerCase(Locale.ROOT);
            if (!scheme.equals("http") && !scheme.equals("https")) return Optional.empty();
            if (uri.getHost() == null || uri.getHost().isBlank()) return Optional.empty();
            if (!UrlSafety.isSafePublicHttpUrl(uri)) return Optional.empty();
            return Optional.of(uri);
        } catch (Exception e) {
            return Optional.empty();
        }
    }

    private static String hostOf(URI uri) {
        return uri == null ? null : uri.getHost();
    }

    private static String safeTrim(String s) {
        return s == null ? null : s.trim();
    }

    private static String cleanWhitespace(String s) {
        if (s == null) return null;
        String cleaned = s.replaceAll("\\s+", " ").trim();
        return cleaned.isBlank() ? null : cleaned;
    }

    private static String cleanSnippet(String htmlOrText, int maxLen) {
        if (htmlOrText == null) return null;
        String txt = Jsoup.parse(htmlOrText).text();
        txt = cleanWhitespace(txt);
        if (txt == null) return null;
        if (txt.length() <= maxLen) return txt;
        return txt.substring(0, Math.max(0, maxLen - 1)).trim() + "…";
    }

    private String extractImageUrl(SyndEntry entry, URI entryUri, URI feedBaseUri) {
        if (entry == null) return null;

        URI baseForResolve = entryUri != null ? entryUri : feedBaseUri;

        // 1) RSS enclosures
        try {
            List<SyndEnclosure> enclosures = entry.getEnclosures();
            if (enclosures != null) {
                for (SyndEnclosure enc : enclosures) {
                    String t = enc == null ? null : safeTrim(enc.getType());
                    String u = enc == null ? null : safeTrim(enc.getUrl());
                    if (u == null || u.isBlank()) continue;
                    if (t != null && !t.isBlank() && !t.toLowerCase(Locale.ROOT).startsWith("image/")) {
                        continue;
                    }
                    URI resolved = baseForResolve == null ? URI.create(u) : baseForResolve.resolve(u);
                    Optional<URI> safe = tryParseSafeHttpUri(resolved.toString());
                    if (safe.isPresent()) return safe.get().toString();
                }
            }
        } catch (Exception ignored) {
            // ignore
        }

        // 2) Entry links with enclosure rel
        try {
            List<SyndLink> links = entry.getLinks();
            if (links != null) {
                for (SyndLink link : links) {
                    String rel = link == null ? null : safeTrim(link.getRel());
                    String type = link == null ? null : safeTrim(link.getType());
                    String href = link == null ? null : safeTrim(link.getHref());
                    if (href == null || href.isBlank()) continue;

                    boolean isEnclosure = rel != null && rel.equalsIgnoreCase("enclosure");
                    boolean looksLikeImage = type != null && type.toLowerCase(Locale.ROOT).startsWith("image/");
                    if (!isEnclosure && !looksLikeImage) continue;

                    URI resolved = baseForResolve == null ? URI.create(href) : baseForResolve.resolve(href);
                    Optional<URI> safe = tryParseSafeHttpUri(resolved.toString());
                    if (safe.isPresent()) return safe.get().toString();
                }
            }
        } catch (Exception ignored) {
            // ignore
        }

        // 3) media:* foreign markup (common in RSS)
        try {
            @SuppressWarnings("unchecked")
            List<org.jdom2.Element> foreign = entry.getForeignMarkup();
            if (foreign != null) {
                for (org.jdom2.Element el : foreign) {
                    if (el == null) continue;
                    String name = safeTrim(el.getName());
                    String prefix = safeTrim(el.getNamespacePrefix());
                    if (name == null) continue;

                    String lowered = name.toLowerCase(Locale.ROOT);
                    boolean maybeMedia = (prefix != null && prefix.equalsIgnoreCase("media"))
                            || lowered.contains("thumbnail")
                            || lowered.contains("content")
                            || lowered.contains("image");
                    if (!maybeMedia) continue;

                    String url = safeTrim(el.getAttributeValue("url"));
                    if (url == null || url.isBlank()) url = safeTrim(el.getAttributeValue("href"));
                    if (url == null || url.isBlank()) url = safeTrim(el.getAttributeValue("src"));
                    if (url == null || url.isBlank()) continue;

                    URI resolved = baseForResolve == null ? URI.create(url) : baseForResolve.resolve(url);
                    Optional<URI> safe = tryParseSafeHttpUri(resolved.toString());
                    if (safe.isPresent()) return safe.get().toString();
                }
            }
        } catch (Exception ignored) {
            // ignore
        }

        // 4) Look for <img src> in description/contents
        try {
            String html = null;
            if (entry.getDescription() != null) {
                html = entry.getDescription().getValue();
            }
            if ((html == null || html.isBlank()) && entry.getContents() != null && !entry.getContents().isEmpty()) {
                html = entry.getContents().get(0).getValue();
            }
            if (html == null || html.isBlank()) return null;

            Document doc = Jsoup.parse(html);
            Element img = doc.selectFirst("img[src]");
            if (img == null) return null;
            String src = safeTrim(img.attr("src"));
            if (src == null || src.isBlank()) return null;

            URI resolved = baseForResolve == null ? URI.create(src) : baseForResolve.resolve(src);
            Optional<URI> safe = tryParseSafeHttpUri(resolved.toString());
            return safe.map(URI::toString).orElse(null);
        } catch (Exception ignored) {
            return null;
        }
    }

    private static boolean startsWithAny(byte[] bytes, String... prefixes) {
        if (bytes == null) return false;
        String asText = new String(bytes, 0, Math.min(bytes.length, 256), StandardCharsets.UTF_8).trim().toLowerCase(Locale.ROOT);
        for (String p : prefixes) {
            if (asText.startsWith(p.toLowerCase(Locale.ROOT))) return true;
        }
        return false;
    }

    private static String sha256(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(hash.length * 2);
            for (byte b : hash) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (Exception e) {
            return UUID.randomUUID().toString();
        }
    }

    private static Instant parseInstant(String iso) {
        if (iso == null || iso.isBlank()) return null;
        try {
            return Instant.parse(iso);
        } catch (Exception ignored) {
            return null;
        }
    }
}
