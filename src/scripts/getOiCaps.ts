import {AssetType, getAllAddresses} from '../utils/getAddresses';
import {callWeb3, getLogsWeb3, multiCallWeb3Internal} from '../utils/web3/utils';
import { Command } from 'commander';
import { requireEnv } from "../utils/requireEnv";
import { ZeroAddress } from "ethers";
import {fromBN, toBN} from "../utils/misc/BN";
import { prettifySeconds } from "../utils/misc/time";
import path from "path";
import fs from "fs";

// type MarketAddresses = {
//   option?: string;
//   perp?: string;
//   base?: string;
//   spotFeed?: string;
//   forwardFeed?: string;
//   volFeed?: string;
//   rateFeed?: string;
//   perpFeed?: string;
//   ibpFeed?: string;
//   iapFeed?: string;
// }
//
// const removeUndefinedValuesFromObject = <T>(obj: any): T => {
//   Object.keys(obj).forEach((key) => obj[key] === undefined && delete obj[key]);
//   return obj;
// };
//
// async function getSRMAddresses(marketId: string): Promise<MarketAddresses> {
//   const srm = requireEnv('SRM_ADDRESS');
//
//   const [option, perp, base, [spotFeed, forwardFeed, volFeed]] = await Promise.all([
//     callWeb3(null, srm, `assetMap(uint256,uint8)`, [marketId, AssetType.Option], ['address']),
//     callWeb3(null, srm, `assetMap(uint256,uint8)`, [marketId, AssetType.Perpetual], ['address']),
//     callWeb3(null, srm, `assetMap(uint256,uint8)`, [marketId, AssetType.Base], ['address']),
//     callWeb3(null, srm, `getMarketFeeds(uint)`, [marketId], ['address', 'address', 'address']),
//   ]);
//
//   let perpFeed, ibpFeed, iapFeed;
//   if (perp != ZeroAddress) {
//     [perpFeed, ibpFeed, iapFeed] = await Promise.all([
//       callWeb3(null, perp, `perpFeed()`, [], ['address']),
//       callWeb3(null, perp, `impactBidPriceFeed()`, [], ['address']),
//       callWeb3(null, perp, `impactAskPriceFeed()`, [], ['address']),
//     ]);
//   }
//
//   return removeUndefinedValuesFromObject({
//     option: option != ZeroAddress ? option : undefined,
//     perp: perp != ZeroAddress ? perp : undefined,
//     base: base != ZeroAddress ? base : undefined,
//     spotFeed: spotFeed != ZeroAddress ? spotFeed : undefined,
//     forwardFeed: forwardFeed != ZeroAddress ? forwardFeed : undefined,
//     volFeed: volFeed != ZeroAddress ? volFeed : undefined,
//     perpFeed: perpFeed != ZeroAddress ? perpFeed : undefined,
//     ibpFeed: ibpFeed != ZeroAddress ? ibpFeed : undefined,
//     iapFeed: iapFeed != ZeroAddress ? iapFeed : undefined
//   });
// }
//
// async function getFeedParams(feed: string): Promise<[string[], string, string]> {
//   const [signerEvents, heartbeat, requiredSigners] = await Promise.all([
//     getLogsWeb3(feed, 'SignerUpdated(address signer, bool isSigner)', 0),
//     callWeb3(null, feed, `heartbeat()`, [], ['uint256']),
//     callWeb3(null, feed, `requiredSigners()`, [], ['uint256'])
//   ]);
//
//   const latestEvent: any = {}
//
//   for (const event of signerEvents) {
//     if (!latestEvent[event.data.signer] || latestEvent[event.data.signer].block < event.blockNumber) {
//       latestEvent[event.data.signer] = {block: event.blockNumber, isSigner: event.data.isSigner};
//     }
//   }
//
//   return [
//     Object.entries(latestEvent).filter(([_, v]) => (v as any).isSigner).map(([k, _]) => k),
//     heartbeat,
//     requiredSigners
//   ];
// }
//
// async function getMarketSRMParams(marketName: string, marketId: string, marketAddresses: MarketAddresses): Promise<object> {
//   const subaccounts = requireEnv("SUBACCOUNT_ADDRESS");
//   const srm = requireEnv('SRM_ADDRESS');
//
//   const [
//     perpMarginRequirements,
//     optionMarginParams,
//     baseMarginParams,
//     oracleContingencyParams
//   ] = await Promise.all([
//     callWeb3(null, srm, `perpMarginRequirements(uint256)`, [marketId], ['(uint256,uint256)']),
//     callWeb3(null, srm, `optionMarginParams(uint256)`, [marketId], ['(uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256)']),
//     callWeb3(null, srm, `baseMarginParams(uint256)`, [marketId], ['(uint256,uint256)']),
//     callWeb3(null, srm, `oracleContingencyParams(uint256)`, [marketId], ['(uint256,uint256,uint256,uint256)']),
//   ]);
//
//   const result: any = {};
//
//   result.marginParams = {};
//
//   if (marketAddresses.perp) {
//     result.marginParams.perpMarginRequirements = {
//       mmPerpReq: fromBN(perpMarginRequirements[0]),
//       imPerpReq: fromBN(perpMarginRequirements[1]),
//     };
//   }
//
//   if (marketAddresses.option) {
//     result.marginParams.optionMarginParams = {
//       maxSpotReq: fromBN(optionMarginParams[0]),
//       minSpotReq: fromBN(optionMarginParams[1]),
//       mmCallSpotReq: fromBN(optionMarginParams[2]),
//       mmPutSpotReq: fromBN(optionMarginParams[3]),
//       mmPutMtMReq: fromBN(optionMarginParams[4]),
//       unpairedIMScale: fromBN(optionMarginParams[5]),
//       unpairedMMScale: fromBN(optionMarginParams[6]),
//       mmOffsetScale: fromBN(optionMarginParams[7]),
//     };
//   }
//
//   if (marketAddresses.base) {
//     result.marginParams.baseMarginParams = {
//       marginFactor: baseMarginParams[0].toString(),
//       imScale: baseMarginParams[1].toString(),
//     };
//     const wrappedAsset = await callWeb3(null, marketAddresses.base, 'wrappedAsset()', [], ['address']);
//     const wrappedAssetOwner = await callWeb3(null, wrappedAsset, 'owner()', [], ['address']);
//     result.marginParams.wrappedAsset = {
//       address: wrappedAsset,
//       owner: wrappedAssetOwner
//     }
//   }
//
//   result.marginParams.oracleContingencyParams = {
//     perpThreshold: fromBN(oracleContingencyParams[0]),
//     optionThreshold: fromBN(oracleContingencyParams[1]),
//     baseThreshold: fromBN(oracleContingencyParams[2]),
//     ocFactor: fromBN(oracleContingencyParams[3]),
//   };
//
//   result.oiCaps = {};
//
//   if (marketAddresses.option) {
//     const [isWl, totalPosition, positionCap] = await Promise.all([
//       callWeb3(null, marketAddresses.option, `whitelistedManager(address)`, [srm], ['bool']),
//       callWeb3(null, marketAddresses.option, `totalPosition(address)`, [srm], ['uint256']),
//       callWeb3(null, marketAddresses.option, `totalPositionCap(address)`, [srm], ['uint256'])
//     ]);
//
//     result.oiCaps.optionPosition = {
//       isWhitelisted: isWl,
//       totalPosition: fromBN(totalPosition),
//       positionCap: fromBN(positionCap),
//     };
//   }
//
//   if (marketAddresses.perp) {
//     const [isWl, totalPosition, positionCap, isTradePerp] = await Promise.all([
//       callWeb3(null, marketAddresses.perp, `whitelistedManager(address)`, [srm], ['bool']),
//       callWeb3(null, marketAddresses.perp, `totalPosition(address)`, [srm], ['uint256']),
//       callWeb3(null, marketAddresses.perp, `totalPositionCap(address)`, [srm], ['uint256']),
//       callWeb3(null, (await getAllAddresses()).trade, 'isPerpAsset(address)', [marketAddresses.perp], ['bool']),
//     ]);
//
//     result.oiCaps.perpPosition = {
//       isWhitelisted: isWl,
//       totalPosition: fromBN(totalPosition),
//       positionCap: fromBN(positionCap),
//     };
//     result.isTradePerp = isTradePerp;
//   }
//
//   if (marketAddresses.base) {
//     const [isWl, totalPosition, positionCap] = await Promise.all([
//       callWeb3(null, marketAddresses.base, `whitelistedManager(address)`, [srm], ['bool']),
//       callWeb3(null, marketAddresses.base, `totalPosition(address)`, [srm], ['uint256']),
//       callWeb3(null, marketAddresses.base, `totalPositionCap(address)`, [srm], ['uint256'])
//     ]);
//
//     let wlEnabled = false;
//     try {
//       wlEnabled = await callWeb3(null, marketAddresses.base, `wlEnabled()`, [], ['bool'], undefined, 1);
//     } catch (e) {
//       // ignore
//     }
//
//     if (Object.keys(expectedCapsOnTopOfVault).includes(marketName.toUpperCase())) {
//       let totalVaultBalance = 0n;
//       for (const subaccount of vaultSubaccounts[marketName.toUpperCase()]) {
//         const balance = await callWeb3(
//           null, subaccounts, `getBalance(uint256,address,uint256)`, [subaccount, marketAddresses.base, 0], ['uint256']
//         );
//         totalVaultBalance += balance;
//       }
//       const capOnTop = expectedCapsOnTopOfVault[marketName.toUpperCase()];
//       const expectedCap = capOnTop + totalVaultBalance;
//       result.oiCaps.basePosition = {
//         isSRMWhitelisted: isWl,
//         depositWL: wlEnabled,
//         totalPosition: fromBN(totalPosition),
//         positionCap: fromBN(positionCap),
//         expectedCap: fromBN(expectedCap),
//         vaultBalances: fromBN(totalVaultBalance),
//         nonVaultUsage: `${fromBN(totalPosition - totalVaultBalance)}/${fromBN(capOnTop)}`
//       };
//     } else {
//       result.oiCaps.basePosition = {
//         isSRMWhitelisted: isWl,
//         depositWL: wlEnabled,
//         totalPosition: fromBN(totalPosition),
//         positionCap: fromBN(positionCap),
//       };
//     }
//   }
//
//   result.feedParams = {};
//
//   if (!marketAddresses.spotFeed) {
//     throw new Error(`Missing spot feed for market`);
//   }
//   let [spotSigners, spotHeartbeat, spotRequiredSigners]: [string[], string, string] = [[], '0', '0'];
//   if (!["SFP", "DOGE"].includes(marketName.toUpperCase())) {
//     [spotSigners, spotHeartbeat, spotRequiredSigners] = await getFeedParams(marketAddresses.spotFeed);
//   }
//
//   result.feedParams.spotFeed = {
//     signers: spotSigners,
//     heartbeat: prettifySeconds(parseInt(spotHeartbeat.toString())),
//     requiredSigners: spotRequiredSigners,
//   };
//
//   if (marketAddresses.option) {
//     if (!marketAddresses.forwardFeed || !marketAddresses.volFeed) {
//       throw new Error(`Missing feeds for option market`);
//     }
//
//     const [volSigners, volHeartbeat, volRequiredSigners] = await getFeedParams(marketAddresses.volFeed);
//
//     result.feedParams.volFeed = {
//       signers: volSigners,
//       heartbeat: prettifySeconds(parseInt(volHeartbeat.toString())),
//       requiredSigners: volRequiredSigners,
//     };
//
//     const [fwdSigners, fwdHeartbeat, fwdRequiredSigners] = await getFeedParams(marketAddresses.forwardFeed);
//     const [
//       spotFeed,
//       settlementHeartbeat
//     ] = await Promise.all([
//       callWeb3(null, marketAddresses.forwardFeed, `spotFeed()`, [], ['address']),
//       callWeb3(null, marketAddresses.forwardFeed, `settlementHeartbeat()`, [], ['uint64'])
//     ]);
//
//     result.feedParams.forwardFeed = {
//       signers: fwdSigners,
//       heartbeat: prettifySeconds(parseInt(fwdHeartbeat.toString())),
//       requiredSigners: fwdRequiredSigners,
//       settlementHeartbeat: prettifySeconds(parseInt(settlementHeartbeat.toString())),
//     };
//
//     if (spotFeed != marketAddresses.spotFeed) {
//       throw new Error(`Mismatched spot feed for forward feed`);
//     }
//   }
//
//   if (marketAddresses.perp) {
//     if (!marketAddresses.perpFeed || !marketAddresses.ibpFeed || !marketAddresses.iapFeed) {
//       throw new Error(`Missing perp feed for market`);
//     }
//
//     const [perpSigners, perpHeartbeat, perpRequiredSigners] = await getFeedParams(marketAddresses.perpFeed);
//
//     result.feedParams.perpFeed = {
//       signers: perpSigners,
//       heartbeat: prettifySeconds(parseInt(perpHeartbeat.toString())),
//       requiredSigners: perpRequiredSigners,
//     };
//
//     const [ibpSigners, ibpHeartbeat, ibpRequiredSigners] = await getFeedParams(marketAddresses.ibpFeed);
//
//     result.feedParams.ibpFeed = {
//       signers: ibpSigners,
//       heartbeat: prettifySeconds(parseInt(ibpHeartbeat.toString())),
//       requiredSigners: ibpRequiredSigners,
//     };
//
//     const [iapSigners, iapHeartbeat, iapRequiredSigners] = await getFeedParams(marketAddresses.iapFeed);
//
//     result.feedParams.iapFeed = {
//       signers: iapSigners,
//       heartbeat: prettifySeconds(parseInt(iapHeartbeat.toString())),
//       requiredSigners: iapRequiredSigners,
//     };
//   }
//
//   return result;
// }
//
// async function getOwners(marketAddresses: MarketAddresses): Promise<{[key:string]: {address: string, owner: string}}> {
//   const addressesWithOwners: {[key:string]: {address: string, owner: string}} = {};
//
//   const promises = Object.keys(marketAddresses).map(async (key) => {
//     if ((marketAddresses as any)[key]) {
//       const contract = (marketAddresses as any)[key];
//       const owner = await callWeb3(null, contract, `owner()`, [], ['address']);
//       addressesWithOwners[key] = {
//         address: contract,
//         owner
//       };
//     }
//   });
//
//   await Promise.all(promises);
//
//   return addressesWithOwners;
// }
//
// async function getAllSRMParams(): Promise<object> {
//   const srm = requireEnv('SRM_ADDRESS');
//
//   const [
//     subAccounts,
//     cashAsset,
//     liquidation,
//     viewer,
//     maxAccountSize,
//     feeRecipientAcc,
//     minOIFee
//   ] = await Promise.all([
//     callWeb3(null, srm, 'subAccounts()', [], ['address']),
//     callWeb3(null, srm, 'cashAsset()', [], ['address']),
//     callWeb3(null, srm, 'liquidation()', [], ['address']),
//     callWeb3(null, srm, 'viewer()', [], ['address']),
//     callWeb3(null, srm, 'maxAccountSize()', [], ['uint256']),
//     callWeb3(null, srm, 'feeRecipientAcc()', [], ['uint256']),
//     callWeb3(null, srm, 'minOIFee()', [], ['uint256']),
//   ]);
//
//   const baseManagerParams = {
//     subAccounts,
//     cashAsset,
//     liquidation,
//     viewer,
//     maxAccountSize: maxAccountSize.toString(),
//     feeRecipientAcc,
//     minOIFee: fromBN(minOIFee),
//   };
//
//   const [borrowingEnabled, lastMarketId, stableFeed] = await Promise.all([
//     callWeb3(null, srm, 'borrowingEnabled()', [], ['bool']),
//     callWeb3(null, srm, 'lastMarketId()', [], ['uint256']),
//     callWeb3(null, srm, 'stableFeed()', [], ['address']),
//   ]);
//
//   const srmParams: any = {
//     borrowingEnabled,
//     lastMarketId: lastMarketId.toString(),
//     stableFeed,
//   };
//
//   const depegParams = await callWeb3(null, srm, 'depegParams()', [], ['(uint256,uint256)']);
//   srmParams["depegParams"] = {
//     depegThreshold: fromBN(depegParams[0]),
//     depegFactor: fromBN(depegParams[1]),
//   };
//
//   const logs = await getLogsWeb3(srm, 'MarketCreated(uint256 id,string marketName)', 0);
//   const markets = logs.map((x: any) => x.data);
//
//   console.log(markets)
//
//   const promises = [];
//
//   let ethSpotPrice = 0n;
//
//   for (const market of markets) {
//     if (market.marketName === 'SFP' || market.marketName === 'PYUSD') {
//       continue;
//     }
//     promises.push((async (): Promise<any> => {
//       const marketId = market.id.toString();
//       const marketAddresses = await getSRMAddresses(marketId);
//
//       // Code block for checking swap rates within the withdrawal wrapper (sponsoring eth for bridging fees)
//       if (marketAddresses.base) {
//         let spotPrice;
//         const erc20 = await callWeb3(null, marketAddresses.base, 'wrappedAsset()', [], ['address']);
//         const decimals = await callWeb3(null, erc20, 'decimals()', [], ['uint256']);
//         if (market.marketName != "deUSD") {
//           const x = await callWeb3(null, marketAddresses.spotFeed as string, 'getSpot()', [], ['uint256', 'uint256']);
//           spotPrice = x[0];
//         } else {
//           spotPrice = toBN("1");
//         }
//         if (market.marketName === "ETH") {
//           ethSpotPrice = spotPrice;
//         } else {
//           while (ethSpotPrice == 0n) await new Promise((resolve) => setTimeout(resolve, 1000));
//         }
//         // get the staticPrice value which converts the minFee (in ETH) into an underlying token amount
//         // minFee (1e18) * staticPrice[token] (1eX) / 1e36;
//         // The result should be the amount of tokens being transferred
//         const rate = toBN("1", 18 + parseInt(decimals.toString())) * ethSpotPrice / spotPrice;
//
//         console.log(market.marketName, erc20, rate); // 2500 is the ETH price
//       }
//
//       const params = await getMarketSRMParams(market.marketName, marketId, marketAddresses);
//       const addressesWithOwners = await getOwners(marketAddresses);
//       return {
//         marketName: market.marketName,
//         marketId,
//         addresses: addressesWithOwners,
//         params,
//       };
//     })())
//   }
//   const marketParams = await Promise.all(promises);
//
//   // throw new Error("Not implemented");
//   return {
//     baseManagerParams,
//     srmParams,
//     marketParams,
//   };
// }

async function getOiCaps(): Promise<void> {
  // console.log("# SRM Params #");
  //
  // const allParams: any = await getAllSRMParams();
  //
  // // console.log(JSON.stringify(allParams, (_, v) => typeof v === 'bigint' ? v.toString() : v));
  //
  // // write results to "data/srmParams.json"
  // const filePath = path.join(__dirname, '../../data/srmParams.json');
  // fs.writeFileSync(filePath, JSON.stringify(allParams, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2));
  //
  // console.log(`Results written to ${filePath}`);
  //
  // for (const market of allParams.marketParams) {
  //   console.log(`${market.marketName.toUpperCase()}_MARKETID=${market.marketId}`);
  //   // console.log(JSON.stringify(market, (_, v) => typeof v === 'bigint' ? v.toString() : v));
  // }
  const srm = requireEnv('SRM_ADDRESS');
  const marketId = 1;

  const res = await multiCallWeb3Internal(
    null,
    [srm,srm,srm,srm],
    ['assetMap(uint256,uint8)','assetMap(uint256,uint8)','assetMap(uint256,uint8)','getMarketFeeds(uint)'],
    [[marketId, AssetType.Option],[marketId, AssetType.Perpetual],[marketId, AssetType.Base],[marketId]],
    [['address'],['address'],['address'],['address','address','address']]
  )

  console.log(res)
}

export default new Command('getOiCaps')
  .description('Log all oi caps')
  .action(getOiCaps);