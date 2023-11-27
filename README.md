# V2 utils

A collection of functions to help interact with the lyra v2 protocol and exchange.

## Pre-requisites

- [Node.js](https://nodejs.org/en/download)
- [pnpm](https://pnpm.io/installation)
- [foundry](https://book.getfoundry.sh/getting-started/installation)
  - specifically "cast" is needed

## Installation

```bash
pnpm i
cp .env.testnet.example .env
```

Make sure to fill in the `.env` file with the correct values.

## Available Scripts

### getBalances

Get the balances of a given subId.

```bash
pnpm getBalances <subId>
```

### getAllCurrentAuctions

Get all the current auctions.

```bash
pnpm getAllCurrentAuctions
```

### liquidationFlow

Run through a liquidation flow. Create subaccounts, bid, deposit to exchange and transfer assets to another account.

```bash
pnpm liquidationFlow <auctionId>
```

### getBalances

Get the balances of a given subId.

```bash
pnpm getBalances <subId>
```


### debugTrace

Returns a full trace of a given transaction hash.

```bash
pnpm debugTrace <txHash>
```
