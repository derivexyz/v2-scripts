import { callWeb3 } from './web3/utils';
import { requireEnv } from './requireEnv';

type MarketContracts = {
  marketId: number;
  option: string;
  perp: string;
  base: string;
  spotFeed: string;
  volFeed: string;
  forwardFeed: string;
  perpFeed: string;
  ibpFeed: string;
  iapFeed: string;
  rateFeed: string;
  pmrm: string;
};

export type AllContracts = {
  usdc: string;
  markets: { [key: string]: MarketContracts };
  matching: string;
  deposit: string;
  trade: string;
  transfer: string;
  withdrawal: string;
  subAccountCreator: string;
  subAccounts: string;
  cash: string;
  auction: string;
  rateModel: string;
  securityModule: string;
  srmViewer: string;
  srm: string;
  stableFeed: string;
  dataSubmitter: string;
  optionSettlementHelper: string;
  perpSettlementHelper: string;
  auctionUtils: string;
};

let cachedAddresses: AllContracts | null = null;

async function loadMarketAddresses(market: string): Promise<any> {
  const marketId = +requireEnv(`${market}_MARKETID`);
  const base = requireEnv(`W${market}_ADDRESS`);
  const pmrm = requireEnv(`${market}_PMRM_ADDRESS`);
  const perp = await callWeb3(null, pmrm, `perp()`, [], ['address']);

  const [option, spotFeed, volFeed, forwardFeed, rateFeed, perpFeed, ibpFeed, iapFeed] = await Promise.all([
    callWeb3(null, pmrm, `option()`, [], ['address']),
    callWeb3(null, pmrm, `spotFeed()`, [], ['address']),
    callWeb3(null, pmrm, `volFeed()`, [], ['address']),
    callWeb3(null, pmrm, `forwardFeed()`, [], ['address']),
    callWeb3(null, pmrm, `interestRateFeed()`, [], ['address']),
    callWeb3(null, perp, `perpFeed()`, [], ['address']),
    callWeb3(null, perp, `impactBidPriceFeed()`, [], ['address']),
    callWeb3(null, perp, `impactAskPriceFeed()`, [], ['address']),
  ]);

  return {
    marketId,
    option,
    perp,
    base,
    spotFeed,
    volFeed,
    forwardFeed,
    rateFeed,
    perpFeed,
    ibpFeed,
    iapFeed,
    pmrm,
  };
}

export async function getAllAddresses(): Promise<AllContracts> {
  if (cachedAddresses) {
    return cachedAddresses;
  }
  cachedAddresses = {
    usdc: requireEnv('USDC_ADDRESS'),
    markets: {
      ETH: await loadMarketAddresses('ETH'),
      BTC: await loadMarketAddresses('BTC'),
    },
    matching: requireEnv('MATCHING_ADDRESS'),
    deposit: requireEnv('DEPOSIT_ADDRESS'),
    trade: requireEnv('TRADE_ADDRESS'),
    transfer: requireEnv('TRANSFER_ADDRESS'),
    withdrawal: requireEnv('WITHDRAWAL_ADDRESS'),
    subAccountCreator: requireEnv('SUBACCOUNT_CREATOR_ADDRESS'),
    subAccounts: requireEnv('SUBACCOUNT_ADDRESS'),
    cash: requireEnv('CASH_ADDRESS'),
    auction: requireEnv('AUCTION_ADDRESS'),
    rateModel: requireEnv('RATEMODEL_ADDRESS'),
    securityModule: requireEnv('SECURITYMODULE_ADDRESS'),
    srmViewer: requireEnv('SRMVIEWER_ADDRESS'),
    srm: requireEnv('SRM_ADDRESS'),
    stableFeed: requireEnv('STABLEFEED_ADDRESS'),
    dataSubmitter: requireEnv('DATA_SUBMITTER_ADDRESS'),
    optionSettlementHelper: requireEnv('OPTION_SETTLEMENT_HELPER'),
    perpSettlementHelper: requireEnv('PERP_SETTLEMENT_HELPER'),
    auctionUtils: requireEnv('AUCTION_UTILS_ADDRESS'),
  };
  return cachedAddresses;
}
