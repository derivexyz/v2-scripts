import { callWeb3, executeWeb3, getLogsWeb3 } from '../web3/utils';
import { getAllAddresses } from '../getAddresses';
import { ethers } from 'ethers';
import { AccountMarginDetails } from './subaccounts';
import { timeSeconds } from '../misc/time';
import { logger } from '../logger';
import { fromBN, toBN } from '../misc/BN';

export type AuctionDetails = {
  subAccId: bigint;
  ongoing: boolean;
  cachedScenario: bigint;
  insolvent: boolean;
  startTime: bigint;
  reservedCash: bigint;
};

export type AuctionParams = {
  startingMtMPercentage: bigint;
  fastAuctionCutoffPercentage: bigint;
  fastAuctionLength: bigint;
  slowAuctionLength: bigint;
  insolventAuctionLength: bigint;
  liquidatorFeeRate: bigint;
  bufferMarginPercentage: bigint;
};

export type AuctionAccountMargin = {
  manager: string;
  MM: bigint;
  MtM: bigint;
  worstScenario: bigint;
};

////////////////////
// Contract calls //
////////////////////

export async function getAuctionParams(): Promise<AuctionParams> {
  const addresses = await getAllAddresses();
  const auctionParamsRes = await callWeb3(
    null,
    addresses.auction,
    'getAuctionParams()',
    [],
    ['uint', 'uint', 'uint', 'uint', 'uint', 'uint', 'uint'],
  );
  return {
    startingMtMPercentage: auctionParamsRes[0],
    fastAuctionCutoffPercentage: auctionParamsRes[1],
    fastAuctionLength: auctionParamsRes[2],
    slowAuctionLength: auctionParamsRes[3],
    insolventAuctionLength: auctionParamsRes[4],
    liquidatorFeeRate: auctionParamsRes[5],
    bufferMarginPercentage: auctionParamsRes[6],
  };
}

export async function getAllAuctionsubAccIds() {
  const addresses = await getAllAddresses();

  // Find all current auctions
  const allsubAccIds = new Set<bigint>();
  let res = await getLogsWeb3(
    addresses.auction,
    'SolventAuctionStarted(uint accountId, uint scenarioId, int markToMarket, uint fee)',
  );
  res.forEach((x: any) => allsubAccIds.add(x.data.accountId));

  for (const x of res) {
    console.log(x);
  }

  res = await getLogsWeb3(
    addresses.auction,
    'InsolventAuctionStarted(uint accountId, uint scenarioId, int maintenanceMargin)',
  );
  res.forEach((x: any) => allsubAccIds.add(x.data.accountId));

  return allsubAccIds;
}

export async function getAuctionDetails(subAccId: bigint): Promise<AuctionDetails> {
  const addresses = await getAllAddresses();

  if (addresses.auction == '0x026dD5F94275faa74E41b16fea68f664d1ec68cC') {
    // uint accountId; uint scenarioId; bool insolvent; bool ongoing; uint cachedMM;
    // TESTNET ONLY: uint percentageLeft;
    // uint startTime; uint reservedCash;
    const res = await callWeb3(
      null,
      addresses.auction,
      'getAuction(uint256)',
      [subAccId],
      ['uint', 'uint', 'bool', 'bool', 'uint', 'uint', 'uint', 'uint'],
    );
    return {
      subAccId,
      ongoing: res[3],
      cachedScenario: res[1],
      insolvent: res[2],
      startTime: res[6],
      reservedCash: res[7],
    };
  } else {
    // uint accountId; uint scenarioId; bool insolvent; bool ongoing; uint cachedMM; uint startTime; uint reservedCash
    const res = await callWeb3(
      null,
      addresses.auction,
      'getAuction(uint256)',
      [subAccId],
      ['uint', 'uint', 'bool', 'bool', 'uint', 'uint', 'uint'],
    );
    return {
      subAccId,
      ongoing: res[3],
      cachedScenario: res[1],
      insolvent: res[2],
      startTime: res[5],
      reservedCash: res[6],
    };
  }
}

export async function getSubaccountMargin(subAccId: bigint, block?: number): Promise<AuctionAccountMargin> {
  const addresses = await getAllAddresses();
  const mmRes = await callWeb3(
    null,
    !addresses.auctionUtilsV2 ? addresses.auctionUtils: block ?? 0 > 24748389 ? addresses.auctionUtilsV2 : addresses.auctionUtils,
    'getMM(uint256)',
    [subAccId],
    ['address', 'int256', 'int', 'uint'],
    block,
    // dont retry since it can commonly fail
    0
  );
  return {
    manager: mmRes[0],
    MM: mmRes[1],
    MtM: mmRes[2],
    worstScenario: mmRes[3],
  };
}

export async function bidOnAccount(
  wallet: ethers.Wallet,
  subAccId: bigint,
  liquidatorId: bigint,
  percent: bigint,
  collateralAmount: bigint | null,
  lastTradeId: bigint,
  maxCost: bigint,
  merge: boolean,
) {
  const addresses = await getAllAddresses();
  const auctionDetails = await getAuctionDetails(subAccId);
  const auctionMargin = await getSubaccountMargin(subAccId);
  console.log(auctionMargin);
  const auctionParams = await getAuctionParams();

  const [bidPrice, _] = getAuctionBidPrice(auctionDetails, auctionMargin, auctionParams);
  const cashRequired = bidPrice - getBufferMargin(auctionMargin, auctionParams);

  logger.debug(`cashRequired: ${cashRequired}`);
  logger.debug(`percent: ${percent}`);

  if (collateralAmount == null) {
    // if unspecified, provide the minimum with some buffer
    collateralAmount = (cashRequired * percent) / toBN('1') + toBN('10');
  }

  if (collateralAmount < (cashRequired * percent) / toBN('1')) {
    throw Error(
      `Not enough collateral to bid on account, must have at least ${fromBN((cashRequired * percent) / toBN('1'))}`,
    );
  }

  return await executeWeb3(
    wallet,
    addresses.auctionUtils,
    'advancedBid(uint256,uint256,uint256,uint256,int256,uint256,uint256,bool,bytes)',
    [
      auctionMargin.worstScenario,
      subAccId,
      liquidatorId,
      percent, // percent of account
      // Safety checks, set to 0 to skip
      maxCost,
      lastTradeId,
      // collateral amount must be > 0.
      // Final balance of liquidator must be > BM * % for solvent, > MM * % for insolvent
      collateralAmount,
      // Merge the account back into the one liquidating
      merge,
      '0x',
    ],
  );
}

////////////////////////////////////////////
// Helpers for calculating auction prices //
////////////////////////////////////////////

export function getAuctionBidPrice(
  auction: AuctionDetails,
  margin: AccountMarginDetails,
  params: AuctionParams,
): [bigint, bigint] {
  const now = BigInt(timeSeconds());

  if (auction.insolvent) {
    if (now - auction.startTime > params.insolventAuctionLength) {
      return [margin.MM, -toBN('1')];
    } else {
      const cappedMtm: bigint = margin.MtM > 0 ? BigInt(0) : margin.MtM; // will now be <= 0
      const discount = (now - auction.startTime) / params.insolventAuctionLength;
      return [((margin.MM - cappedMtm) * (now - auction.startTime)) / params.insolventAuctionLength, -discount];
    }
  } else {
    const bufferMargin = getBufferMargin(margin, params);

    const discount = getDiscountPercentage(auction.startTime, now, params);

    return [((bufferMargin - auction.reservedCash) * discount) / toBN('1'), discount];
  }
}

export function getAuctionMaxProportion(margin: AccountMarginDetails, params: AuctionParams, discount: bigint): bigint {
  const bufferMargin = getBufferMargin(margin, params);

  if (bufferMargin > 0) {
    return toBN('1');
  }

  const denominator =
    bufferMargin -
    (margin.MtM * discount) / toBN('1') -
    ((margin.MM - margin.MtM) * (toBN('1') - discount)) / toBN('1');

  return bufferMargin / denominator;
}

export function getBufferMargin(margin: AccountMarginDetails, params: AuctionParams) {
  return margin.MM + ((margin.MM - margin.MtM) * params.bufferMarginPercentage) / ethers.parseUnits('1', 18);
}

export function getDiscountPercentage(startTime: bigint, now: bigint, params: AuctionParams) {
  const timeElapsed = now - startTime;

  if (timeElapsed < params.fastAuctionLength) {
    // still during the fast auction
    const totalChangeInFastAuction = params.startingMtMPercentage - params.fastAuctionCutoffPercentage;
    return params.startingMtMPercentage - (totalChangeInFastAuction * timeElapsed) / params.fastAuctionLength;
  } else if (timeElapsed >= params.fastAuctionLength + params.slowAuctionLength) {
    // whole solvent auction is over
    return BigInt(0);
  } else {
    // during the slow auction
    const timeElapsedInSlow = timeElapsed - params.fastAuctionLength;
    return (
      params.fastAuctionCutoffPercentage -
      (params.fastAuctionCutoffPercentage * timeElapsedInSlow) / params.slowAuctionLength
    );
  }
}
