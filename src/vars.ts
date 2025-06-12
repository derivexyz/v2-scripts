import { requireEnv } from './utils/requireEnv';
import * as dotenv from 'dotenv';
import * as process from 'process';
import path from "path";

// # Envs are loaded in the following order:
// # First the .env file, which determines the ENVIRONMENT
// # Then .env.{ENVIRONMENT} file fills in any gaps from .env
// # Then the .env.{ENVIRONMENT}.defaults file fills in any remaining gaps

const firstEnv = dotenv.config({
  path: path.join(__dirname, '../.env'),
})

const environment = firstEnv.parsed?.ENVIRONMENT;
if (environment === undefined) {
  throw new Error('ENVIRONMENT is not set in .env file');
}

if (!["local", "testnet", "mainnet"].includes(environment)) {
  throw new Error(`ENVIRONMENT must be one of "local", "testnet", or "mainnet". Got "${environment}"`);
}

const environementEnv = dotenv.config({
  path: path.join(__dirname, `../.env.${environment}`),
});

const defaultsEnv = dotenv.config({
  path: path.join(__dirname, `../.env.${environment}.defaults`),
});

const allEnvs = {
  ...defaultsEnv.parsed,
  ...environementEnv.parsed,
  ...firstEnv.parsed,
}

for (const [key, value] of Object.entries(allEnvs)) {
  process.env[key] = value;
}

export const vars = {
  environment,
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
