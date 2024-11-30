import { logger } from '../utils/logger';
import { getAllAddresses } from '../utils/getAddresses';
import { callWeb3 } from '../utils/web3/utils';
import { Command } from 'commander';
import { fromBN } from '../utils/misc/BN';

async function checkCashStats() {
  const addresses = await getAllAddresses();
  const SMSubId = await callWeb3(null, addresses.securityModule, 'accountId()', [], ['uint256']);

  const [
    netSettledCash,
    accruedSmFees,
    borrowIndex,
    supplyIndex,
    cashToStableRate,
    USDCInCash,
    SMBalance,
    totalSupply,
    totalBorrow,
  ] = await Promise.all([
    callWeb3(null, addresses.cash, 'netSettledCash()', [], ['int256']),
    callWeb3(null, addresses.cash, 'accruedSmFees()', [], ['uint256']),
    callWeb3(null, addresses.cash, 'borrowIndex()', [], ['uint256']),
    callWeb3(null, addresses.cash, 'supplyIndex()', [], ['uint256']),
    callWeb3(null, addresses.cash, 'getCashToStableExchangeRate()', [], ['uint256']),
    callWeb3(null, addresses.usdc, 'balanceOf(address)', [addresses.cash], ['uint256']),
    callWeb3(
      null,
      addresses.subAccounts,
      'getBalance(uint256,address,uint256)',
      [SMSubId, addresses.cash, 0],
      ['int256'],
    ),
    callWeb3(null, addresses.cash, 'totalSupply()', [], ['uint256']),
    callWeb3(null, addresses.cash, 'totalBorrow()', [], ['uint256']),
  ]);

  const borrowRate = await callWeb3(null, addresses.rateModel, 'getBorrowRate(uint256,uint256)', [totalSupply, totalBorrow], ['uint256']);

  logger.info(`cash totalSupply: ${fromBN(totalSupply)}`);
  logger.info(`cash totalBorrow: ${fromBN(totalBorrow)}`);
  logger.info(`cash netSettledCash: ${fromBN(netSettledCash)}`);
  logger.info(`cash accruedSmFees: ${fromBN(accruedSmFees)}`);
  logger.info(`cash borrowIndex: ${fromBN(borrowIndex)}`);
  logger.info(`cash supplyIndex: ${fromBN(supplyIndex)}`);
  logger.info(`cash cashToStableRate: ${fromBN(cashToStableRate)}`);
  logger.info(`cash borrowRate: ${fromBN(borrowRate, 18)}`);
  logger.info(`cash USDCInCash: ${fromBN(USDCInCash, 6)}`);

  logger.info(`SM SubId: ${SMSubId}`);
  logger.info(`SM Cash Balance: ${fromBN(SMBalance)}`);

  // for (let i=0; i<1.5; i += 0.05) {
  //   let rate = await callWeb3(null, "0xec80c673D147f7851DFa8BD4326fc156fE2EDc94", 'getBorrowRate(uint256,uint256)', [toBN("1"), toBN(i.toString())], ['uint256']);
  //   logger.info(`cash borrowRate for ${i}: ${fromBN(rate, 18)}`);
  // }
}

export default new Command('checkCashStats')
  .description('Log common stats about the cash contract')
  .action(checkCashStats);
