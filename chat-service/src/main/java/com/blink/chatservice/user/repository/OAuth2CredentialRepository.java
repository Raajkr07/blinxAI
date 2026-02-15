package com.blink.chatservice.user.repository;

import com.blink.chatservice.user.entity.OAuth2Credential;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface OAuth2CredentialRepository extends MongoRepository<OAuth2Credential, String> {
    Optional<OAuth2Credential> findByUserIdAndProvider(String userId, String provider);
    Optional<OAuth2Credential> findByProviderAndProviderUserId(String provider, String providerUserId);
}
