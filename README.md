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

### setupLiquidationAccs

Setup the account required for liquidation flow. There will be one account on the exchange that positions will be 
transferred into and one account that will be used to bid on the auction this is not on the exchange.

Can be re-run to deposit into the accounts that are set.

```bash
pnpm setupLiquidationAccs <tradingDepositAmount (e.g. 10.1)> <bidderDepositAmount (e.g. 550.6)>
```

### liquidationFlow

Run through a liquidation flow. Create subaccounts, bid, deposit to exchange and transfer assets to another account.

```bash
pnpm liquidationFlow <auctionId> <percentOfAccount> <collateralAmount> <lastTradeId>
```

auctionId - the subaccount id of the account to bid on
percentOfAccount - the percentage of the account being bid on that you want to take over
collateralAmount - the amount of collateral to put into the newly generated subaccount (must cover bid cost too)
lastTradeId - the last trade id that was made on the account being bid on (set to 0 to not check)

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
