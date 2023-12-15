import * as dotenv from 'dotenv';
import { ethers } from 'ethers';
import { vars } from '../vars';
import { getAllAddresses } from '../utils/getAddresses';
import { logger } from '../utils/logger';
import { Command } from 'commander';
import { toBN } from '../utils/misc/BN';
import {withdrawFromExchange} from "../utils/exchange/withdraw";

dotenv.config();

async function withdrawFromSubaccount(subAccount: string, withdrawalAmount: string) {
  const addresses = await getAllAddresses();

  // Start with a wallet on L2 that already has some USDC and ETH
  const wallet = new ethers.Wallet(process.env.SIGNING_KEY as string);

  logger.info(`Using ${wallet.address} as executor and signer`);

  logger.info(`Withdrawing ${withdrawalAmount} from ${subAccount}`);

  await withdrawFromExchange(wallet, BigInt(subAccount), toBN(withdrawalAmount, 6))

  logger.info("Done");
}

export default new Command('withdrawFromSubaccount')
  .summary('Setup liquidation accounts, or deposit more into existing ones.')
  .description(`Withdraw USDC to owner wallet`)
  .argument('<subAccount>', 'Subaccount to withdraw from')
  .argument('<withdrawalAmount>', 'Amount to withdraw to owner wallet')
  .action(withdrawFromSubaccount);
