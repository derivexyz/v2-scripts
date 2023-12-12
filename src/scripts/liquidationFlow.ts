import * as dotenv from 'dotenv';
import { ethers } from 'ethers';
import { vars } from '../vars';
import { logger } from '../utils/logger';
import { Command } from 'commander';
import { transferAll } from '../utils/exchange/transfers';
import { getAllAddresses } from '../utils/getAddresses';
import { approveSubaccount, getSubaccountIdFromEvents } from '../utils/contracts/subaccounts';
import { bidOnAccount } from '../utils/contracts/auctions';
import { toBN } from '../utils/misc/BN';
import { executeWeb3 } from '../utils/web3/utils';
import { sleep } from '../utils/misc/time';
import { getLatestSubaccount } from '../utils/exchange/wallets/createAccount';

dotenv.config();

async function liquidationFlow(
  targetAccount: string,
  options: {
    percentage?: string;
    collateral?: string;
    lastTradeId?: string;
    maxCost?: string;
    merge?: boolean;
    deposit?: boolean;
  },
) {
  if (!vars.tradingSubaccount || !vars.biddingSubaccount) {
    throw Error('Please run setupLiquidationAccs first. Must set TRADING_SUBACCOUNT and BIDDING_SUBACCOUNT in .env');
  }
  if (!targetAccount) {
    console.error('Please specify an account to bid on');
    process.exit(1);
  }

  if (options.merge && options.deposit) {
    console.error('Please specify either merge or deposit, not both');
    process.exit(1);
  }

  const addresses = await getAllAddresses();

  // Start with a wallet on L2 that already has some USDC and ETH
  const wallet = new ethers.Wallet(process.env.SIGNING_KEY as string);

  logger.info(`Using ${wallet.address} as executor and signer`);

  // Approve auction utils to use bidding subaccount
  await approveSubaccount(wallet, addresses.auctionUtils, BigInt(vars.biddingSubaccount));

  // Bid on the account (creating a new subaccount)
  const tx = await bidOnAccount(
    wallet,
    BigInt(targetAccount),
    BigInt(vars.biddingSubaccount),
    options.percentage ? toBN(options.percentage) : toBN('1'),
    options.collateral ? toBN(options.collateral) : null,
    BigInt(options.lastTradeId || 0),
    BigInt(options.maxCost || 0),
    options.merge || false,
  );
  const newSubAcc = getSubaccountIdFromEvents(tx.logs);

  logger.info(`Created new subaccount from bidding: ${newSubAcc}`);

  // Deposit the new subaccount into the exchange
  await approveSubaccount(wallet, addresses.matching, newSubAcc);
  await executeWeb3(wallet, addresses.matching, 'depositSubAccount(uint256)', [newSubAcc]);

  // Now we wait for the CLOB to detect the new subaccount
  await sleep(10000);

  const subAcc = await getLatestSubaccount(wallet);
  logger.info(`Successfully deposited subaccount: ${subAcc}`);

  // TODO: transfer assets to another account
  // if (options.deposit) {
  //     await transferAll(wallet, subAcc, vars.tradingSubaccount);
  // }
}

export default new Command('liquidationFlow')
  .summary('Run a liquidation on the provided account')
  .description(
    `Run through a liquidation flow. Create subaccounts, bid, deposit to exchange and transfer assets to another account.
  
  Requires SIGNING_KEY env var to be set. 
  Requires TRADING_SUBACCOUNT and BIDDING_SUBACCOUNT env vars to be set.
  `,
  )
  .argument('<targetAccount>', 'Account to bid on')
  .option('-p, --percentage <percentage>', 'Percentage of account to bid on. 100% if undefined.')
  .option('-c, --collateral <collateral>', 'Collateral amount to bid with. $10 above minimum if undefined.')
  .option('-l, --lastTradeId <lastTradeId>', 'Last trade id. Skips check if 0.')
  .option('-m, --maxCost <maxCost>', 'Max bid price to pay. Skips check if 0.')
  .option('-r, --merge', 'Merge the new subaccount into the bidding subaccount')
  .option('-d, --deposit', 'Deposit the freshly made account into the exchange')
  .action(liquidationFlow);
