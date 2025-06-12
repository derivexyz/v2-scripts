import {getAllAddresses, isAddress} from "../../utils/getAddresses";
import {ZeroAddress} from "ethers";
import {getLogsWeb3, multiCallWeb3} from "../../utils/web3/utils";
import {fromBN} from "../../utils/misc/BN";
import {getOICaps} from "./shared";

// struct VolShockParameters {
//     /// @dev Multiplicative factor for up vol shocks
//     uint volRangeUp;
//     /// @dev Multiplicative factor for down vol shocks
//     uint volRangeDown;
//     /// @dev exponential used for scaling the vol shock for shorter dated expiries (<30dte)
//     int shortTermPower;
//     /// @dev exponential used for scaling the vol shock for longer dated expiries (>30dte)
//     int longTermPower;
//     /// @dev Minimum DTE used for scaling the vol shock
//     uint dteFloor;
//     /// @dev Minimum vol shock applied in vol up scenarios (i.e. use max(shocked vol, minVolUpShock))
//     uint minVolUpShock;
//   }
//
//   struct MarginParameters {
//     /// @dev Multiplicative factor used to scale the minSPAN to get IM
//     uint imFactor;
//     /// @dev Multiplicative factor used to scale the minSPAN to get MM
//     uint mmFactor;
//     /// @dev Multiplicative factor for static discount calculation, for negative expiry MtM discounting
//     uint shortRateMultScale;
//     /// @dev Multiplicative factor for static discount calculation, for positive expiry MtM discounting
//     uint longRateMultScale;
//     /// @dev Additive factor for static discount calculation, for negative expiry MtM discounting
//     uint shortRateAddScale;
//     /// @dev Additive factor for static discount calculation, for positive expiry MtM discounting
//     uint longRateAddScale;
//     /// @dev The baseStaticDiscount for computing static discount for negative expiry MtM discounting
//     uint shortBaseStaticDiscount;
//     /// @dev The baseStaticDiscount for computing static discount for positive expiry MtM discounting
//     uint longBaseStaticDiscount;
//   }
//
//   struct BasisContingencyParameters {
//     /// @dev the spot shock used for the up scenario for basis contingency
//     uint scenarioSpotUp;
//     /// @dev the spot shock used for the down scenario for basis contingency
//     uint scenarioSpotDown;
//     /// @dev factor used in conjunction with mult factor to scale the basis contingency
//     uint basisContAddFactor;
//     /// @dev factor used in conjunction with add factor to scale the basis contingency
//     uint basisContMultFactor;
//   }
//
//   struct OtherContingencyParameters {
//     /// @dev Below this threshold, we consider the stable asset de-pegged, so we add additional contingency
//     uint pegLossThreshold;
//     /// @dev If below the peg loss threshold, we add this contingency
//     uint pegLossFactor;
//     /// @dev Below this threshold, IM is affected by confidence contingency
//     uint confThreshold;
//     /// @dev Percentage of spot used for confidence contingency, scales with the minimum contingency seen.
//     uint confMargin;
//     /// @dev Contingency applied to perps held in the portfolio, multiplied by spot
//     uint MMPerpPercent;
//     /// @dev Contingency applied to perps held in the portfolio, multiplied by spot, added on top of MMPerpPercent
//     uint IMPerpPercent;
//     /// @dev Factor for multiplying number of naked shorts (per strike) in the portfolio, multiplied by spot.
//     uint MMOptionPercent;
//     /// @dev Factor for multiplying number of naked shorts (per strike) in the portfolio, multiplied by spot,
//     /// added on top of MMOptionPercent for IM
//     uint IMOptionPercent;
//   }
//
//   /// @dev A collection of parameters used within the abs/linear skew shock scenario calculations
//   struct SkewShockParameters {
//     uint linearBaseCap;
//     uint absBaseCap;
//     int linearCBase;
//     int absCBase;
//     int minKStar;
//     int widthScale;
//     int volParamStatic;
//     int volParamScale;
//   }
//
//   // Defined once per collateral
//   struct CollateralParameters {
//     bool isEnabled;
//     bool isRiskCancelling;
//     /// @dev % value of collateral to subtract from MM. Must be <= 1
//     uint MMHaircut;
//     /// @dev % value of collateral to subtract from IM. Added on top of MMHaircut. Must be <= 1
//     uint IMHaircut;
//   }


export async function getAllPM2Params(): Promise<object> {
  const allAddrs = await getAllAddresses();

  let calls: any[] = [];
  const marketCollaterals: { [key: string]: string[] } = {};

  for (const market of Object.keys(allAddrs.markets)) {
    const marketAddrs = allAddrs.markets[market];
    if (isAddress(marketAddrs.pmrm2)) {
      const pmrm2 = marketAddrs.pmrm2;
      const pmrm2Lib = marketAddrs.pmrm2Lib;

      const collateralSpotFeedsEvents = await getLogsWeb3(pmrm2, "CollateralSpotFeedUpdated(address asset, address feed)")
      const collaterals: Set<string> = new Set(collateralSpotFeedsEvents.map((x: any) => x.data.asset));
      marketCollaterals[market] = Array.from(collaterals);

      for (const collateral of marketCollaterals[market]) {
        calls.push([pmrm2, 'collateralSpotFeeds(address)', [collateral], ['address']]);
        calls.push([pmrm2Lib, 'getCollateralParameters(address)', [collateral], ['(bool,bool,uint256,uint256)']]);
      }

      calls.push([pmrm2, 'maxAccountSize()', [], ['uint256']]);
      calls.push([pmrm2, 'feeRecipientAcc()', [], ['uint256']]);
      calls.push([pmrm2, 'minOIFee()', [], ['uint256']]);
      calls.push([pmrm2, 'getScenarios()', [], ['(uint256,uint8,uint256)[]']]);
      calls.push([pmrm2Lib, 'getBasisContingencyParams()', [], ['(uint256,uint256,uint256,uint256)']]);
      calls.push([pmrm2Lib, 'getOtherContingencyParams()', [], ['(uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256)']]);
      calls.push([pmrm2Lib, 'getMarginParams()', [], ['(uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256)']]);
      calls.push([pmrm2Lib, 'getVolShockParams()', [], ['(uint256,uint256,int256,int256,uint256,uint256)']]);
      calls.push([pmrm2Lib, 'getSkewShockParams()', [], ['(uint256,uint256,int256,int256,int256,int256,int256,int256)']]);
      calls.push([pmrm2, 'subAccounts()', [], ['address']]);
      calls.push([pmrm2, 'cashAsset()', [], ['address']]);
      calls.push([pmrm2, 'liquidation()', [], ['address']]);
      calls.push([pmrm2, 'viewer()', [], ['address']]);
      calls.push([pmrm2, 'option()', [], ['address']]);
      calls.push([pmrm2, 'perp()', [], ['address']]);
      calls.push([pmrm2, 'spotFeed()', [], ['address']]);
      calls.push([pmrm2, 'interestRateFeed()', [], ['address']]);
      calls.push([pmrm2, 'volFeed()', [], ['address']]);
      calls.push([pmrm2, 'stableFeed()', [], ['address']]);
      calls.push([pmrm2, 'forwardFeed()', [], ['address']]);
    }
  }

  const callsRes = await multiCallWeb3(null, calls);
  let index = 0;
  const result = [];


  for (const market of Object.keys(allAddrs.markets)) {
    const marketAddrs = allAddrs.markets[market];
    if (isAddress(marketAddrs.pmrm2)) {
      const pmrm2 = marketAddrs.pmrm2;
      const pmrm2Lib = marketAddrs.pmrm2Lib;
      const collaterals = marketCollaterals[market];

      const marketRes: any = {
        market,
        collaterals: {}
      };

      for (const collateral of collaterals) {
        const market = Object.entries(allAddrs.markets).find(y => (y[1]).baseAsset == collateral)
        if (!market) {
          throw new Error(`Market not found for collateral: ${collateral}`);
        }

        if (market[1].baseAsset != collateral) {
          throw new Error(`Market not found for collateral: ${collateral}`);
        }

        const feed = callsRes[index++];
        const params = callsRes[index++];
        marketRes.collaterals[market[0]] = {
          name: market[0],
          baseAsset: market[1].baseAsset,
          expectedSpotFeed: allAddrs.markets[market[0]].spotFeed,
          actualSpotFeed: feed,
          collateralParams: {
            isEnabled: params[0],
            isRiskCancelling: params[1],
            mmHaircut: fromBN(params[2]),
            imHaircut: fromBN(params[3]),
          }
        };
      }

      marketRes.maxAccountSize = fromBN(callsRes[index++]);
      marketRes.feeRecipientAcc = callsRes[index++];
      marketRes.minOIFee = fromBN(callsRes[index++]);
      const scenarios = callsRes[index++];
      const basisContingencyParams = callsRes[index++];
      const otherContingencyParams = callsRes[index++];
      const marginParams = callsRes[index++];
      const volShockParams = callsRes[index++];
      const skewShockParams = callsRes[index++];

      marketRes.params = {
        scenarios: scenarios.map((x: any) => ({
          spotShock: fromBN(x[0]),
          scenarioType: ['none', 'up', 'down', 'linear', 'abs'][x[1]],
          dampeningFactor: fromBN(x[2]),
        })),
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
          MMPerpPercent: fromBN(otherContingencyParams[4]),
          IMPerpPercent: fromBN(otherContingencyParams[5]),
          MMOptionPercent: fromBN(otherContingencyParams[6]),
          IMOptionPercent: fromBN(otherContingencyParams[7]),
        },
        marginParams: {
          imFactor: fromBN(marginParams[0]),
          mmFactor: fromBN(marginParams[1]),
          shortRateMultScale: fromBN(marginParams[2]),
          longRateMultScale: fromBN(marginParams[3]),
          shortRateAddScale: fromBN(marginParams[4]),
          longRateAddScale: fromBN(marginParams[5]),
          shortBaseStaticDiscount: fromBN(marginParams[6]),
          longBaseStaticDiscount: fromBN(marginParams[7]),
        },
        volShockParams: {
          volRangeUp: fromBN(volShockParams[0]),
          volRangeDown: fromBN(volShockParams[1]),
          shortTermPower: fromBN(volShockParams[2]),
          longTermPower: fromBN(volShockParams[3]),
          dteFloor: fromBN(volShockParams[4]),
          minVolUpShock: fromBN(volShockParams[5]),
        },
        skewShockParams: {
          linearBaseCap: fromBN(skewShockParams[0]),
          absBaseCap: fromBN(skewShockParams[1]),
          linearCBase: fromBN(skewShockParams[2]),
          absCBase: fromBN(skewShockParams[3]),
          minKStar: fromBN(skewShockParams[4]),
          widthScale: fromBN(skewShockParams[5]),
          volParamStatic: fromBN(skewShockParams[6]),
          volParamScale: fromBN(skewShockParams[7]),
        },
      }

      marketRes.addresses = {
        pmrm2,
        pmrm2Lib,
        subAccounts: callsRes[index++],
        cashAsset: callsRes[index++],
        liquidation: callsRes[index++],
        viewer: callsRes[index++],
        option: callsRes[index++],
        perp: callsRes[index++],
        spotFeed: callsRes[index++],
        interestRateFeed: callsRes[index++],
        volFeed: callsRes[index++],
        stableFeed: callsRes[index++],
        forwardFeed: callsRes[index++],
      };
      result.push(marketRes);
    }
  }

  // pass over again to add more information
  calls = [];
  for (const market of result) {
    for (const addr of Object.entries(market.addresses)) {
      calls.push([addr[1], "owner()", [], ['address']]);
    }
  }

  const ownersRes = await multiCallWeb3(null, calls);

  for (const market of result) {
    for (const addr of Object.entries(market.addresses)) {
      market.addresses[addr[0]] = {
        address: addr[1],
        owner: ownersRes.shift()
      };
    }
  }

  return result;
}
