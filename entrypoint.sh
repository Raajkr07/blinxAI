#!/bin/sh
set -e

# Default JVM options if JAVA_OPTS is not set externally
: "${JAVA_OPTS:=-XX:+UseContainerSupport \
  -XX:MaxRAMPercentage=50.0 \
  -XX:InitialRAMPercentage=30.0 \
  -XX:+UseG1GC \
  -XX:MaxGCPauseMillis=50 \
  -XX:+UseStringDeduplication \
  -XX:+ParallelRefProcEnabled \
  -XX:MaxDirectMemorySize=64m \
  -XX:MaxCodeCacheSize=64m \
  -XX:+OptimizeStringConcat \
  -Xss256k \
  -XX:MaxMetaspaceSize=128m \
  -XX:+ExitOnOutOfMemoryError \
  -Djava.security.egd=file:/dev/./urandom}"

SPRING_PROFILE="${SPRING_PROFILES_ACTIVE:-prod}"
APP_PORT="${PORT:-8080}"

echo "Starting with JAVA_OPTS: $JAVA_OPTS"
echo "Profile: $SPRING_PROFILE | Port: $APP_PORT"

exec java $JAVA_OPTS \
  -Dspring.profiles.active="$SPRING_PROFILE" \
  -Dserver.port="$APP_PORT" \
  -jar app.jar
