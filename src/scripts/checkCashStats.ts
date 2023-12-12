import { logger } from '../utils/logger';
import { getAllAddresses } from '../utils/getAddresses';
import { callWeb3 } from '../utils/web3/utils';
import { Command } from 'commander';
import { fromBN } from '../utils/misc/BN';

async function checkCashStats() {
  const addresses = await getAllAddresses();

  const totalSupply = await callWeb3(null, addresses.cash, 'totalSupply()', [], ['uint256']);
  const totalBorrow = await callWeb3(null, addresses.cash, 'totalBorrow()', [], ['uint256']);
  const netSettledCash = await callWeb3(null, addresses.cash, 'netSettledCash()', [], ['int256']);
  const accruedSmFees = await callWeb3(null, addresses.cash, 'accruedSmFees()', [], ['uint256']);

  const borrowIndex = await callWeb3(null, addresses.cash, 'borrowIndex()', [], ['uint256']);
  const supplyIndex = await callWeb3(null, addresses.cash, 'supplyIndex()', [], ['uint256']);

  // For when a socialised loss has occurred
  const cashToStableRate = await callWeb3(null, addresses.cash, 'getCashToStableExchangeRate()', [], ['uint256']);

  const USDCInCash = await callWeb3(null, addresses.usdc, 'balanceOf(address)', [addresses.cash], ['uint256']);
  const SMSubId = await callWeb3(null, addresses.securityModule, 'accountId()', [], ['uint256']);
  const SMBalance = await callWeb3(
    null,
    addresses.subAccounts,
    'getBalance(uint256,address,uint256)',
    [SMSubId, addresses.cash, 0],
    ['int256'],
  );

  logger.info(`cash totalSupply: ${fromBN(totalSupply)}`);
  logger.info(`cash totalBorrow: ${fromBN(totalBorrow)}`);
  logger.info(`cash netSettledCash: ${fromBN(netSettledCash)}`);
  logger.info(`cash accruedSmFees: ${fromBN(accruedSmFees)}`);
  logger.info(`cash borrowIndex: ${fromBN(borrowIndex)}`);
  logger.info(`cash supplyIndex: ${fromBN(supplyIndex)}`);
  logger.info(`cash cashToStableRate: ${fromBN(cashToStableRate)}`);
  logger.info(`cash USDCInCash: ${fromBN(USDCInCash, 6)}`);

  logger.info(`SM SubId: ${SMSubId}`);
  logger.info(`SM Cash Balance: ${fromBN(SMBalance)}`);
}

export default new Command('checkCashStats')
  .description('Log common stats about the cash contract')
  .action(checkCashStats);
