import { BigNumberish } from 'ethers';
import {getAccountDetails, getSpotPricesForAccount, printPortfolio} from '../utils/contracts/subaccounts';
import { Command } from 'commander';
import {getBlockWeb3} from "../utils/web3/utils";

async function getBalanceHistory(subAccId: BigNumberish, optional: any) {
  let getSpot = optional['getSpot'];

  const latestBlock = await getBlockWeb3("latest");
  const latestTimestamp = parseInt(latestBlock.timestamp);
  const latestBlockNum = parseInt(latestBlock.number, 16);
  const timestamps = optional['timestamps'] ? optional['timestamps'].map((ts: string) => parseInt(ts)) : [];
  const blocks = [];

  if (timestamps.length === 0) {
    const startTimestamp = parseInt(optional['startTimestamp']);
    let endTimestamp = parseInt(optional['endTimestamp']);

    if (startTimestamp > latestTimestamp) {
      throw new Error('startTimestamp is in the future');
    }
    if (endTimestamp > latestTimestamp) {
      console.log('endTimestamp is in the future, setting to latest timestamp');
      endTimestamp = latestTimestamp;
    }

    const interval = parseInt(optional['interval']);
    if (interval < 2) {
      throw new Error('Interval must be at least 2 seconds');
    }

    for (let ts = startTimestamp; ts <= endTimestamp; ts += interval) {
      blocks.push(Math.floor(latestBlockNum - ((latestTimestamp - ts) / 2)));
    }
  } else {
    for (const ts of timestamps) {
      if (ts > latestTimestamp) {
        throw new Error(`Timestamp ${ts} is in the future`);
      }
      blocks.push(Math.floor(latestBlockNum - ((latestTimestamp - ts) / 2)));
    }
  }

  console.log({blocks})

  for (const block of blocks) {
    const timestamp = latestTimestamp - (latestBlock.number - block) * 2;
    console.log(`\nFetching block: ${block}. Timestamp ${timestamp} (${new Date(timestamp * 1000).toISOString()})`);
    const accountDetails = await getAccountDetails(BigInt(subAccId), block);
    console.log("```")
    printPortfolio(accountDetails);
    console.log("```")
    if (getSpot) {
      const spotPrices = await getSpotPricesForAccount(accountDetails, block);
      console.log('Spot prices:', spotPrices);
    }
  }

}

export default new Command('getBalanceHistory')
  .description('Get balance history for a subaccount')
  .argument('<subaccount>', 'Subaccount to get balances for')
  .option('-s, --startTimestamp <timestamp>', 'What timestamp to query')
  .option('-e, --endTimestamp <timestamp>', 'What timestamp to query')
  .option('-i, --interval <interval>', 'Number seconds interval', '3600')
  .option('-t, --timestamps <timestmpas>', 'Timestamps to query (if not using `-sei`)', (value) => value.split(',').map(Number), [])
  .option('-S, --getSpot', 'Get spot prices', false)
  .action(getBalanceHistory);
