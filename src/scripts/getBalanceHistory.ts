import { BigNumberish } from 'ethers';
import {getAccountDetails, getSpotPricesForAccount, printPortfolio} from '../utils/contracts/subaccounts';
import { Command } from 'commander';
import {getBlockWeb3} from "../utils/web3/utils";

async function getBalanceHistory(subAccId: BigNumberish, optional: any) {
  let getSpot = optional['getSpot'];

  const startTimestamp = parseInt(optional['startTimestamp']);
  let endTimestamp = parseInt(optional['endTimestamp']);

  const latestBlock = await getBlockWeb3("latest");
  const latestTimestamp = parseInt(latestBlock.timestamp);

  if (startTimestamp > latestTimestamp) {
    throw new Error('startTimestamp is in the future');
  }
  if (endTimestamp > latestTimestamp) {
    console.log('endTimestamp is in the future, setting to latest timestamp');
    endTimestamp = latestTimestamp;
  }

  const startBlockDiff = (latestTimestamp - startTimestamp) / 2;
  const startBlock = Math.floor(parseInt(latestBlock.number, 16) - startBlockDiff);
  const endBlockDiff = (latestTimestamp - endTimestamp) / 2;
  const endBlock = Math.floor(parseInt(latestBlock.number, 16) - endBlockDiff);

  const interval = parseInt(optional['interval']);
  if (interval < 2) {
    throw new Error('Interval must be at least 2 seconds');
  }

  for (let block = startBlock; block <= endBlock; block += Math.floor(interval / 2)) {
    const timestamp = latestTimestamp - (latestBlock.number - block) * 2;
    console.log(`\nFetching block: ${block}. Timestamp ${timestamp} (${new Date(timestamp * 1000).toISOString()})`);
    const accountDetails = await getAccountDetails(BigInt(subAccId), block);
    printPortfolio(accountDetails);
    if (getSpot) {
      const spotPrices = await getSpotPricesForAccount(accountDetails, block);
      console.log('Spot prices:', spotPrices);
    }
  }

}

export default new Command('getBalanceHistory')
  .description('Get balance history for a subaccount')
  .argument('<subaccount>', 'Subaccount to get balances for')
  .requiredOption('-s, --startTimestamp <timestamp>', 'What timestamp to query')
  .requiredOption('-e, --endTimestamp <timestamp>', 'What timestamp to query')
  .option('-i, --interval <interval>', 'Number seconds interval', '3600')
  .option('-S, --getSpot', 'Get spot prices', false)
  .action(getBalanceHistory);
