# Ad Service

Kotlin gRPC service (Gradle). Returns ads based on context keys; falls back to random ads.

## Prerequisites

JDK 21+ required.

## Build & Run Locally

```bash
./gradlew installDist   # Compiles and creates runnable distribution

# Run (from this directory):
export AD_PORT=8080
export FEATURE_FLAG_GRPC_SERVICE_ADDR=featureflagservice:50053
./build/install/opentelemetry-demo-ad/bin/Ad
```

## Docker Build

```bash
docker compose build ad   # From repo root
```

## Test

```bash
./gradlew test
```

## Gradle Version

To upgrade Gradle:

```bash
./gradlew wrapper --gradle-version <version>
```

## Gotchas

- Uses Gradle wrapper (`gradlew`) — do not rely on a system-installed Gradle.
- The ad service reads feature flags (`adManualGc`, `adHighCpu`, `adFailure`) from flagd — flagd must be running for those code paths to activate.
