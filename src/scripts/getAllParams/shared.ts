import {getAllAddresses} from "../../utils/getAddresses";
import {multiCallWeb3} from "../../utils/web3/utils";
import {fromBN} from "../../utils/misc/BN";

export async function getOICaps(baseAsset?: string, optionAsset?: string, perpAsset?: string) {
  const allAddrs = await getAllAddresses();
  const res: any = {};

  const calls: any[] = [];

  if (baseAsset) {
    calls.push([baseAsset, `whitelistedManager(address)`, [allAddrs.srm], ['bool']])
    calls.push([baseAsset, `totalPosition(address)`, [allAddrs.srm], ['uint256']])
    calls.push([baseAsset, `totalPositionCap(address)`, [allAddrs.srm], ['uint256']])
    calls.push([baseAsset, `wlEnabled()`, [], ['bool']])
  }

  if (optionAsset) {
    calls.push([optionAsset, `whitelistedManager(address)`, [allAddrs.srm], ['bool']])
    calls.push([optionAsset, `totalPosition(address)`, [allAddrs.srm], ['uint256']])
    calls.push([optionAsset, `totalPositionCap(address)`, [allAddrs.srm], ['uint256']])
  }

  if (perpAsset) {
    calls.push([perpAsset, `whitelistedManager(address)`, [allAddrs.srm], ['bool']])
    calls.push([perpAsset, `totalPosition(address)`, [allAddrs.srm], ['uint256']])
    calls.push([perpAsset, `totalPositionCap(address)`, [allAddrs.srm], ['uint256']])
    calls.push([allAddrs.trade, 'isPerpAsset(address)', [perpAsset], ['bool']]);
    calls.push([allAddrs.rfq, 'isPerpAsset(address)', [perpAsset], ['bool']]);
  }

  const results = await multiCallWeb3(null, calls);
  let index = 0;

  if (baseAsset) {
    res.basePosition = {
      isSRMWhitelisted: results[index++],
      totalPosition: fromBN(results[index++]),
      positionCap: fromBN(results[index++]),
      depositWL: results[index] == undefined ? false : results[index],
    };
    index++;
  }

  if (optionAsset) {
    res.optionPosition = {
      isWhitelisted: results[index++],
      totalPosition: fromBN(results[index++]),
      positionCap: fromBN(results[index++]),
    };
  }

  if (perpAsset) {
    res.perpPosition = {
      isWhitelisted: results[index++],
      totalPosition: fromBN(results[index++]),
      positionCap: fromBN(results[index++]),
      matching: {
        isTradePerp: results[index++],
        isRfqPerp: results[index++],
      }
    };
  }

  return res;
}

