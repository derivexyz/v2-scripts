import { ethers } from 'ethers';
import { tryRPC } from './requests';
import { isRPCError } from '../../types/rpc';
import { PrivateTransferPosition } from '../../types/stubs/private.transfer_position';
import { getRandomNonce } from '../misc/getRandomNonce';
import { getAllBalances } from './wallets/getBalances';
import { SignedAction } from '../contracts/matching/actionSigning';
import { getAllAddresses } from '../getAddresses';
import { optionDetailsToSubId } from '../contracts/option';
import { logger } from '../logger';
import { bnAbs, fromBN, toBN } from '../misc/BN';
import { sleep } from '../misc/time';

export async function transferAll(wallet: ethers.Wallet, from: bigint, to: bigint) {
  // TODO: transfer any negative cash first

  // Get balances and iterate
  let allBalances = await getAllBalances(wallet, from);

  // Transfer all perps and options first
  for (const position of allBalances.result.positions) {
    if (position.instrument_type == 'perp' || position.instrument_type == 'option') {
      await submitTransfer(wallet, from, to, position.instrument_name, position.instrument_type, position.amount);
      // must wait for transaction to make it on-chain
      logger.info('Waiting 10 seconds for transfer to be processed');
      await sleep(10000);
    }
  }

  allBalances = await getAllBalances(wallet, from);

  for (const position of allBalances.result.positions) {
    if (position.instrument_type != 'erc20') {
      throw new Error(`Unexpected instrument type: ${position.instrument_type}`);
    }

    // TODO: transfer ERC20
  }
}

function getEncodedTradeData(
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

export async function submitTransfer(
  wallet: ethers.Wallet,
  from: bigint,
  to: bigint,
  instrumentName: string,
  type: string,
  amount: string,
) {
  const allAddresses = await getAllAddresses();
  const currency = instrumentName.split('-')[0];
  const amountBN = toBN(amount);
  const absAmountBN = bnAbs(amountBN);

  const limitPrice = toBN('1'); // set a limit price for marking in history/wallet accounting

  const address = type == 'perp' ? allAddresses.markets[currency].perp : allAddresses.markets[currency].option;
  let subId = 0n;
  if (type == 'option') {
    // eg. ETH-20231205-2050-C"
    const [, expiry, strike, optionType] = instrumentName.split('-');
    const expiryDate = new Date(+expiry.slice(0, 4), +expiry.slice(4, 6) - 1, +expiry.slice(6, 8), 8);
    const optionDetails = {
      expiry: BigInt(expiryDate.valueOf() / 1000),
      strike: toBN(strike),
      isCall: optionType == 'C',
    };
    subId = optionDetailsToSubId(optionDetails);
  }

  // If amt > 0:
  // from SELLS amt
  // if amt < 0:
  // from BUYS amt

  const tradeDataBuyer = getEncodedTradeData(
    address,
    subId,
    limitPrice, // limit
    absAmountBN, //desired amount
    0n, //worst fee
    amountBN > 0n ? to : from,
    'buy',
  );

  const signedBuyer = new SignedAction(
    Number(amountBN > 0n ? to : from),
    getRandomNonce(),
    Date.now() + 60 * 60,
    wallet,
    wallet.address,
    allAddresses.trade,
    tradeDataBuyer,
  );

  const tradeDataSeller = getEncodedTradeData(
    address,
    subId,
    limitPrice, // limit
    absAmountBN, //desired amount
    0n, //worst fee
    amountBN > 0n ? from : to,
    'sell',
  );

  const signedSeller = new SignedAction(
    Number(amountBN > 0n ? from : to),
    getRandomNonce(),
    Date.now() + 60 * 60,
    wallet,
    wallet.address,
    allAddresses.trade,
    tradeDataSeller,
  );

  const signedMaker = amountBN > 0n ? signedSeller : signedBuyer;
  const signedTaker = amountBN > 0n ? signedBuyer : signedSeller;

  const transferRes = await tryRPC<PrivateTransferPosition>(
    `private/transfer_position`,
    {
      wallet: wallet.address,
      maker_params: {
        amount: fromBN(absAmountBN),
        direction: amountBN > 0n ? 'sell' : 'buy',
        instrument_name: instrumentName,
        limit_price: fromBN(limitPrice),
        max_fee: '0',
        nonce: signedMaker.nonce,
        signature: signedMaker.signAction(wallet),
        signature_expiry_sec: signedMaker.expiry,
        signer: wallet.address,
        subaccount_id: signedMaker.accountId,
      },
      taker_params: {
        amount: fromBN(absAmountBN),
        direction: amountBN > 0n ? 'buy' : 'sell',
        instrument_name: instrumentName,
        limit_price: fromBN(limitPrice),
        max_fee: '0',
        nonce: signedTaker.nonce,
        signature: signedTaker.signAction(wallet),
        signature_expiry_sec: signedTaker.expiry,
        signer: wallet.address,
        subaccount_id: signedTaker.accountId,
      },
    },
    wallet,
    true,
  );

  if (isRPCError(transferRes)) {
    throw `Failed to transfer asset: ${JSON.stringify(transferRes.error)}`;
  }

  logger.debug(transferRes.result);
  return transferRes.result;
}

//
// export async function submitERC20Transfer(
//   wallet: ethers.Wallet,
//   from: bigint,
//   to: bigint,
//   instrumentName: string,
//   type: string,
//   amount: string
// ) {
//   const allAddresses = await getAllAddresses();
//   const currency = instrumentName.split('-')[0];
//   const amountBN = toBN(amount);
//   const absAmountBN = bnAbs(amountBN);
//
//   const transfer = await tryRPC<PrivateTransferErc20JSONRPCSchema>(
//     'private/transfer',
//     {
//       recipient_currency: currency,
//       recipient_details: SignatureDetailsSchema;
//       recipient_margin_type?: RecipientMarginType;
//       recipient_subaccount_id: RecipientSubaccountId;
//       sender_details: SignatureDetailsSchema1;
//       subaccount_id: SubaccountId;
//       transfers: Transfers;
//     },
//   )
//
// }
