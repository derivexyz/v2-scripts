import { ethers } from 'ethers';
import { getAllBalances } from './wallets/getBalances';
import { logger } from '../logger';
import { sleep } from '../misc/time';
import { closePosition } from './trades/close';

export async function closeAllPositions(wallet: ethers.Wallet, subaccId: bigint) {
  // Get balances and iterate
  const allBalances = await getAllBalances(wallet, subaccId);

  // Transfer all perps and options first
  for (const position of allBalances.result.positions) {
    if (position.instrument_type == 'perp' || position.instrument_type == 'option') {
      await closePosition(wallet, subaccId, position.instrument_type, position.instrument_name, position.amount);
      // must wait for transaction to make it on-chain
      logger.info('Waiting 10 seconds for transfer to be processed');
      await sleep(10000);
    }
  }

  await getAllBalances(wallet, subaccId);
}
