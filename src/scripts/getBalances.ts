import { BigNumberish } from 'ethers';
import {getAccountDetails, getSpotPricesForAccount, printPortfolio} from '../utils/contracts/subaccounts';
import { Command } from 'commander';
import {getBlockWeb3} from "../utils/web3/utils";

async function getBalances(subAccId: BigNumberish, optional: any) {
  let block = optional['block'];
  let getSpot = optional['getSpot'];

  if (!block && optional['timestamp']) {
    const latestBlock = await getBlockWeb3("latest");
    const latestTimestamp = parseInt(latestBlock.timestamp);
    const timestamp = parseInt(optional['timestamp']);
    if (timestamp > latestTimestamp) {
      throw new Error('Timestamp is in the future');
    }
    const blockDiff = (latestTimestamp - timestamp) / 2;
    block = Math.floor(parseInt(latestBlock.number, 16) - blockDiff);
    console.log('Latest block:', parseInt(latestBlock.number, 16));
  }

  console.log('Fetching block:', block || 'latest');

  const accountDetails = await getAccountDetails(BigInt(subAccId), block);
  // console.log('Account details:', accountDetails);
  printPortfolio(accountDetails);
  if (getSpot) {
    const spotPrices = await getSpotPricesForAccount(accountDetails, block);
    console.log('Spot prices:', spotPrices);
  }
}

export default new Command('getBalances')
  .description('Get balances for a subaccount')
  .argument('<subaccount>', 'Subaccount to get balances for')
  .option('-b, --block <block>', 'What block to query (overwrites timestamp)')
  .option('-t, --timestamp <timestamp>', 'What timestamp to query')
  .option('-s, --getSpot', 'Get spot prices', false)
  .action(getBalances);
