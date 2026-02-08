package com.blink.chatservice.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.slf4j.MDC;
import org.springframework.context.annotation.Configuration;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.util.ContentCachingRequestWrapper;
import org.springframework.web.util.ContentCachingResponseWrapper;

import java.io.IOException;
import java.util.UUID;

@Component
@Slf4j
public class RequestLoggingFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        
        long startTime = System.currentTimeMillis();
        String requestId = UUID.randomUUID().toString();
        // Adding unique request ID to MDC so we can trace logs for a single request across all threads.
        MDC.put("requestId", requestId);
        
        String path = request.getRequestURI();
        String method = request.getMethod();
        
        try {
            filterChain.doFilter(request, response);
        } finally {
            long duration = System.currentTimeMillis() - startTime;
            int status = response.getStatus();
            // Logging user ID if available, helps in debugging user-specific issues.
            String userId = request.getUserPrincipal() != null ? request.getUserPrincipal().getName() : "anonymous";

            log.debug("Finished request {} {} status={} time={}ms user={}", 
                    method, path, status, duration, userId);
            
            MDC.clear();
        }
    }
}
