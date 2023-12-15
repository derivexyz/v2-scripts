import { requireEnv } from './utils/requireEnv';
import * as dotenv from 'dotenv';
import * as process from 'process';

dotenv.config();

export const vars = {
  // 0 is falsey, so can be checked with !vars.tradingSubaccount
  tradingSubaccount: !!process.env['TRADING_SUBACCOUNT'] ? BigInt(process.env['TRADING_SUBACCOUNT']) : 0n,
  biddingSubaccount: !!process.env['BIDDING_SUBACCOUNT'] ? BigInt(process.env['BIDDING_SUBACCOUNT']) : 0n,
  signingKey: requireEnv('SIGNING_KEY'),
  exchangeUrl: requireEnv('HTTP_ADDRESS'),
  exchangeWsUrl: requireEnv('WEBSOCKET_ADDRESS'),
  provider: requireEnv('WEB3_RPC_URL'),
  logDebug: process.env['LOG_DEBUG'] || 'false',
  fixedGas: process.env['FIXED_GAS'] || '0',
};
