import {getAllAddresses, isAddress} from "../../utils/getAddresses";
import {ZeroAddress} from "ethers";
import {multiCallWeb3} from "../../utils/web3/utils";
import {fromBN} from "../../utils/misc/BN";
import {getOICaps} from "./shared";

export async function getAllPMParams(): Promise<object> {
  const allAddrs = await getAllAddresses();

  const promises = [];

  for (const market of Object.keys(allAddrs.markets)) {
    const marketAddrs = allAddrs.markets[market];
    if (isAddress(marketAddrs.pmrm)) {
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
          option,
          perp,
          baseAsset,
          spotFeed,
          interestRateFeed,
          volFeed,
          stableFeed,
          forwardFeed
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
            [pmrm, 'option()', [], ['address']],
            [pmrm, 'perp()', [], ['address']],
            [pmrm, 'baseAsset()', [], ['address']],
            [pmrm, 'spotFeed()', [], ['address']],
            [pmrm, 'interestRateFeed()', [], ['address']],
            [pmrm, 'volFeed()', [], ['address']],
            [pmrm, 'stableFeed()', [], ['address']],
            [pmrm, 'forwardFeed()', [], ['address']],
          ]
        );

        return {
          marketName: market,
          addresses: {
            pmrm,
            pmrmLib,
          },
          params: {
            oiCaps: await getOICaps(baseAsset, option, perp),
            baseManagerParams: {
              subAccounts,
              cashAsset,
              liquidation,
              viewer,
              maxAccountSize,
              feeRecipientAcc,
              minOIFee: fromBN(minOIFee),
              option,
              perp,
              baseAsset,
              spotFeed,
              interestRateFeed,
              volFeed,
              stableFeed,
              forwardFeed,
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

  return await Promise.all(promises);
}
