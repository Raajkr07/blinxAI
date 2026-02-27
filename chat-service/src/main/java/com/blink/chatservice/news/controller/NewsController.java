package com.blink.chatservice.news.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.blink.chatservice.news.service.NewsAggregationService;
import com.blink.chatservice.news.service.NewsAggregationService.NewsItem;

@RestController
@RequestMapping("/api/v1/news")
public class NewsController {

    private final NewsAggregationService newsAggregationService;

    public NewsController(NewsAggregationService newsAggregationService) {
        this.newsAggregationService = newsAggregationService;
    }

    public record NewsFeedRequest(List<String> sources, Integer limit, Integer offset) {}
    public record NewsFeedResponse(List<NewsItem> items, Integer nextOffset) {}

    @PostMapping("/feed")
    public ResponseEntity<NewsFeedResponse> getFeed(Authentication auth, @RequestBody NewsFeedRequest request) {
        if (auth == null || auth.getName() == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        List<String> sources = request == null ? null : request.sources();
        Integer limitBoxed = request == null ? null : request.limit();
        Integer offsetBoxed = request == null ? null : request.offset();

        int limit = limitBoxed == null ? 20 : limitBoxed;
        int offset = offsetBoxed == null ? 0 : offsetBoxed;

        if (sources == null) {
            return ResponseEntity.ok(new NewsFeedResponse(List.of(), null));
        }
        if (sources.size() > 50) {
            return ResponseEntity.badRequest().build();
        }
        if (offset < 0) offset = 0;
        if (limit < 1) limit = 1;
        // Encourage pagination: keep page size bounded.
        if (limit > 50) limit = 50;

        NewsAggregationService.FeedPage page = newsAggregationService.getFeedPage(sources, offset, limit);
        return ResponseEntity.ok(new NewsFeedResponse(page.items(), page.nextOffset()));
    }
}
