import { callWeb3, executeWeb3, multiCallWeb3 } from '../web3/utils';
import { getAllAddresses } from '../getAddresses';
import { getSubaccountMargin } from './auctions';
import { optionDetailsToString, subIdToOptionDetails } from './option';
import { getManagerAddress, ManagerType } from '../../types/managers';
import { ethers } from 'ethers';
import { logger } from '../logger';
import { fromBN, prettifyBN } from '../misc/BN';

export type AccountPortfolio = {
  cash: bigint;
  markets: {
    [currency: string]: {
      base: bigint;
      perp: { position: bigint, unrealisedPnL: bigint };
      options: {
        [expiry_strike_type: string]: bigint;
      };
    };
  };
};

export type AccountMarginDetails = {
  MM: bigint;
  MtM: bigint;
  worstScenario: bigint;
};

export type AccountDetails = {
  subAccId: bigint;
  manager: string;
  lastTradeId: bigint;
  margin?: AccountMarginDetails;
  portfolio: AccountPortfolio;
};

export async function createAndGetNewSubaccount(wallet: ethers.Wallet, manager: ManagerType): Promise<bigint> {
  const addresses = await getAllAddresses();

  const tx = await executeWeb3(wallet, addresses.subAccounts, 'createAccount(address,address)', [
    wallet.address,
    await getManagerAddress(manager),
  ]);
  return getSubaccountIdFromEvents(tx.logs);
}

export async function approveSubaccount(wallet: ethers.Wallet, spender: string, subaccount: bigint) {
  const addresses = await getAllAddresses();

  const approved = await callWeb3(null, addresses.subAccounts, 'getApproved(uint256)', [subaccount], ['address']);
  if (approved == spender) {
    return;
  }

  await executeWeb3(wallet, addresses.subAccounts, 'approve(address to,uint256 tokenId)', [spender, subaccount]);
}

export function getSubaccountIdFromEvents(logs: any[]) {
  // Transfer events
  const filteredLogs = logs.filter(
    (x) => x.topics[0] == '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
  );
  if (filteredLogs.length == 0) {
    throw Error('No subaccount created in transaction');
  }
  const subAccId = filteredLogs[0].topics[3];

  if (filteredLogs.length > 1) {
    if (!filteredLogs.every((x) => x.topics[3] == subAccId)) {
      logger.debug(filteredLogs);
      throw Error('More than one subaccount created in a single transaction');
    }
  }

  return BigInt(subAccId);
}

export async function getAccountDetails(subAccId: bigint, block?: number): Promise<AccountDetails> {
  const addresses = await getAllAddresses();

  const lastTradeId = await callWeb3(
    null,
    addresses.subAccounts,
    'lastAccountTradeId(uint256)',
    [subAccId],
    ['uint256'],
    block
  );

  let margin: AccountMarginDetails | undefined = undefined;
  try {
    margin = await getSubaccountMargin(subAccId, block);
  } catch (e) {
    logger.warn('Could not compute margin due to feeds being stale');
  }

  const portfolio = await getAccountPortfolio(subAccId, block);

  return {
    subAccId,
    // manager: margin.manager,
    lastTradeId,
    margin,
    portfolio,
  } as any;
}

export async function getAccountPortfolio(subAccId: bigint, block?: number): Promise<AccountPortfolio> {
  const addresses = await getAllAddresses();

  const balances = await callWeb3(
    null,
    addresses.subAccounts,
    'getAccountBalances(uint256)',
    [subAccId],
    ['(address,uint256,int256)[]'],
    block
  );

  const res: AccountPortfolio = {
    cash: 0n,
    markets: {},
  };
  const multicalls: any[] = [];

  for (const balance of balances) {
    const asset = balance[0].toLowerCase();
    const subId = balance[1];
    const amount = balance[2];

    if (asset == addresses.cash?.toLowerCase()) {
      res.cash = amount;
    } else {
      let found = false;

      for (const currency of Object.keys(addresses.markets)) {
        const market = addresses.markets[currency];
        if (market.baseAsset?.toLowerCase() == asset) {
          found = true;
          if (!res.markets[currency]) {
            res.markets[currency] = {
              base: 0n,
              perp: {position: 0n, unrealisedPnL: 0n},
              options: {},
            };
          }
          res.markets[currency].base = amount;
        } else if (market.perp?.toLowerCase() == asset) {
          found = true;
          if (!res.markets[currency]) {
            res.markets[currency] = {
              base: 0n,
              perp: {position: 0n, unrealisedPnL: 0n},
              options: {},
            };
          }
          multicalls.push([market.perp,
            'getUnsettledAndUnrealizedCash(uint256)',
            [subAccId],
            ['int256'],]);
          res.markets[currency].perp = {
            position: amount,
            unrealisedPnL: "TODO" as any
          };
        } else if (market.option?.toLowerCase() == asset) {
          found = true;
          if (!res.markets[currency]) {
            res.markets[currency] = {
              base: 0n,
              perp: {position: 0n, unrealisedPnL: 0n},
              options: {},
            };
          }
          const optionDetails = subIdToOptionDetails(subId);
          const optionKey = optionDetailsToString(optionDetails);
          res.markets[currency].options[optionKey] = amount;
        }
      }
      if (!found) {
        logger.warn(`Unknown asset: ${asset}`);
      }
    }
  }


  const uPnLs = await multiCallWeb3(null, multicalls, block);
  let i = 0;

  for (const balance of balances) {
    const asset = balance[0].toLowerCase();
    for (const currency of Object.keys(addresses.markets)) {
      const market = addresses.markets[currency];
      if (market.perp?.toLowerCase() == asset) {
        res.markets[currency].perp.unrealisedPnL = uPnLs[i++];
      }
    }
  }

  return res;
}

export function printPortfolio(account: AccountDetails) {
  if (account.margin) {
    logger.info("Margin:");
    logger.info(`- MtM: ${prettifyBN(account.margin.MtM)}`);
    logger.info(`- MM: ${prettifyBN(account.margin.MM)}`);
    logger.info(`- Worst Scenario: ${account.margin.worstScenario}`);
  }
  const portfolio = account.portfolio;
  logger.info("Portfolio:")
  logger.info(`- Cash: ${prettifyBN(portfolio.cash)}`);
  for (const currency of Object.keys(portfolio.markets)) {
    logger.info(`- ${currency}:`);
    if (portfolio.markets[currency].base != 0n) {
      logger.info(`-- Base: ${prettifyBN(portfolio.markets[currency].base)}`);
    }
    if (portfolio.markets[currency].perp.position != 0n) {
      logger.info(`-- Perp: ${prettifyBN(portfolio.markets[currency].perp.position)} (Unrealised PnL: ${prettifyBN(portfolio.markets[currency].perp.unrealisedPnL)}`);
    }
    for (const optionKey of Object.keys(portfolio.markets[currency].options)) {
      logger.info(`-- ${optionKey}: ${prettifyBN(portfolio.markets[currency].options[optionKey])}`);
    }
  }
}


export async function getSpotPricesForAccount(account: AccountDetails, block?: number): Promise<{[key:string]: string}> {
  const addresses = await getAllAddresses();
  const portfolio = account.portfolio;
  const res: {[key:string]: string} = {};
  for (const currency of Object.keys(portfolio.markets)) {
    const [spotPrice, _] = await callWeb3(
      null,
      addresses.markets[currency].spotFeed,
      'getSpot()',
      [],
      ['uint256', 'uint256'],
      block
    );
    res[currency] = fromBN(spotPrice);
  }
  return res;
}



