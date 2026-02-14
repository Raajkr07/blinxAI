package com.blink.chatservice.videochat.repository;

import com.blink.chatservice.videochat.entity.Call;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;
import com.blink.chatservice.videochat.entity.Call.CallStatus;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface CallRepository extends MongoRepository<Call, String> {
    Optional<Call> findByIdAndStatus(String id, CallStatus status);
    
    List<Call> findByCallerIdOrReceiverId(String callerId, String receiverId);
    
    @Query("{ $and: [ { $or: [ { 'callerId': ?0 }, { 'receiverId': ?1 } ] }, { 'status': ?2 } ] }")
    List<Call> findByCallerIdOrReceiverIdAndStatus(String callerId, String receiverId, CallStatus status);
    
    @Query("{ $or: [ { 'callerId': ?0 }, { 'receiverId': ?0 } ] }")
    Page<Call> findCallHistoryByUserId(String userId, Pageable pageable);
    
    @Query("{ $or: [ { 'callerId': ?0 }, { 'receiverId': ?0 } ], 'status': ?1 }")
    Page<Call> findCallHistoryByUserIdAndStatus(String userId, CallStatus status, Pageable pageable);
    
    @Query("{ $or: [ { 'callerId': ?0 }, { 'receiverId': ?0 } ], 'createdAt': { $gte: ?1, $lte: ?2 } }")
    Page<Call> findCallHistoryByUserIdAndDateRange(String userId, LocalDateTime startDate, LocalDateTime endDate, Pageable pageable);
    
    @Query("{ $or: [ { 'callerId': ?0 }, { 'receiverId': ?0 } ], 'type': ?1 }")
    Page<Call> findCallHistoryByUserIdAndType(String userId, Call.CallType type, Pageable pageable);

    @Query("{ $or: [ { 'callerId': ?0 }, { 'receiverId': ?0 } ], 'status': ?1, 'type': ?2 }")
    Page<Call> findCallHistoryByUserIdAndStatusAndType(String userId, CallStatus status, Call.CallType type, Pageable pageable);
    
    // Find stale calls for timeout processing
    List<Call> findByStatusAndCreatedAtBefore(CallStatus status, LocalDateTime dateTime);
}
