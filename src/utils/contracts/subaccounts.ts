import {callWeb3, executeWeb3, fromBN, toBN} from "../web3/utils";
import {getAllAddresses} from "../getAddresses";
import { getSubaccountMargin} from "./auctions";
import {subIdToOptionDetails} from "./option";
import {getManagerAddress, ManagerType} from "../../types/managers";
import {ethers} from "ethers";
import {logger} from "../logger";
import {prettifyBN} from "../misc/prettifyBN";

export type AccountPortfolio = {
    cash: bigint,
    markets: {[currency: string]: {
        base: bigint,
        perp: bigint,
        options: {
            [expiry_strike_type: string]: bigint
        }
     }}

}

export type AccountMarginDetails = {
    MM: bigint,
    MtM: bigint,
    worstScenario: bigint
}

export type AccountDetails = {
    subAccId: bigint,
    manager: string,
    lastTradeId: bigint,
    margin?: AccountMarginDetails,
    portfolio: AccountPortfolio
}


export async function createAndGetNewSubaccount(wallet: ethers.Wallet, manager: ManagerType): Promise<bigint> {
    const addresses = await getAllAddresses();

    const tx = await executeWeb3(wallet, addresses.subAccounts, 'createAccount(address,address)', [wallet.address, await getManagerAddress(manager)]);
    return getSubaccountIdFromEvents(tx.logs);
}

export async function approveSubaccount(wallet: ethers.Wallet, spender: string, subaccount: bigint) {
    const addresses = await getAllAddresses();

    const approved = await callWeb3(null, addresses.subAccounts, 'getApproved(uint256)', [subaccount], ["address"]);
    if (approved == spender) {
        return;
    }

    await executeWeb3(wallet, addresses.subAccounts, 'approve(address to,uint256 tokenId)', [spender, subaccount]);
}

export function getSubaccountIdFromEvents(logs: any[]) {
    // Transfer events
    const filteredLogs = logs.filter(x => x.topics[0] == "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef");
    if (filteredLogs.length == 0) {
        throw Error("No subaccount created in transaction");
    }
    const subAccId = filteredLogs[0].topics[3];

    if (filteredLogs.length > 1) {
        if (!filteredLogs.every(x => x.topics[3] == subAccId)) {
            logger.debug(filteredLogs)
            throw Error("More than one subaccount created in a single transaction");
        }
    }

    return BigInt(subAccId);
}

export async function getAccountDetails(subAccId: bigint): Promise<AccountDetails> {
    const addresses = await getAllAddresses();

    const lastTradeId = await callWeb3(null, addresses.subAccounts, 'lastAccountTradeId(uint256)', [subAccId], ["uint256"]);

    let margin: AccountMarginDetails | undefined = undefined;
    try {
        margin = await getSubaccountMargin(subAccId);
    } catch (e) {
        logger.warn("Could not compute margin due to feeds being stale")
    }

    const portfolio = await getAccountPortfolio(subAccId);

    return {
        subAccId,
        // manager: margin.manager,
        lastTradeId,
        margin,
        portfolio
    } as any
}

export async function getAccountPortfolio(subAccId: bigint): Promise<AccountPortfolio> {
    const addresses = await getAllAddresses();

    const balances = await callWeb3(null, addresses.subAccounts, 'getAccountBalances(uint256)', [subAccId], ["(address,uint256,int256)[]"]);

    const res: AccountPortfolio = {
        cash: 0n,
        markets: {}
    }
    for (const balance of balances) {
        const asset = balance[0];
        const subId = balance[1];
        const amount = balance[2];
        if (asset == addresses.cash) {
            res.cash = amount;
        } else {
            for (const currency of Object.keys(addresses.markets)) {
                const market = addresses.markets[currency];
                if (market.base == asset) {
                    if (!res.markets[currency]) {
                        res.markets[currency] = {
                            base: 0n,
                            perp: 0n,
                            options: {}
                        }
                    }
                    res.markets[currency].base = amount;
                } else if (market.perp == asset) {
                    if (!res.markets[currency]) {
                        res.markets[currency] = {
                            base: 0n,
                            perp: 0n,
                            options: {}
                        }
                    }
                    res.markets[currency].perp = amount;
                } else if (market.option == asset) {
                    if (!res.markets[currency]) {
                        res.markets[currency] = {
                            base: 0n,
                            perp: 0n,
                            options: {}
                        }
                    }
                    const optionDetails = subIdToOptionDetails(subId);
                    const optionKey = `${optionDetails.expiry}_${optionDetails.strike / BigInt(toBN("1"))}_${optionDetails.isCall ? "C" : "P"}`;
                    res.markets[currency].options[optionKey] = amount;
                }
            }
        }
    }
    return res
}

export function printPortfolio(portfolio: AccountPortfolio) {
    logger.info(`- Cash: ${prettifyBN(portfolio.cash)}`);
    for (const currency of Object.keys(portfolio.markets)) {
        logger.info(`- ${currency}:`);
        if (portfolio.markets[currency].base != 0n) {
            logger.info(`-- Base: ${prettifyBN(portfolio.markets[currency].base)}`);
        }
        if (portfolio.markets[currency].perp != 0n) {
            logger.info(`-- Perp: ${prettifyBN(portfolio.markets[currency].perp)}`);
        }
        for (const optionKey of Object.keys(portfolio.markets[currency].options)) {
            logger.info(`-- ${optionKey}: ${prettifyBN(portfolio.markets[currency].options[optionKey])}`);
        }
    }
}
