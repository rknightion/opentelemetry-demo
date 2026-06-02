# flagd — Feature Flags

`demo.flagd.json` is the single source of truth for all demo feature flags. flagd reads this file at startup.

## Editing Flags

Edit `demo.flagd.json` directly. flagd hot-reloads changes without restart when running in the demo stack.

The UI at http://localhost:8080/feature/ (flagd-ui) reads/writes this same file via the flagd gRPC API.

## Available Flags

| Flag | Type | Effect |
|---|---|---|
| `productCatalogFailure` | bool | Makes product-catalog fail for a specific product ID |
| `recommendationCacheFailure` | bool | Simulates a cache failure in recommendation |
| `adManualGc` | bool | Triggers manual GC pressure in ad service |
| `adHighCpu` | bool | Simulates high CPU in ad service |
| `adFailure` | bool | Makes ad service return errors |
| `kafkaQueueProblems` | bool | Simulates Kafka queue saturation |
| `cartFailure` | bool | Makes cart service fail |
| `paymentFailure` | bool | Makes payment service fail |
| `paymentUnreachable` | bool | Makes payment service unreachable |
| `loadGeneratorFloodHomepage` | bool | Load generator spams the homepage |
| `imageSlowLoad` | bool | Slows image-provider responses |
| `failedReadinessProbe` | bool | Makes a service fail its readiness probe |
| `emailMemoryLeak` | bool | Simulates memory leak in email service |
| `intlShippingSlowdown` | int | Delays non-US shipping requests by N seconds |
| `llmInaccurateResponse` | bool | LLM returns wrong product summary for product `L9ECAV7KIM` |
| `llmRateLimitError` | bool | LLM intermittently returns rate limit errors |

## Schema

Flags follow the [flagd schema](https://flagd.dev/schema/v0/flags.json). Each flag needs:
- `state`: `ENABLED` or `DISABLED`
- `defaultVariant`: which variant is active by default
- `variants`: map of variant names to values
- `targeting` (optional): OpenFeature targeting rules (JSONLogic)
