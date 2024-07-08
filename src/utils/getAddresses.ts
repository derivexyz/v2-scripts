import {callWeb3, getLogsWeb3} from './web3/utils';
import { requireEnv } from './requireEnv';

type MarketContracts = {
  marketId: number;
  option: string;
  perp: string;
  baseERC20: string;
  baseAsset: string;
  spotFeed: string;
  volFeed: string;
  forwardFeed: string;
  perpFeed: string;
  ibpFeed: string;
  iapFeed: string;
  rateFeed: string;
  pmrm: string;
  pmrmLib: string;
  pmrmViewer: string;
};

export type AllContracts = {
  usdc: string;
  markets: { [key: string]: MarketContracts };
  matching: string;
  deposit: string;
  trade: string;
  transfer: string;
  withdrawal: string;
  rfq: string;
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
  clobSettlerAddress: string;
  auctionUtils: string;
};


export enum AssetType {
  NotSet,
  Option,
  Perpetual,
  Base,
}

let cachedAddresses: AllContracts | undefined;

async function loadMarketAddresses(market: string): Promise<any> {
  const srm = requireEnv('SRM_ADDRESS');
  const marketId = +requireEnv(`${market}_MARKETID`);
  const type = requireEnv(`${market}_MARKET_TYPE`);
  const baseERC20 = requireEnv(`${['BTC', 'ETH'].includes(market) ? `W${market}` : market}_ADDRESS`);

  if (type === 'ALL') {
    const pmrm = requireEnv(`${market}_PMRM_ADDRESS`);
    const perp = await callWeb3(null, pmrm, `perp()`, [], ['address']);

    const [option, baseAsset, spotFeed, volFeed, forwardFeed, rateFeed, perpFeed, ibpFeed, iapFeed, lib, view] =
      await Promise.all([
        callWeb3(null, srm, `assetMap(uint256,uint8)`, [marketId, AssetType.Option], ['address']),
        callWeb3(null, srm, `assetMap(uint256,uint8)`, [marketId, AssetType.Base], ['address']),
        callWeb3(null, pmrm, `spotFeed()`, [], ['address']),
        callWeb3(null, pmrm, `volFeed()`, [], ['address']),
        callWeb3(null, pmrm, `forwardFeed()`, [], ['address']),
        callWeb3(null, pmrm, `interestRateFeed()`, [], ['address']),
        callWeb3(null, perp, `perpFeed()`, [], ['address']),
        callWeb3(null, perp, `impactBidPriceFeed()`, [], ['address']),
        callWeb3(null, perp, `impactAskPriceFeed()`, [], ['address']),
        callWeb3(null, pmrm, `lib()`, [], ['address']),
        callWeb3(null, pmrm, `viewer()`, [], ['address']),
      ]);

    return {
      marketId,
      option,
      perp,
      baseERC20,
      baseAsset,
      spotFeed,
      volFeed,
      forwardFeed,
      rateFeed,
      perpFeed,
      ibpFeed,
      iapFeed,
      pmrm,
      pmrmLib: lib,
      pmrmViewer: view,
    };
  } else if (type === 'SRM_BASE_ONLY') {
    const baseAsset = await callWeb3(null, srm, `assetMap(uint256,uint8)`, [marketId, AssetType.Base], ['address']);
    const [spotFeed, ,] = await callWeb3(
      null,
      srm,
      `getMarketFeeds(uint)`,
      [marketId],
      ['address', 'address', 'address'],
    );
    return {
      marketId,
      baseERC20,
      baseAsset,
      spotFeed,
    };
  } else if (type === 'SRM_OPTION_ONLY') {
    const [option, baseAsset, [spotFeed, forwardFeed, volFeed]] = await Promise.all([
      callWeb3(null, srm, `assetMap(uint256,uint8)`, [marketId, AssetType.Option], ['address']),
      callWeb3(null, srm, `assetMap(uint256,uint8)`, [marketId, AssetType.Base], ['address']),
      callWeb3(null, srm, `getMarketFeeds(uint)`, [marketId], ['address', 'address', 'address']),
    ]);
    return {
      marketId,
      baseERC20,
      baseAsset,
      option,
      spotFeed,
      forwardFeed,
      volFeed,
    };
  } else {
    throw new Error(`Unknown market type ${type}`);
  }
}

export async function getAllAddresses(): Promise<AllContracts> {
  if (cachedAddresses) {
    return cachedAddresses;
  }

  const srm = requireEnv('SRM_ADDRESS');
  await getLogsWeb3(srm, 'MarketCreated(uint256,string)', 0);

  cachedAddresses = {
    clobSettlerAddress: "", rfq: "",
    usdc: requireEnv('USDC_ADDRESS'),
    markets: {
      ETH: await loadMarketAddresses('ETH'),
      BTC: await loadMarketAddresses('BTC'),
      USDT: await loadMarketAddresses('USDT'),
      SNX: await loadMarketAddresses('SNX'),
      WSTETH: await loadMarketAddresses('WSTETH'),
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
    auctionUtils: requireEnv('AUCTION_UTILS_ADDRESS')
  };
  return cachedAddresses;
}
