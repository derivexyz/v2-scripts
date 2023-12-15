import { ethers } from 'ethers';
import { getAuthenticatedWs } from '../auth/ws';
import { PrivateOrderParamsSchema } from '../../../types/stubs/private.order';
import { SignedAction } from '../../contracts/matching/actionSigning';
import { getRandomNonce } from '../../misc/getRandomNonce';
import { bnAbs, fromBN, toBN } from '../../misc/BN';
import { getEncodedTradeData } from './utils';
import { getAllAddresses } from '../../getAddresses';
import { logger } from '../../logger';
import { tryRPC } from '../requests';
import { PrivateOrderDebug } from '../../../types/stubs/private.order_debug';
import { optionDetailsToSubId } from '../../contracts/option';

export async function closePosition(
  wallet: ethers.Wallet,
  subaccId: bigint,
  instrumentType: string,
  instrumentName: string,
  amount: string,
) {
  const allAddresses = await getAllAddresses();
  const amountBN = toBN(amount);
  const direction = amountBN > 0n ? 'sell' : 'buy';
  const absAmountBN = bnAbs(amountBN);

  const currency = instrumentName.split('-')[0];
  const amountBNRounded = absAmountBN - (absAmountBN % toBN('0.1'));

  if (amountBNRounded == 0n) {
    logger.info(`Not closing position for ${instrumentName} because amount is too small`);
    return;
  }

  const limitPrice = direction == 'buy' ? '100000' : '1'; // TODO: get min/max from API

  const maxFee = '1000';

  const address =
    instrumentType == 'perp' ? allAddresses.markets[currency].perp : allAddresses.markets[currency].option;
  let subId = 0n;
  if (instrumentType == 'option') {
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

  const tradeDataBuyer = getEncodedTradeData(
    address,
    subId,
    toBN(limitPrice), // limit
    bnAbs(amountBNRounded), //desired amount
    toBN(maxFee), //worst fee
    subaccId,
    direction,
  );

  const signature = new SignedAction(
    Number(subaccId),
    getRandomNonce(),
    Date.now() + 60 * 60,
    wallet,
    wallet.address,
    allAddresses.trade,
    tradeDataBuyer,
  );

  await tryRPC<PrivateOrderDebug>(
    'private/order_debug',
    {
      instrument_name: instrumentName,
      subaccount_id: Number(subaccId),
      direction: direction,
      limit_price: limitPrice,
      amount: fromBN(amountBNRounded),
      signature_expiry_sec: signature.expiry,
      max_fee: maxFee,
      nonce: signature.nonce,
      signer: signature.signer,
      signature: signature.signAction(wallet),
      order_type: 'market',
      mmp: false,
      reduce_only: true,
    },
    wallet,
    true,
  );

  const ws = await getAuthenticatedWs(wallet);

  const requestId = Math.round(Math.random() * 10000);
  const closeRequest = JSON.stringify({
    method: 'private/order',
    params: {
      instrument_name: instrumentName,
      subaccount_id: Number(subaccId),
      direction: direction,
      limit_price: limitPrice,
      amount: fromBN(amountBNRounded),
      signature_expiry_sec: signature.expiry,
      max_fee: maxFee,
      nonce: signature.nonce,
      signer: signature.signer,
      signature: signature.signAction(wallet),
      order_type: 'market',
      mmp: false,
      reduce_only: true,
    } as PrivateOrderParamsSchema,
    // TODO: track id to not reuse it for the ws connection
    id: requestId,
  });

  const res = await new Promise((resolve, reject) => {
    logger.debug(`sending WS request ${closeRequest}`);
    ws.send(closeRequest);

    ws.on('message', (message: string) => {
      const msg = JSON.parse(message);
      logger.debug(`got message ${message}`);
      if (msg.id == requestId) {
        logger.debug(`got order response ${msg}`);
        resolve(msg);
      }
    });
  });
  logger.debug(`trade response: ${res}`);
  ws.close();
}
