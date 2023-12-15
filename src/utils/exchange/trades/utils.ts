import { ethers } from 'ethers';

export function getEncodedTradeData(
  asset: string,
  subId: bigint,
  limitPrice: bigint,
  amount: bigint,
  maxFee: bigint,
  subaccountId: bigint,
  direction: 'buy' | 'sell',
) {
  const tradeData = [
    asset, // Asset address
    subId, //sub id
    limitPrice, // limit
    amount, //desired amount
    maxFee, //worst fee
    subaccountId, //recipient id
    direction == 'buy', //isbid
  ];

  // logger.debug('tradeData', tradeData);

  const TradeDataABI = ['address', 'uint', 'int', 'int', 'uint', 'uint', 'bool'];
  const encoder = ethers.AbiCoder.defaultAbiCoder();
  return encoder.encode(TradeDataABI, tradeData);
}
