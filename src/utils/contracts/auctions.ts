import {callWeb3, getLogsWeb3} from "../web3/utils";
import {loadContractAddresses} from "../getAddresses";
import {ethers} from "ethers";
import {AccountMarginDetails} from "./subaccounts";

export type AuctionDetails  = {
    subAccId: bigint,
    ongoing: boolean,
    cachedScenario: bigint,
    insolvent: boolean,
    startTime: bigint,
    reservedCash: bigint,
}

export type AuctionParams = {
    startingMtMPercentage: bigint;
    fastAuctionCutoffPercentage: bigint;
    fastAuctionLength: bigint;
    slowAuctionLength: bigint;
    insolventAuctionLength: bigint;
    liquidatorFeeRate: bigint;
    bufferMarginPercentage: bigint;
}


export type AuctionAccountMargin = {
    manager: string,
    MM: bigint,
    MtM: bigint,
    worstScenario: bigint
}


////////////////////
// Contract calls //
////////////////////


export async function getAuctionParams(): Promise<AuctionParams> {
    const addresses = await loadContractAddresses();
    const auctionParamsRes = await callWeb3(null, addresses.auction, 'getAuctionParams()', [], ["uint", "uint", "uint", "uint", "uint", "uint", "uint"]);
    return {
        startingMtMPercentage: auctionParamsRes[0],
        fastAuctionCutoffPercentage: auctionParamsRes[1],
        fastAuctionLength: auctionParamsRes[2],
        slowAuctionLength: auctionParamsRes[3],
        insolventAuctionLength: auctionParamsRes[4],
        liquidatorFeeRate: auctionParamsRes[5],
        bufferMarginPercentage: auctionParamsRes[6],
    }
}

export async function getAllAuctionsubAccIds() {
    const addresses = await loadContractAddresses();

    // Find all current auctions
    const allsubAccIds = new Set<bigint>();
    let res = await getLogsWeb3(addresses.auction, 'SolventAuctionStarted(uint accountId, uint scenarioId, int markToMarket, uint fee)')
    res.forEach((x: any) => allsubAccIds.add(x.data.accountId))

    res = await getLogsWeb3(addresses.auction, 'InsolventAuctionStarted(uint accountId, uint scenarioId, int maintenanceMargin)')
    res.forEach((x: any) => allsubAccIds.add(x.data.accountId))

    return allsubAccIds;
}

export async function getAuctionDetails(subAccId: bigint): Promise<AuctionDetails> {
    const addresses = await loadContractAddresses();

    if (addresses.auction == "0x026dD5F94275faa74E41b16fea68f664d1ec68cC") {
        // uint accountId; uint scenarioId; bool insolvent; bool ongoing; uint cachedMM;
        // TESTNET ONLY: uint percentageLeft;
        // uint startTime; uint reservedCash;
        const res = await callWeb3(null, addresses.auction, 'getAuction(uint256)', [subAccId], ["uint", "uint", "bool", "bool", "uint", "uint", "uint", "uint"]);
        return {
            subAccId,
            ongoing: res[3],
            cachedScenario: res[1],
            insolvent: res[2],
            startTime: res[6],
            reservedCash: res[7],
        }
    } else {
        // uint accountId; uint scenarioId; bool insolvent; bool ongoing; uint cachedMM; uint startTime; uint reservedCash
        const res = await callWeb3(null, addresses.auction, 'getAuction(uint256)', [subAccId], ["uint", "uint", "bool", "bool", "uint", "uint", "uint"]);
        return {
            subAccId,
            ongoing: res[3],
            cachedScenario: res[1],
            insolvent: res[2],
            startTime: res[5],
            reservedCash: res[6],
        }
    }
}

export async function getSubaccountMargin(subAccId: bigint): Promise<AuctionAccountMargin> {
    const addresses = await loadContractAddresses();
    const mmRes = await callWeb3(null, addresses.auctionUtils, 'getMM(uint256)', [subAccId], ["address", "int256", "int", "uint"]);
    return {
        manager: mmRes[0],
        MM: mmRes[1],
        MtM: mmRes[2],
        worstScenario: mmRes[3],
    }
}

////////////////////////////////////////////
// Helpers for calculating auction prices //
////////////////////////////////////////////

export function getAuctionBidPrice(auction: AuctionDetails, margin: AccountMarginDetails, params: AuctionParams) {
    const now = BigInt(Math.floor(Date.now() / 1000));

    if (auction.insolvent) {
        if (now - auction.startTime > params.insolventAuctionLength) {
            return margin.MM
        } else {
            const cappedMtm: bigint = margin.MtM > 0 ? BigInt(0) : margin.MtM // will now be <= 0
            return (margin.MM - cappedMtm) * (now - auction.startTime) / params.insolventAuctionLength;
        }
    } else {
        const bufferMargin = getBufferMargin(margin, params);

        const discount = getDiscountPercentage(auction.startTime, now, params);

        return (bufferMargin - auction.reservedCash) * discount / ethers.parseUnits("1", 18);
    }
}

export function getBufferMargin(margin: AccountMarginDetails, params: AuctionParams) {
    return margin.MM + ((margin.MM - margin.MtM) * params.bufferMarginPercentage / ethers.parseUnits("1", 18));
}

export function getDiscountPercentage(startTime: bigint, now: bigint, params: AuctionParams) {
    const timeElapsed = now - startTime;

    if (timeElapsed < params.fastAuctionLength) {
        // still during the fast auction
        const totalChangeInFastAuction = params.startingMtMPercentage - params.fastAuctionCutoffPercentage;
        return params.startingMtMPercentage - totalChangeInFastAuction * timeElapsed / params.fastAuctionLength;
    } else if (timeElapsed >= params.fastAuctionLength + params.slowAuctionLength) {
        // whole solvent auction is over
        return BigInt(0);
    } else {
        // during the slow auction
        const timeElapsedInSlow = timeElapsed - params.fastAuctionLength;
        return params.fastAuctionCutoffPercentage
            - params.fastAuctionCutoffPercentage * timeElapsedInSlow / params.slowAuctionLength;
    }
}
