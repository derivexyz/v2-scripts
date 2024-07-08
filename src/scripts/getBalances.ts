import { BigNumberish } from 'ethers';
import { getAccountDetails, printPortfolio } from '../utils/contracts/subaccounts';
import { logger } from '../utils/logger';
import { Command } from 'commander';
import {callWeb3} from "../utils/web3/utils";

async function getBalances(subAccId: BigNumberish, optional: any) {
  const accountDetails = await getAccountDetails(BigInt(subAccId), optional['block']);
  // console.log('Account details:', accountDetails);
  printPortfolio(accountDetails);
}

export default new Command('getBalances')
  .description('Get balances for a subaccount')
  .argument('<subaccount>', 'Subaccount to get balances for')
  .option('-b, --block <block>', 'What block to query')
  .action(getBalances);
