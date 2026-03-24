# Soroban Mobile — React Native App

Mobile-first React Native app for interacting with the Soroban Token and Escrow contracts.

## Features

- **Mobile-first design** — 44pt minimum touch targets, dark theme, responsive layout
- **Orientation support** — adapts layout on portrait/landscape change
- **Keyboard handling** — `KeyboardAvoidingView` keeps inputs visible on both iOS and Android
- **Offline queue** — transactions queued in AsyncStorage when offline, visible in Queue tab
- **Response caching** — balance reads cached with TTL to reduce RPC calls
- **Accessibility** — `accessibilityRole`, `accessibilityLabel`, `accessibilityState`, live regions on all interactive elements
- **Bottom tab navigation** — thumb-friendly, native feel on iOS and Android
- **Gesture support** — via `react-native-gesture-handler` root wrapper

## Quick Start

```bash
cd examples/react-native
npm install

# iOS
npm run ios

# Android
npm run android
```

## Configuration

Set your deployed contract IDs as environment variables (or edit the constants directly):

```bash
TOKEN_CONTRACT_ID=C... ESCROW_CONTRACT_ID=C... npm run ios
```

## Wallet Integration

The `mockSign` stub in each screen should be replaced with a real wallet signing call, e.g.:

```ts
import { signTransaction } from '@stellar/freighter-api';

async function sign(xdr: string) {
  return signTransaction(xdr, { network: 'TESTNET' });
}
```

## Structure

```
src/
  theme/        Design tokens (colors, spacing, touch targets)
  hooks/
    useOffline  Network detection + offline tx queue
    useOrientation  Responsive layout on rotation
  utils/
    soroban     Soroban RPC helpers
    cache       AsyncStorage TTL cache
  components/
    Button      Accessible, touch-friendly button
    Input       Labeled input with error state
    OfflineBanner  Connectivity status banner
  screens/
    TokenScreen   Balance + transfer
    EscrowScreen  Fund / deliver / approve / refund
    QueueScreen   View and manage offline queue
  App.tsx       Navigation root
```
