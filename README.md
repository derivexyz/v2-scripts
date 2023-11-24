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
