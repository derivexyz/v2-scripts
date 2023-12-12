import { BigNumberish } from 'ethers';
import { getAccountDetails, printPortfolio } from '../utils/contracts/subaccounts';
import { logger } from '../utils/logger';
import { Command } from 'commander';

async function getBalances(subAccId: BigNumberish) {
  const accountDetails = await getAccountDetails(BigInt(subAccId));
  logger.debug(accountDetails);
  printPortfolio(accountDetails.portfolio);
}

export default new Command('getBalances')
  .description('Get balances for a subaccount')
  .argument('<subaccount>', 'Subaccount to get balances for')
  .action(getBalances);
