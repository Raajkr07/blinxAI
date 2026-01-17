package com.blink.chatservice.exception;

import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.validation.BindException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    public record ErrorResponse(
            String error,
            String message,
            int status,
            String path,
            OffsetDateTime timestamp,
            Map<String, Object> details
    ) {
        public static ErrorResponse of(String error, String message, HttpStatus status, String path) {
            return new ErrorResponse(error, message, status.value(), path, OffsetDateTime.now(), null);
        }

        public static ErrorResponse of(String error, String message, HttpStatus status, String path, Map<String, Object> details) {
            return new ErrorResponse(error, message, status.value(), path, OffsetDateTime.now(), details);
        }
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    protected ResponseEntity<Object> handleMethodArgumentNotValid(
            MethodArgumentNotValidException ex,
            HttpHeaders headers,
            HttpStatusCode status,
            WebRequest request
    ) {
        Map<String, Object> details = new HashMap<>();
        Map<String, String> fieldErrors = new HashMap<>();

        for (FieldError fieldError : ex.getBindingResult().getFieldErrors()) {
            fieldErrors.put(fieldError.getField(), fieldError.getDefaultMessage());
        }
        details.put("fields", fieldErrors);

        String path = request.getDescription(false).replace("uri=", "");
        ErrorResponse body = ErrorResponse.of(
                "VALIDATION_ERROR",
                "Request validation failed",
                HttpStatus.BAD_REQUEST,
                path,
                details
        );

        log.warn("Validation failed for request: {} - errors: {}", path, fieldErrors);
        return new ResponseEntity<>(body, HttpStatus.BAD_REQUEST);
    }

    @ExceptionHandler(BindException.class)
    public ResponseEntity<ErrorResponse> handleBindException(
            BindException ex,
            HttpServletRequest request
    ) {
        Map<String, Object> details = new LinkedHashMap<>();
        Map<String, String> fieldErrors = new LinkedHashMap<>();

        for (FieldError fe : ex.getBindingResult().getFieldErrors()) {
            fieldErrors.put(fe.getField(), fe.getDefaultMessage());
        }
        details.put("fields", fieldErrors);

        String path = request.getRequestURI();

        ErrorResponse body = ErrorResponse.of(
                "VALIDATION_ERROR",
                "Request binding failed",
                HttpStatus.BAD_REQUEST,
                path,
                details
        );

        log.debug("Bind validation failed for request: {} - errors: {}", path, fieldErrors);
        return ResponseEntity.badRequest().body(body);
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ErrorResponse> handleIllegalArgument(IllegalArgumentException ex, WebRequest request) {
        String path = getPath(request);
        log.warn("IllegalArgumentException for {}: {}", path, ex.getMessage());
        return createErrorResponse("BAD_REQUEST", ex.getMessage(), HttpStatus.BAD_REQUEST, path);
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<ErrorResponse> handleIllegalState(IllegalStateException ex, WebRequest request) {
        String path = getPath(request);
        log.warn("IllegalStateException for {}: {}", path, ex.getMessage());
        return createErrorResponse("BAD_REQUEST", ex.getMessage(), HttpStatus.BAD_REQUEST, path);
    }

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleResourceNotFound(ResourceNotFoundException ex, WebRequest request) {
        String path = getPath(request);
        log.info("ResourceNotFound for {}: {}", path, ex.getMessage());
        return createErrorResponse("NOT_FOUND", ex.getMessage(), HttpStatus.NOT_FOUND, path);
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ErrorResponse> handleAccessDenied(AccessDeniedException ex, WebRequest request) {
        String path = getPath(request);
        log.warn("AccessDenied for {}: {}", path, ex.getMessage());
        return createErrorResponse("FORBIDDEN", "Access denied", HttpStatus.FORBIDDEN, path);
    }

    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<ErrorResponse> handleAuthentication(AuthenticationException ex, WebRequest request) {
        String path = getPath(request);
        log.warn("Authentication failure for {}: {}", path, ex.getMessage());
        return createErrorResponse("UNAUTHORIZED", ex.getMessage(), HttpStatus.UNAUTHORIZED, path);
    }

    @ExceptionHandler(AiException.class)
    public ResponseEntity<ErrorResponse> handleAiException(AiException ex, WebRequest request) {
        String path = getPath(request);
        log.error("AI Service error for {}: {}", path, ex.getMessage());
        return createErrorResponse("AI_SERVICE_ERROR", "AI service temporarily unavailable", HttpStatus.SERVICE_UNAVAILABLE, path);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleGeneric(Exception ex, WebRequest request) {
        String path = getPath(request);
        log.error("Unhandled exception for {}: {}", path, ex.getMessage(), ex);
        return createErrorResponse("INTERNAL_ERROR", "An unexpected error occurred", HttpStatus.INTERNAL_SERVER_ERROR, path);
    }

    private String getPath(WebRequest request) {
        return request.getDescription(false).replace("uri=", "");
    }

    private ResponseEntity<ErrorResponse> createErrorResponse(String error, String message, HttpStatus status, String path) {
        return new ResponseEntity<>(
                ErrorResponse.of(error, message != null ? message : "Error", status, path),
                status
        );
    }
}
