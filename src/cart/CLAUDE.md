# Cart Service

C# (.NET) gRPC service. Stores shopping carts in Valkey (Redis-compatible).

## Build

```bash
dotnet restore   # From src/cart/src/
dotnet build
docker compose build cart   # Docker image (from repo root)
```

## Test

```bash
dotnet test   # From src/cart/ — runs tests in the tests/ subdirectory
```

## Structure

```
src/      Service source code
tests/    Unit tests
```

## Gotchas

- Depends on Valkey (Redis-compatible) at the address in `VALKEY_ADDR` env var.
  Locally this is `valkey-cart:6379` from the compose stack.
- Uses Central Package Management (`Directory.Packages.props`) — package versions
  are pinned there, not in individual `.csproj` files.
- The `cart.slnx` is the solution file (new XML format); use `dotnet` CLI or VS 2022+.
