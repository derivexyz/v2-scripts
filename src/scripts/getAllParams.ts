import {AssetType, getAllAddresses} from '../utils/getAddresses';
import {callWeb3, getLogsWeb3, multiCallWeb3} from '../utils/web3/utils';
import { Command } from 'commander';
import { requireEnv } from "../utils/requireEnv";
import { ZeroAddress } from "ethers";
import {fromBN, toBN} from "../utils/misc/BN";
import { prettifySeconds } from "../utils/misc/time";
import path from "path";
import fs from "fs";

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

const expectedCapsOnTopOfVault: {[key:string]: bigint} = {
  // RSWETH: toBN("500"),
  // WEETH: toBN("750"),
  // RSETH: toBN("500"),
  // SUSDE: toBN("1500000"),
  // LBTC: toBN("20"),
}

const vaultSubaccounts: {[key:string]: number[]} = {
  // RSWETH: [5739],
  // WEETH: [5738, 10301, 10303],
  // RSETH: [5740],
  // SUSDE: [10144],
  // LBTC: [10628, 10629]
}



const removeUndefinedValuesFromObject = <T>(obj: any): T => {
  Object.keys(obj).forEach((key) => obj[key] === undefined && delete obj[key]);
  return obj;
};

async function getSRMAddresses(marketId: string): Promise<MarketAddresses> {
  const srm = requireEnv('SRM_ADDRESS');

  const [option, perp, base, [spotFeed, forwardFeed, volFeed]] = await multiCallWeb3(
    null,
    [
      [srm, `assetMap(uint256,uint8)`, [marketId, AssetType.Option], ['address']],
      [srm, `assetMap(uint256,uint8)`, [marketId, AssetType.Perpetual], ['address']],
      [srm, `assetMap(uint256,uint8)`, [marketId, AssetType.Base], ['address']],
      [srm, `getMarketFeeds(uint)`, [marketId], ['address', 'address', 'address']],
    ]
  );

  let perpFeed, ibpFeed, iapFeed;
  if (perp != ZeroAddress) {
    [perpFeed, ibpFeed, iapFeed] = await multiCallWeb3(
      null,
      [
        [perp, `perpFeed()`, [], ['address']],
        [perp, `impactBidPriceFeed()`, [], ['address']],
        [perp, `impactAskPriceFeed()`, [], ['address']],
      ]
    );
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

async function getMarketSRMParams(marketName: string, marketId: string, marketAddresses: MarketAddresses): Promise<object> {
  const subaccounts = requireEnv("SUBACCOUNT_ADDRESS");
  const srm = requireEnv('SRM_ADDRESS');
  const allAddrs = await getAllAddresses();

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
      marginFactor: baseMarginParams[0].toString(),
      imScale: baseMarginParams[1].toString(),
    };
    const wrappedAsset = await callWeb3(null, marketAddresses.base, 'wrappedAsset()', [], ['address']);
    const wrappedAssetOwner = await callWeb3(null, wrappedAsset, 'owner()', [], ['address']);
    result.marginParams.wrappedAsset = {
      address: wrappedAsset,
      owner: wrappedAssetOwner
    }
  }

  result.marginParams.oracleContingencyParams = {
    perpThreshold: fromBN(oracleContingencyParams[0]),
    optionThreshold: fromBN(oracleContingencyParams[1]),
    baseThreshold: fromBN(oracleContingencyParams[2]),
    ocFactor: fromBN(oracleContingencyParams[3]),
  };

  result.oiCaps = {};

  if (marketAddresses.option) {
    const [isWl, totalPosition, positionCap] = await multiCallWeb3(
      null,
      [
        [marketAddresses.option, `whitelistedManager(address)`, [srm], ['bool']],
        [marketAddresses.option, `totalPosition(address)`, [srm], ['uint256']],
        [marketAddresses.option, `totalPositionCap(address)`, [srm], ['uint256']]
      ]
    );

    result.oiCaps.optionPosition = {
      isWhitelisted: isWl,
      totalPosition: fromBN(totalPosition),
      positionCap: fromBN(positionCap),
    };
  }

  if (marketAddresses.perp) {
    const [isWl, totalPosition, positionCap, isTradePerp, isRfqPerp] = await multiCallWeb3(
      null,
      [
        [marketAddresses.perp, `whitelistedManager(address)`, [srm], ['bool']],
        [marketAddresses.perp, `totalPosition(address)`, [srm], ['uint256']],
        [marketAddresses.perp, `totalPositionCap(address)`, [srm], ['uint256']],
        [allAddrs.trade, 'isPerpAsset(address)', [marketAddresses.perp], ['bool']],
        [allAddrs.rfq, 'isPerpAsset(address)', [marketAddresses.perp], ['bool']],
      ]
    );

    result.oiCaps.perpPosition = {
      isWhitelisted: isWl,
      totalPosition: fromBN(totalPosition),
      positionCap: fromBN(positionCap),
    };
    result.matching = {
      isTradePerp,
      isRfqPerp,
    }
  }

  if (marketAddresses.base) {
    const [isWl, totalPosition, positionCap] = await multiCallWeb3(
      null,
      [
        [marketAddresses.base, `whitelistedManager(address)`, [srm], ['bool']],
        [marketAddresses.base, `totalPosition(address)`, [srm], ['uint256']],
        [marketAddresses.base, `totalPositionCap(address)`, [srm], ['uint256']]
      ]
    );

    let wlEnabled = false;
    try {
      wlEnabled = await callWeb3(null, marketAddresses.base, `wlEnabled()`, [], ['bool'], undefined, 1);
    } catch (e) {
      // ignore
    }

    if (Object.keys(expectedCapsOnTopOfVault).includes(marketName.toUpperCase())) {
      let totalVaultBalance = 0n;
      for (const subaccount of vaultSubaccounts[marketName.toUpperCase()]) {
        const balance = await callWeb3(
          null, subaccounts, `getBalance(uint256,address,uint256)`, [subaccount, marketAddresses.base, 0], ['uint256']
        );
        totalVaultBalance += balance;
      }
      const capOnTop = expectedCapsOnTopOfVault[marketName.toUpperCase()];
      const expectedCap = capOnTop + totalVaultBalance;
      result.oiCaps.basePosition = {
        isSRMWhitelisted: isWl,
        depositWL: wlEnabled,
        totalPosition: fromBN(totalPosition),
        positionCap: fromBN(positionCap),
        expectedCap: fromBN(expectedCap),
        vaultBalances: fromBN(totalVaultBalance),
        nonVaultUsage: `${fromBN(totalPosition - totalVaultBalance)}/${fromBN(capOnTop)}`
      };
    } else {
      result.oiCaps.basePosition = {
        isSRMWhitelisted: isWl,
        depositWL: wlEnabled,
        totalPosition: fromBN(totalPosition),
        positionCap: fromBN(positionCap),
      };
    }
  }

  result.feedParams = {};

  if (!marketAddresses.spotFeed) {
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

async function getOwners(marketAddresses: MarketAddresses): Promise<{[key:string]: {address: string, owner: string}}> {
  const names = Object.keys(marketAddresses).sort();

  const calls: any[] = []
  for (const key of names) {
    if ((marketAddresses as any)[key]) {
      const contract = (marketAddresses as any)[key];
      calls.push([contract, 'owner()', [], ['address']]);
    }
  }

  const owners = await multiCallWeb3(null, calls);

  const addressesWithOwners: {[key:string]: {address: string, owner: string}} = {};
  for (let i = 0; i < names.length; i++) {
    const key = names[i];
    if ((marketAddresses as any)[key]) {
      addressesWithOwners[key] = {
        address: (marketAddresses as any)[key],
        owner: owners[i]
      };
    }
  }
  return addressesWithOwners;
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

  const logs = await getLogsWeb3(srm, 'MarketCreated(uint256 id,string marketName)', 0);
  const markets = logs.map((x: any) => x.data);

  console.log(markets)

  const promises = [];

  let ethSpotPrice = 0n;

  for (const market of markets) {
    if (market.marketName === 'SFP' || market.marketName === 'PYUSD') {
      continue;
    }
    promises.push((async (): Promise<any> => {
      const marketId = market.id.toString();
      const marketAddresses = await getSRMAddresses(marketId);

      // Code block for checking swap rates within the withdrawal wrapper (sponsoring eth for bridging fees)
      if (marketAddresses.base) {
        let spotPrice;
        const erc20 = await callWeb3(null, marketAddresses.base, 'wrappedAsset()', [], ['address']);
        const decimals = await callWeb3(null, erc20, 'decimals()', [], ['uint256']);
        if (market.marketName != "deUSD") {
          const x = await callWeb3(null, marketAddresses.spotFeed as string, 'getSpot()', [], ['uint256', 'uint256']);
          spotPrice = x[0];
        } else {
          spotPrice = toBN("1");
        }
        if (market.marketName === "ETH") {
          ethSpotPrice = spotPrice;
        } else {
          while (ethSpotPrice == 0n) await new Promise((resolve) => setTimeout(resolve, 1000));
        }
        // get the staticPrice value which converts the minFee (in ETH) into an underlying token amount
        // minFee (1e18) * staticPrice[token] (1eX) / 1e36;
        // The result should be the amount of tokens being transferred
        const rate = toBN("1", 18 + parseInt(decimals.toString())) * ethSpotPrice / spotPrice;

        console.log(market.marketName, erc20, rate); // 2500 is the ETH price
      }

      const params = await getMarketSRMParams(market.marketName, marketId, marketAddresses);
      const addressesWithOwners = await getOwners(marketAddresses);
      return {
        marketName: market.marketName,
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

async function getAllPMParams(): Promise<object> {
  const allAddrs = await getAllAddresses();
  
  const promises = [];

  for (const market of Object.keys(allAddrs.markets)) {
    const marketAddrs = allAddrs.markets[market];
    if (!!marketAddrs.pmrm && marketAddrs.pmrm != ZeroAddress && marketAddrs.pmrm != '') {
      promises.push((async (): Promise<any> => {
        const pmrm = marketAddrs.pmrm;
        const pmrmLib = marketAddrs.pmrmLib;
        

        const [
          subAccounts,
          cashAsset,
          liquidation,
          viewer,
          maxAccountSize,
          feeRecipientAcc,
          minOIFee,
          scenarios,
          basisContingencyParams,
          otherContingencyParams,
          staticDiscountParams,
          volShockParams,
        ] = await multiCallWeb3(
          null,
          [
            [pmrm, 'subAccounts()', [], ['address']],
            [pmrm, 'cashAsset()', [], ['address']],
            [pmrm, 'liquidation()', [], ['address']],
            [pmrm, 'viewer()', [], ['address']],
            [pmrm, 'maxAccountSize()', [], ['uint256']],
            [pmrm, 'feeRecipientAcc()', [], ['uint256']],
            [pmrm, 'minOIFee()', [], ['uint256']],
            [pmrm, 'getScenarios()', [], ['(uint256,uint8)[]']],
            [pmrmLib, 'getBasisContingencyParams()', [], ['(uint256,uint256,uint256,uint256)']],
            [pmrmLib, 'getOtherContingencyParams()', [], ['(uint256,uint256,int256,int256,uint256,uint256,uint256)']],
            [pmrmLib, 'getStaticDiscountParams()', [], ['(uint256,uint256,uint256,uint256)']],
            [pmrmLib, 'getVolShockParams()', [], ['(uint256,uint256,int256,int256,uint256)']],
          ]
        );


        return {
          marketName: market,
          addresses: {
            pmrm,
            pmrmLib,
          },
          params: {
            baseManagerParams: {
              subAccounts,
              cashAsset,
              liquidation,
              viewer,
              maxAccountSize,
              feeRecipientAcc,
              minOIFee: fromBN(minOIFee),
            },
            scenarios: scenarios.map((x: any) => `[${fromBN(x[0])},${x[1] == 1n ? 'up' : x[1] == 2n ? 'down' : 'flat'}]`),
            basisContingencyParams: {
              scenarioSpotUp: fromBN(basisContingencyParams[0]),
              scenarioSpotDown: fromBN(basisContingencyParams[1]),
              basisContAddFactor: fromBN(basisContingencyParams[2]),
              basisContMultFactor: fromBN(basisContingencyParams[3]),
            },
            otherContingencyParams: {
              pegLossThreshold: fromBN(otherContingencyParams[0]),
              pegLossFactor: fromBN(otherContingencyParams[1]),
              confThreshold: fromBN(otherContingencyParams[2]),
              confMargin: fromBN(otherContingencyParams[3]),
              basePercent: fromBN(otherContingencyParams[4]),
              perpPercent: fromBN(otherContingencyParams[5]),
              optionPercent: fromBN(otherContingencyParams[6]),
            },
            staticDiscountParams: {
              imFactor: fromBN(staticDiscountParams[0]),
              rateMultScale: fromBN(staticDiscountParams[1]),
              rateAddScale: fromBN(staticDiscountParams[2]),
              baseStaticDiscount: fromBN(staticDiscountParams[3]),
            },
            volShockParams: {
              volRangeUp: fromBN(volShockParams[0]),
              volRangeDown: fromBN(volShockParams[1]),
              shortTermPower: fromBN(volShockParams[2]),
              longTermPower: fromBN(volShockParams[3]),
              dteFloor: volShockParams[4],
            },
          }
        }
      })())
    }
  }

  const pmParams = await Promise.all(promises);
  return pmParams;
}

async function getAllParams(): Promise<void> {
  console.log("# PM Params #");
  const pmParams: any = await getAllPMParams();

  let filePath = path.join(__dirname, '../../data/pmParams.json');
  fs.writeFileSync(filePath, JSON.stringify(pmParams, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2));
  console.log(`Results written to ${filePath}`);

  console.log("# SRM Params #");
  const srmParams: any = await getAllSRMParams();

  // write results to "data/srmParams.json"
  filePath = path.join(__dirname, '../../data/srmParams.json');
  fs.writeFileSync(filePath, JSON.stringify(srmParams, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2));

  console.log(`Results written to ${filePath}`);

  for (const market of srmParams.marketParams) {
    console.log(`${market.marketName.toUpperCase()}_MARKETID=${market.marketId}`);
  }
}

export default new Command('getAllParams')
  .description('Log all system params')
  .action(getAllParams);