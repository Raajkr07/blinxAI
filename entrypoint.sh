#!/bin/sh
set -e

JAVA_OPTS="-XX:+UseContainerSupport \
  -XX:MaxRAMPercentage=75.0 \
  -XX:InitialRAMPercentage=30.0 \
  -XX:+UseG1GC \
  -XX:MaxGCPauseMillis=200 \
  -XX:+UseStringDeduplication \
  -XX:+ParallelRefProcEnabled \
  -XX:MaxDirectMemorySize=32m \
  -XX:ReservedCodeCacheSize=40m \
  -XX:+OptimizeStringConcat \
  -Xss228k \
  -XX:MaxMetaspaceSize=120m \
  -XX:+ExitOnOutOfMemoryError \
  -XX:+HeapDumpOnOutOfMemoryError \
  -XX:HeapDumpPath=/tmp/heapdump.hprof \
  -XX:G1PeriodicGCInterval=120000 \
  -XX:G1PeriodicGCSystemLoadThreshold=0.0 \
  -XX:NativeMemoryTracking=summary \
  -Xlog:gc*:file=/tmp/gc.log:time,level,tags:filecount=3,filesize=5m \
  -Djava.security.egd=file:/dev/./urandom"

# Append any extra opts passed via EXTRA_JAVA_OPTS env var
if [ -n "$EXTRA_JAVA_OPTS" ]; then
  JAVA_OPTS="$JAVA_OPTS $EXTRA_JAVA_OPTS"
fi

SPRING_PROFILE="${SPRING_PROFILES_ACTIVE:-prod}"
APP_PORT="${PORT:-8080}"

echo "Starting with JAVA_OPTS: $JAVA_OPTS"
echo "Profile: $SPRING_PROFILE | Port: $APP_PORT"

exec java $JAVA_OPTS \
  -Dspring.profiles.active="$SPRING_PROFILE" \
  -Dserver.port="$APP_PORT" \
  -jar app.jar
