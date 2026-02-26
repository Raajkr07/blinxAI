package com.blink.chatservice.user.migration;

import java.util.ArrayList;
import java.util.List;

import org.bson.Document;
import org.bson.conversions.Bson;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.Index;
import org.springframework.data.mongodb.core.index.IndexOperations;
import org.springframework.stereotype.Component;

import com.mongodb.client.MongoCollection;
import com.mongodb.client.model.Accumulators;
import com.mongodb.client.model.Aggregates;
import com.mongodb.client.model.Filters;

@Component
@Profile("prod")
public class RefreshTokenIndexRepairRunner implements ApplicationRunner {

    private static final Logger log =
            LoggerFactory.getLogger(RefreshTokenIndexRepairRunner.class);

    private static final String COLLECTION = "refresh_tokens";

    private final MongoTemplate mongoTemplate;

    public RefreshTokenIndexRepairRunner(MongoTemplate mongoTemplate) {
        this.mongoTemplate = mongoTemplate;
    }

    @Override
    public void run(ApplicationArguments args) {
        try {
            dedupeByToken();
            ensureIndexes();
        } catch (Exception e) {
            // Never crash the app because of an index repair attempt.
            log.error(
                "Refresh token index repair failed; continuing startup. Cause: {}",
                e.getMessage()
            );
        }
    }

    private void dedupeByToken() {
        MongoCollection<Document> collection =
                mongoTemplate.getCollection(COLLECTION);

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
            if (ids == null || ids.size() <= 1) {
                continue;
            }

            // Keep the first doc, delete the rest.
            List<Object> toDelete = new ArrayList<>(ids.subList(1, ids.size()));
            deleted += collection
                    .deleteMany(Filters.in("_id", toDelete))
                    .getDeletedCount();
        }

        if (groups > 0) {
            log.warn(
                "Refresh token dedupe removed {} docs across {} duplicate-token groups",
                deleted, groups
            );
        } else {
            log.info("Refresh token dedupe: no duplicates found");
        }
    }

    private void ensureIndexes() {
        IndexOperations indexOps = mongoTemplate.indexOps(COLLECTION);

        if (!indexExists("userId", false)) {
            indexOps.ensureIndex(
                    new Index("userId", Sort.Direction.ASC)
            );
        }

        if (!indexExists("token", true)) {
            indexOps.ensureIndex(
                    new Index("token", Sort.Direction.ASC).unique()
            );
        }
    }

    private boolean indexExists(String field, boolean unique) {
        for (Document index :
                mongoTemplate.getCollection(COLLECTION).listIndexes()) {

            Document key = (Document) index.get("key");
            if (key != null && key.size() == 1 && key.containsKey(field)) {
                boolean isUnique = index.getBoolean("unique", false);
                return isUnique == unique;
            }
        }
        return false;
    }
}