package com.blink.chatservice.user.migration;

import com.blink.chatservice.user.entity.RefreshToken;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.model.Accumulators;
import com.mongodb.client.model.Aggregates;
import com.mongodb.client.model.Filters;
import com.mongodb.client.model.IndexOptions;
import com.mongodb.client.model.Indexes;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.bson.Document;
import org.bson.conversions.Bson;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.index.Index;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;


@Component
@Profile("prod")
@RequiredArgsConstructor
@Slf4j
public class RefreshTokenIndexRepairRunner implements ApplicationRunner {

    private static final String COLLECTION = "refresh_tokens";
    private final MongoTemplate mongoTemplate;

    @Override
    public void run(ApplicationArguments args) {
        try {
            dedupeByToken();
            ensureIndexes();
        } catch (Exception e) {
            // Never crash the app because of an index repair attempt.
            log.error("Refresh token index repair failed; continuing startup. Cause: {}", e.getMessage());
        }
    }

    private void dedupeByToken() {
        MongoCollection<Document> collection = mongoTemplate.getCollection(COLLECTION);

        List<Bson> pipeline = List.of(
                Aggregates.match(Filters.and(
                        Filters.exists("token", true),
                        Filters.ne("token", null)
                )),
                Aggregates.group("$token",
                        Accumulators.push("ids", "$_id"),
                        Accumulators.sum("count", 1)
                ),
                Aggregates.match(Filters.gt("count", 1))
        );

        int groups = 0;
        long deleted = 0;

        for (Document group : collection.aggregate(pipeline).allowDiskUse(true)) {
            groups++;
            @SuppressWarnings("unchecked")
            List<Object> ids = (List<Object>) group.get("ids");
            if (ids == null || ids.size() <= 1) continue;

            // Keep the first doc, delete the rest. (Same token => equivalent for our purposes.)
            List<Object> toDelete = new ArrayList<>(ids.subList(1, ids.size()));
            if (!toDelete.isEmpty()) {
                deleted += collection.deleteMany(Filters.in("_id", toDelete)).getDeletedCount();
            }
        }

        if (groups > 0) {
            log.warn("Refresh token dedupe removed {} docs across {} duplicate-token groups", deleted, groups);
        } else {
            log.info("Refresh token dedupe: no duplicates found");
        }
    }

    private void ensureIndexes() {
        mongoTemplate.indexOps(RefreshToken.class).ensureIndex(
                new Index("userId", Sort.Direction.ASC)
        );
        mongoTemplate.indexOps(RefreshToken.class).ensureIndex(
                new Index("token", Sort.Direction.ASC).unique()
        );
    }
}
