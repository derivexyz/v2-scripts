import {callWeb3, getLogsWeb3, multiCallWeb3} from "../../utils/web3/utils";
import {requireEnv} from "../../utils/requireEnv";
import {fromBN} from "../../utils/misc/BN";
import {prettifySeconds} from "../../utils/misc/time";
import {getAllAddresses, isAddress, MarketContracts} from "../../utils/getAddresses";
import {getOICaps} from "./shared";


const removeUndefinedValuesFromObject = <T>(obj: any): T => {
  Object.keys(obj).forEach((key) => obj[key] === undefined && delete obj[key]);
  return obj;
};

async function getFeedParams(feed: string): Promise<[string[], string, string]> {
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
}

async function getMarketSRMParams(marketName: string, marketId: string, marketAddresses: MarketContracts): Promise<object> {
  const srm = requireEnv('SRM_ADDRESS');

  const [
    perpMarginRequirements,
    optionMarginParams,
    baseMarginParams,
    oracleContingencyParams
  ] = await multiCallWeb3(
    null,
    [
      [srm, `perpMarginRequirements(uint256)`, [marketId], ['(uint256,uint256)']],
      [srm, `optionMarginParams(uint256)`, [marketId], ['(uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256)']],
      [srm, `baseMarginParams(uint256)`, [marketId], ['(uint256,uint256)']],
      [srm, `oracleContingencyParams(uint256)`, [marketId], ['(uint256,uint256,uint256,uint256)']],
    ]
  );

  const result: any = {};

  result.marginParams = {};

  if (isAddress(marketAddresses.perp)) {
    result.marginParams.perpMarginRequirements = {
      mmPerpReq: fromBN(perpMarginRequirements[0]),
      imPerpReq: fromBN(perpMarginRequirements[1]),
    };
  }

  if (isAddress(marketAddresses.option)) {
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

  if (isAddress(marketAddresses.baseAsset)) {
    result.marginParams.baseMarginParams = {
      marginFactor: fromBN(baseMarginParams[0]),
      imScale: fromBN(baseMarginParams[1]),
    };
    const wrappedAsset = await callWeb3(null, marketAddresses.baseAsset, 'wrappedAsset()', [], ['address']);
    if (marketName === 'fxUSDC') {
      result.marginParams.wrappedAsset = {
        address: wrappedAsset,
        owner: "0x0000000000000000000000000000000000000000",
      };
    } else {
      let wrappedAssetOwner = "0x0000000000000000000000000000000000000000";
      try {
        wrappedAssetOwner = await callWeb3(null, wrappedAsset, 'owner()', [], ['address'], 'latest', 0);
      } catch (e) {
        console.log(`Could not fetch owner for wrapped asset ${wrappedAsset} for market ${marketName}: ${e}`);
      }
      result.marginParams.wrappedAsset = {
        address: wrappedAsset,
        owner: wrappedAssetOwner,
      };
    }
  }

  result.marginParams.oracleContingencyParams = {
    perpThreshold: fromBN(oracleContingencyParams[0]),
    optionThreshold: fromBN(oracleContingencyParams[1]),
    baseThreshold: fromBN(oracleContingencyParams[2]),
    ocFactor: fromBN(oracleContingencyParams[3]),
  };

  result.oiCaps = await getOICaps(marketAddresses.baseAsset, marketAddresses.option, marketAddresses.perp);

  result.feedParams = {};

  if (!isAddress(marketAddresses.spotFeed)) {
    throw new Error(`Missing spot feed for market`);
  }
  let [spotSigners, spotHeartbeat, spotRequiredSigners]: [string[], string, string] = [[], '0', '0'];
  if (!["SFP"].includes(marketName.toUpperCase())) {
    [spotSigners, spotHeartbeat, spotRequiredSigners] = await getFeedParams(marketAddresses.spotFeed);
  }

  result.feedParams.spotFeed = {
    signers: spotSigners,
    heartbeat: prettifySeconds(parseInt(spotHeartbeat.toString())),
    requiredSigners: spotRequiredSigners,
  };

  if (isAddress(marketAddresses.option)) {
    if (!isAddress(marketAddresses.forwardFeed) || !isAddress(marketAddresses.volFeed)) {
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
    ] = await multiCallWeb3(
      null,
      [
        [marketAddresses.forwardFeed, `spotFeed()`, [], ['address']],
        [marketAddresses.forwardFeed, `settlementHeartbeat()`, [], ['uint64']]
      ]
    );

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

  if (isAddress(marketAddresses.perp)) {
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

async function getOwners(marketAddresses: MarketContracts): Promise<{[key:string]: {address: string, owner: string}}> {
  const names = Object.keys(marketAddresses).sort();

  const calls: any[] = []
  for (const key of names) {
    if (isAddress((marketAddresses as any)[key])) {
      const contract = (marketAddresses as any)[key];
      calls.push([contract, 'owner()', [], ['address']]);
    }
  }

  const owners = await multiCallWeb3(null, calls);

  const addressesWithOwners: {[key:string]: {address: string, owner: string}} = {};
  for (let i = 0; i < names.length; i++) {
    const key = names[i];
    if (isAddress((marketAddresses as any)[key])) {
      addressesWithOwners[key] = {
        address: (marketAddresses as any)[key],
        owner: owners[i]
      };
    }
  }
  return addressesWithOwners;
}

export async function getAllSRMParams(): Promise<object> {
  const srm = requireEnv('SRM_ADDRESS');

  const [
    subAccounts,
    cashAsset,
    liquidation,
    viewer,
    maxAccountSize,
    feeRecipientAcc,
    minOIFee,

    borrowingEnabled,
    lastMarketId,
    stableFeed,
    depegParams
  ] = await multiCallWeb3(
    null,
    [
      [srm, 'subAccounts()', [], ['address']],
      [srm, 'cashAsset()', [], ['address']],
      [srm, 'liquidation()', [], ['address']],
      [srm, 'viewer()', [], ['address']],
      [srm, 'maxAccountSize()', [], ['uint256']],
      [srm, 'feeRecipientAcc()', [], ['uint256']],
      [srm, 'minOIFee()', [], ['uint256']],

      [srm, 'borrowingEnabled()', [], ['bool']],
      [srm, 'lastMarketId()', [], ['uint256']],
      [srm, 'stableFeed()', [], ['address']],
      [srm, 'depegParams()', [], ['(uint256,uint256)']]
    ]);

  const baseManagerParams = {
    srm,
    subAccounts,
    cashAsset,
    liquidation,
    viewer,
    maxAccountSize: maxAccountSize.toString(),
    feeRecipientAcc,
    minOIFee: fromBN(minOIFee),
  };

  const srmParams: any = {
    borrowingEnabled,
    lastMarketId: lastMarketId.toString(),
    stableFeed,
    depegParams: {
      depegThreshold: fromBN(depegParams[0]),
      depegFactor: fromBN(depegParams[1]),
    }
  };

  const allAddrs = await getAllAddresses();

  const promises = [];

  for (const marketName of Object.keys(allAddrs.markets)) {
    if (marketName === 'SFP' || marketName === 'PYUSD' || marketName === 'deUSD') {
      continue;
    }
    const market = allAddrs.markets[marketName];
    promises.push((async (): Promise<any> => {
      const marketId = market.marketId.toString();

      const params = await getMarketSRMParams(marketName, marketId, market);
      const addressesWithOwners = await getOwners(market);
      return {
        marketName,
        marketId,
        addresses: addressesWithOwners,
        params,
      };
    })())
  }
  const marketParams = await Promise.all(promises);

  return {
    baseManagerParams,
    srmParams,
    marketParams,
  };
}
