import { AssetType } from '../utils/getAddresses';
import { callWeb3, getLogsWeb3 } from '../utils/web3/utils';
import { Command } from 'commander';
import { requireEnv } from "../utils/requireEnv";
import { ZeroAddress } from "ethers";
import {fromBN} from "../utils/misc/BN";
import { prettifySeconds } from "../utils/misc/time";

type MarketAddresses = {
  option?: string;
  perp?: string;
  base?: string;
  spotFeed?: string;
  forwardFeed?: string;
  volFeed?: string;
  rateFeed?: string;
  perpFeed?: string;
  ibpFeed?: string;
  iapFeed?: string;
}

const removeUndefinedValuesFromObject = <T>(obj: any): T => {
  Object.keys(obj).forEach((key) => obj[key] === undefined && delete obj[key]);
  return obj;
};

async function getSRMAddresses(marketId: string): Promise<MarketAddresses> {
  const srm = requireEnv('SRM_ADDRESS');

  const [option, perp, base, [spotFeed, forwardFeed, volFeed]] = await Promise.all([
    callWeb3(null, srm, `assetMap(uint256,uint8)`, [marketId, AssetType.Option], ['address']),
    callWeb3(null, srm, `assetMap(uint256,uint8)`, [marketId, AssetType.Perpetual], ['address']),
    callWeb3(null, srm, `assetMap(uint256,uint8)`, [marketId, AssetType.Base], ['address']),
    callWeb3(null, srm, `getMarketFeeds(uint)`, [marketId], ['address', 'address', 'address']),
  ]);

  let perpFeed, ibpFeed, iapFeed;
  if (perp != ZeroAddress) {
    [perpFeed, ibpFeed, iapFeed] = await Promise.all([
      callWeb3(null, perp, `perpFeed()`, [], ['address']),
      callWeb3(null, perp, `impactBidPriceFeed()`, [], ['address']),
      callWeb3(null, perp, `impactAskPriceFeed()`, [], ['address']),
    ]);
  }

  return removeUndefinedValuesFromObject({
    option: option != ZeroAddress ? option : undefined,
    perp: perp != ZeroAddress ? perp : undefined,
    base: base != ZeroAddress ? base : undefined,
    spotFeed: spotFeed != ZeroAddress ? spotFeed : undefined,
    forwardFeed: forwardFeed != ZeroAddress ? forwardFeed : undefined,
    volFeed: volFeed != ZeroAddress ? volFeed : undefined,
    perpFeed: perpFeed != ZeroAddress ? perpFeed : undefined,
    ibpFeed: ibpFeed != ZeroAddress ? ibpFeed : undefined,
    iapFeed: iapFeed != ZeroAddress ? iapFeed : undefined
  });
}

async function getFeedParams(feed: string): Promise<[string[], string, string]> {
  try {
    const [signerEvents, heartbeat, requiredSigners] = await Promise.all([
      getLogsWeb3(feed, 'SignerUpdated(address signer, bool isSigner)', 0),
      callWeb3(null, feed, `heartbeat()`, [], ['uint256']),
      callWeb3(null, feed, `requiredSigners()`, [], ['uint256'])
    ]);

    const latestEvent: any = {}

    for (const event of signerEvents) {
      if (!latestEvent[event.data.signer] || latestEvent[event.data.signer].block < event.blockNumber) {
        latestEvent[event.data.signer] = {block: event.blockNumber, isSigner: event.data.isSigner};
      }
    }

    return [
      Object.entries(latestEvent).filter(([_, v]) => (v as any).isSigner).map(([k, _]) => k),
      heartbeat,
      requiredSigners
    ];
  } catch (e) {
    // for SFPs
    return [[], '0', '0'];
  }
}

async function getMarketSRMParams(marketId: string, marketAddresses: MarketAddresses): Promise<object> {
  const srm = requireEnv('SRM_ADDRESS');

  const [
    perpMarginRequirements,
    optionMarginParams,
    baseMarginParams,
    oracleContingencyParams
  ] = await Promise.all([
    callWeb3(null, srm, `perpMarginRequirements(uint256)`, [marketId], ['(uint256,uint256)']),
    callWeb3(null, srm, `optionMarginParams(uint256)`, [marketId], ['(uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256)']),
    callWeb3(null, srm, `baseMarginParams(uint256)`, [marketId], ['(uint256,uint256)']),
    callWeb3(null, srm, `oracleContingencyParams(uint256)`, [marketId], ['(uint256,uint256,uint256,uint256)']),
  ]);

  const result: any = {};

  result.marginParams = {};

  if (marketAddresses.perp) {
    result.marginParams.perpMarginRequirements = {
      mmPerpReq: fromBN(perpMarginRequirements[0]),
      imPerpReq: fromBN(perpMarginRequirements[1]),
    };
  }

  if (marketAddresses.option) {
    result.marginParams.optionMarginParams = {
      maxSpotReq: fromBN(optionMarginParams[0]),
      minSpotReq: fromBN(optionMarginParams[1]),
      mmCallSpotReq: fromBN(optionMarginParams[2]),
      mmPutSpotReq: fromBN(optionMarginParams[3]),
      mmPutMtMReq: fromBN(optionMarginParams[4]),
      unpairedIMScale: fromBN(optionMarginParams[5]),
      unpairedMMScale: fromBN(optionMarginParams[6]),
      mmOffsetScale: fromBN(optionMarginParams[7]),
    };
  }

  if (marketAddresses.base) {
    result.marginParams.baseMarginParams = {
      marginFactor: fromBN(baseMarginParams[0]),
      imScale: fromBN(baseMarginParams[1]),
    };
  }

  result.marginParams.oracleContingencyParams = {
    perpThreshold: fromBN(oracleContingencyParams[0]),
    optionThreshold: fromBN(oracleContingencyParams[1]),
    baseThreshold: fromBN(oracleContingencyParams[2]),
    ocFactor: fromBN(oracleContingencyParams[3]),
  };

  result.oiCaps = {};

  if (marketAddresses.option) {
    const [isWl, totalPosition, positionCap] = await Promise.all([
      callWeb3(null, marketAddresses.option, `whitelistedManager(address)`, [srm], ['bool']),
      callWeb3(null, marketAddresses.option, `totalPosition(address)`, [srm], ['uint256']),
      callWeb3(null, marketAddresses.option, `totalPositionCap(address)`, [srm], ['uint256'])
    ]);

    result.oiCaps.optionPosition = {
      isWhitelisted: isWl,
      totalPosition: fromBN(totalPosition),
      positionCap: fromBN(positionCap),
    };
  }

  if (marketAddresses.perp) {
    const [isWl, totalPosition, positionCap] = await Promise.all([
      callWeb3(null, marketAddresses.perp, `whitelistedManager(address)`, [srm], ['bool']),
      callWeb3(null, marketAddresses.perp, `totalPosition(address)`, [srm], ['uint256']),
      callWeb3(null, marketAddresses.perp, `totalPositionCap(address)`, [srm], ['uint256'])
    ]);

    result.oiCaps.perpPosition = {
      isWhitelisted: isWl,
      totalPosition: fromBN(totalPosition),
      positionCap: fromBN(positionCap),
    };
  }

  if (marketAddresses.base) {
    const [isWl, totalPosition, positionCap] = await Promise.all([
      callWeb3(null, marketAddresses.base, `whitelistedManager(address)`, [srm], ['bool']),
      callWeb3(null, marketAddresses.base, `totalPosition(address)`, [srm], ['uint256']),
      callWeb3(null, marketAddresses.base, `totalPositionCap(address)`, [srm], ['uint256'])
    ]);

    result.oiCaps.basePosition = {
      isWhitelisted: isWl,
      totalPosition: fromBN(totalPosition),
      positionCap: fromBN(positionCap),
    };
  }

  result.feedParams = {};

  if (!marketAddresses.spotFeed) {
    throw new Error(`Missing spot feed for market`);
  }

  const [spotSigners, spotHeartbeat, spotRequiredSigners] = await getFeedParams(marketAddresses.spotFeed);

  result.feedParams.spotFeed = {
    signers: spotSigners,
    heartbeat: prettifySeconds(parseInt(spotHeartbeat.toString())),
    requiredSigners: spotRequiredSigners,
  };

  if (marketAddresses.option) {
    if (!marketAddresses.forwardFeed || !marketAddresses.volFeed) {
      throw new Error(`Missing feeds for option market`);
    }

    const [volSigners, volHeartbeat, volRequiredSigners] = await getFeedParams(marketAddresses.volFeed);

    result.feedParams.volFeed = {
      signers: volSigners,
      heartbeat: prettifySeconds(parseInt(volHeartbeat.toString())),
      requiredSigners: volRequiredSigners,
    };

    const [fwdSigners, fwdHeartbeat, fwdRequiredSigners] = await getFeedParams(marketAddresses.forwardFeed);
    const [
      spotFeed,
      settlementHeartbeat
    ] = await Promise.all([
      callWeb3(null, marketAddresses.forwardFeed, `spotFeed()`, [], ['address']),
      callWeb3(null, marketAddresses.forwardFeed, `settlementHeartbeat()`, [], ['uint64'])
    ]);

    result.feedParams.forwardFeed = {
      signers: fwdSigners,
      heartbeat: prettifySeconds(parseInt(fwdHeartbeat.toString())),
      requiredSigners: fwdRequiredSigners,
      settlementHeartbeat: prettifySeconds(parseInt(settlementHeartbeat.toString())),
    };

    if (spotFeed != marketAddresses.spotFeed) {
      throw new Error(`Mismatched spot feed for forward feed`);
    }
  }

  if (marketAddresses.perp) {
    if (!marketAddresses.perpFeed || !marketAddresses.ibpFeed || !marketAddresses.iapFeed) {
      throw new Error(`Missing perp feed for market`);
    }

    const [perpSigners, perpHeartbeat, perpRequiredSigners] = await getFeedParams(marketAddresses.perpFeed);

    result.feedParams.perpFeed = {
      signers: perpSigners,
      heartbeat: prettifySeconds(parseInt(perpHeartbeat.toString())),
      requiredSigners: perpRequiredSigners,
    };

    const [ibpSigners, ibpHeartbeat, ibpRequiredSigners] = await getFeedParams(marketAddresses.ibpFeed);

    result.feedParams.ibpFeed = {
      signers: ibpSigners,
      heartbeat: prettifySeconds(parseInt(ibpHeartbeat.toString())),
      requiredSigners: ibpRequiredSigners,
    };

    const [iapSigners, iapHeartbeat, iapRequiredSigners] = await getFeedParams(marketAddresses.iapFeed);

    result.feedParams.iapFeed = {
      signers: iapSigners,
      heartbeat: prettifySeconds(parseInt(iapHeartbeat.toString())),
      requiredSigners: iapRequiredSigners,
    };
  }

  return result;
}

async function getAllSRMParams(): Promise<object> {
  const srm = requireEnv('SRM_ADDRESS');

  const [
    subAccounts,
    cashAsset,
    liquidation,
    viewer,
    maxAccountSize,
    feeRecipientAcc,
    minOIFee
  ] = await Promise.all([
    callWeb3(null, srm, 'subAccounts()', [], ['address']),
    callWeb3(null, srm, 'cashAsset()', [], ['address']),
    callWeb3(null, srm, 'liquidation()', [], ['address']),
    callWeb3(null, srm, 'viewer()', [], ['address']),
    callWeb3(null, srm, 'maxAccountSize()', [], ['uint256']),
    callWeb3(null, srm, 'feeRecipientAcc()', [], ['address']),
    callWeb3(null, srm, 'minOIFee()', [], ['uint256']),
  ]);
  
  const baseManagerParams = {
    subAccounts,
    cashAsset,
    liquidation,
    viewer,
    maxAccountSize: maxAccountSize.toString(),
    feeRecipientAcc,
    minOIFee: fromBN(minOIFee),
  };

  const [borrowingEnabled, lastMarketId, stableFeed] = await Promise.all([
    callWeb3(null, srm, 'borrowingEnabled()', [], ['bool']),
    callWeb3(null, srm, 'lastMarketId()', [], ['uint256']),
    callWeb3(null, srm, 'stableFeed()', [], ['address']),
  ]);

  const srmParams: any = {
    borrowingEnabled,
    lastMarketId: lastMarketId.toString(),
    stableFeed,
  };

  const depegParams = await callWeb3(null, srm, 'depegParams()', [], ['(uint256,uint256)']);
  srmParams["depegParams"] = {
    depegThreshold: fromBN(depegParams[0]),
    depegFactor: fromBN(depegParams[1]),
  };

  const logs = await getLogsWeb3(srm, 'MarketCreated(uint256 id,string marketName)', 0);
  const markets = logs.map((x: any) => x.data);

  const marketParams = [];

  for (const market of markets) {
    const marketId = market.id.toString();
    const marketAddresses = await getSRMAddresses(marketId);
    const params = await getMarketSRMParams(marketId, marketAddresses);
    marketParams.push({
      marketName: market.marketName,
      marketId,
      addresses: marketAddresses,
      params,
    });
  }

  return {
    baseManagerParams,
    srmParams,
    marketParams,
  };
}

async function getAllParams(): Promise<void> {
  console.log("# SRM Params #");

  const allParams = await getAllSRMParams();
  console.log(JSON.stringify(allParams, (_, v) => typeof v === 'bigint' ? v.toString() : v)
  );
}

export default new Command('getAllParams')
  .description('Log all system params')
  .action(getAllParams);