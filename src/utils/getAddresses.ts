import {callWeb3, getLogsWeb3, multiCallWeb3} from './web3/utils';
import { requireEnv } from './requireEnv';
import {ZeroAddress} from "ethers";
import { vars } from '../vars';

export type MarketContracts = {
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
  pmrm2: string;
  pmrm2Lib: string;
  pmrm2Viewer: string;
  pmrm2RateFeed: string;
};

export type AllContracts = {
  usdc: string;
  markets: { [key: string]: MarketContracts };
  matching: string;
  deposit: string;
  trade: string;
  liquidate: string;
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
  auctionUtilsV2?: string;
};


export enum AssetType {
  NotSet,
  Option,
  Perpetual,
  Base,
}

const SKIP_MARKETS = {
  testnet: new Set([
    49n, // AAVE dupe
    9n, // SFP dupe
    22n, // TIA dupe
    17n, // PYUSD dupe
  ])
}

export function isAddress(addr: string) {
  return addr != undefined && addr != '' && addr != ZeroAddress && /^0x[a-fA-F0-9]{40}$/.test(addr);
}

let cachedAddresses: AllContracts | undefined;

async function loadMarketAddresses(): Promise<{ [key: string]: MarketContracts }> {
  const srm = requireEnv('SRM_ADDRESS');
  const logs = await getLogsWeb3(srm, 'MarketCreated(uint256 id,string marketName)', 0);
  const marketIds: { id: bigint; marketName: string }[] = logs.map((x: any) => {
    const data = x.data;
    if (data.marketName === "weth") {
      data.marketName = "ETH";
    } else if (data.marketName === "wbtc") {
      data.marketName = "BTC";
    }
    return {id: data.id, marketName: data.marketName};
  });

  // filter out any markets that are in the SKIP_MARKETS list
  const network = vars.environment;
  if (network in SKIP_MARKETS) {
    const skipSet = SKIP_MARKETS[network as keyof typeof SKIP_MARKETS];
    for (let i = marketIds.length - 1; i >= 0; i--) {
      if (skipSet.has(marketIds[i].id)) {
        console.log(`Skipping market ${marketIds[i].marketName} with id ${marketIds[i].id} on network ${network}`);
        marketIds.splice(i, 1);
      }
    }
  }

  // work out if there are duplicates in marketIds, if so, throw an error
  const marketIdSet = new Set();
  for (const market of marketIds) {
    if (marketIdSet.has(market.marketName)) {
      throw new Error(`Duplicate market name found: ${market.marketName} - add invalid one to SKIP_MARKETS`);
    }
    marketIdSet.add(market.marketName);
  }


  const results: { [key: string]: MarketContracts } = {}
  const assetCalls: [string, string, any[], any[]][] = []

  for (let i = 0; i < marketIds.length; i++) {
    assetCalls.push([srm, `assetMap(uint256,uint8)`, [marketIds[i].id, AssetType.Option], ['address']])
    assetCalls.push([srm, `assetMap(uint256,uint8)`, [marketIds[i].id, AssetType.Base], ['address']])
    assetCalls.push([srm, `assetMap(uint256,uint8)`, [marketIds[i].id, AssetType.Perpetual], ['address']])
  }

  const assetResults = await multiCallWeb3(null, assetCalls);
  const marketAddressCalls: [string, string, any[], any[]][] = []

  for (let i = 0; i < marketIds.length; i++) {
    const marketId = Number(marketIds[i].id);
    const marketName = marketIds[i].marketName;
    const option = assetResults[i * 3] == ZeroAddress ? "" : assetResults[i * 3];
    const baseAsset = assetResults[i * 3 + 1] == ZeroAddress ? "" : assetResults[i * 3 + 1];
    const perp = assetResults[i * 3 + 2] == ZeroAddress ? "" : assetResults[i * 3 + 2];

    results[marketName] = {
      marketId,
      option,
      perp,
      baseAsset,
      baseERC20: "",
      spotFeed: "",
      volFeed: "",
      forwardFeed: "",
      perpFeed: "",
      ibpFeed: "",
      iapFeed: "",
      rateFeed: "",
      pmrm: "",
      pmrmLib: "",
      pmrmViewer: "",
      pmrm2: "",
      pmrm2Lib: "",
      pmrm2Viewer: "",
      pmrm2RateFeed: "",
    }

    marketAddressCalls.push([srm, `getMarketFeeds(uint)`, [marketId], ['address', 'address', 'address']]);
    if (perp != "") {
      marketAddressCalls.push([perp, `perpFeed()`, [], ['address']]);
      marketAddressCalls.push([perp, `impactBidPriceFeed()`, [], ['address']]);
      marketAddressCalls.push([perp, `impactAskPriceFeed()`, [], ['address']]);
    }
    if (baseAsset != "") {
      marketAddressCalls.push([baseAsset, `wrappedAsset()`, [], ['address']]);
    }

    if (process.env[`${marketName.toUpperCase()}_PMRM_ADDRESS`]) {
      const pmrm = requireEnv(`${marketName.toUpperCase()}_PMRM_ADDRESS`);

      results[marketName].pmrm = pmrm;

      marketAddressCalls.push([pmrm, `spotFeed()`, [], ['address']]);
      marketAddressCalls.push([pmrm, `volFeed()`, [], ['address']]);
      marketAddressCalls.push([pmrm, `forwardFeed()`, [], ['address']]);
      marketAddressCalls.push([pmrm, `interestRateFeed()`, [], ['address']]);
      marketAddressCalls.push([pmrm, `lib()`, [], ['address']]);
      marketAddressCalls.push([pmrm, `viewer()`, [], ['address']]);
    }

    if (process.env[`${marketName.toUpperCase()}_PMRM2_ADDRESS`]) {
      const pmrm2 = requireEnv(`${marketName.toUpperCase()}_PMRM2_ADDRESS`);
      results[marketName].pmrm2 = pmrm2;

      marketAddressCalls.push([pmrm2, `spotFeed()`, [], ['address']]);
      marketAddressCalls.push([pmrm2, `volFeed()`, [], ['address']]);
      marketAddressCalls.push([pmrm2, `forwardFeed()`, [], ['address']]);
      marketAddressCalls.push([pmrm2, `interestRateFeed()`, [], ['address']]);
      marketAddressCalls.push([pmrm2, `lib()`, [], ['address']]);
      marketAddressCalls.push([pmrm2, `viewer()`, [], ['address']]);
    }
  }

  const marketAddressRes = await multiCallWeb3(null, marketAddressCalls);

  let index = 0;
  for (let i = 0; i < marketIds.length; i++) {
    const marketName = marketIds[i].marketName;

    const [spotFeed, forwardFeed, volFeed] = marketAddressRes[index++];

    // Shared
    results[marketName].spotFeed = spotFeed;
    results[marketName].forwardFeed = forwardFeed;
    results[marketName].volFeed = volFeed;
    if (results[marketName].perp != "") {
      results[marketName].perpFeed = marketAddressRes[index++];
      results[marketName].iapFeed = marketAddressRes[index++];
      results[marketName].ibpFeed = marketAddressRes[index++];
    }
    if (results[marketName].baseAsset != "") {
      results[marketName].baseERC20 = marketAddressRes[index++];
    }

    // PMRM
    if (results[marketName].pmrm != "") {
      const spot = marketAddressRes[index++];
      const volFeed = marketAddressRes[index++];
      const forwardFeed = marketAddressRes[index++];
      results[marketName].rateFeed = marketAddressRes[index++];
      results[marketName].pmrmLib = marketAddressRes[index++];
      results[marketName].pmrmViewer = marketAddressRes[index++];
      if (
        spot != results[marketName].spotFeed
        || volFeed != results[marketName].volFeed
        || forwardFeed != results[marketName].forwardFeed
      ) {
        console.log(`PMRM feeds do not match for market ${marketName}`);
        console.log(`Expected: ${results[marketName].spotFeed}, ${results[marketName].volFeed}, ${results[marketName].forwardFeed}`);
        console.log(`Got: ${spot}, ${volFeed}, ${forwardFeed}`);
        throw new Error(`PMRM feeds do not match for market ${marketName}`);
      }
    }
    // PMRM2
    if (results[marketName].pmrm2 != "") {
      const spot = marketAddressRes[index++];
      const volFeed = marketAddressRes[index++];
      const forwardFeed = marketAddressRes[index++];

      results[marketName].pmrm2RateFeed = marketAddressRes[index++];
      results[marketName].pmrm2Lib = marketAddressRes[index++];
      results[marketName].pmrm2Viewer = marketAddressRes[index++];
      if (
        spot != results[marketName].spotFeed
        || volFeed != results[marketName].volFeed
        || forwardFeed != results[marketName].forwardFeed
      ) {
        throw new Error(`PMRM2 feeds do not match for market ${marketName}`);
      }
    }
  }
  return results;
}

export async function getAllAddresses(): Promise<AllContracts> {
  if (cachedAddresses) {
    return cachedAddresses;
  }

  const markets = await loadMarketAddresses();

  const cash = requireEnv('CASH_ADDRESS');
  const rateModel = await callWeb3(null, cash, 'rateModel()', [], ['address']);

  cachedAddresses = {
    clobSettlerAddress: "",
    usdc: requireEnv('USDC_ADDRESS'),
    markets,
    matching: requireEnv('MATCHING_ADDRESS'),
    deposit: requireEnv('DEPOSIT_ADDRESS'),
    trade: requireEnv('TRADE_ADDRESS'),
    liquidate: requireEnv('LIQUIDATE_ADDRESS'),
    transfer: requireEnv('TRANSFER_ADDRESS'),
    withdrawal: requireEnv('WITHDRAWAL_ADDRESS'),
    rfq: requireEnv('RFQ_ADDRESS'),
    subAccountCreator: requireEnv('SUBACCOUNT_CREATOR_ADDRESS'),
    subAccounts: requireEnv('SUBACCOUNT_ADDRESS'),
    cash,
    auction: requireEnv('AUCTION_ADDRESS'),
    rateModel,
    securityModule: requireEnv('SECURITYMODULE_ADDRESS'),
    srmViewer: requireEnv('SRMVIEWER_ADDRESS'),
    srm: requireEnv('SRM_ADDRESS'),
    stableFeed: requireEnv('STABLEFEED_ADDRESS'),
    dataSubmitter: requireEnv('DATA_SUBMITTER_ADDRESS'),
    optionSettlementHelper: requireEnv('OPTION_SETTLEMENT_HELPER'),
    perpSettlementHelper: requireEnv('PERP_SETTLEMENT_HELPER'),
    auctionUtils: requireEnv('AUCTION_UTILS_ADDRESS'),
    auctionUtilsV2: process.env['AUCTION_UTILS_V2_ADDRESS'],
  };
  return cachedAddresses;
}
