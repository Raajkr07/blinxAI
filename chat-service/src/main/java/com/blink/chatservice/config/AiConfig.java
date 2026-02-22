package com.blink.chatservice.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.ClientHttpRequestFactory;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

import java.time.Duration;

@Configuration
public class AiConfig {

    @Bean
    public RestClient aiRestClient(RestClient.Builder builder, ClientHttpRequestFactory factory) {
        return builder
                .requestFactory(factory)
                .build();
    }
}
