import {callWeb3, toBN} from "../web3/utils";
import {loadContractAddresses} from "../getAddresses";
import { getSubaccountMargin} from "./auctions";
import {subIdToOptionDetails} from "./option";

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
    margin: AccountMarginDetails,
    portfolio: AccountPortfolio
}



export async function getAccountDetails(subAccId: bigint): Promise<AccountDetails> {
    const addresses = await loadContractAddresses();

    const lastTradeId = await callWeb3(null, addresses.subAccounts, 'lastAccountTradeId(uint256)', [subAccId], ["uint256"]);

    const margin = await getSubaccountMargin(subAccId);

    const portfolio = await getAccountPortfolio(subAccId);

    return {
        subAccId,
        manager: margin.manager,
        lastTradeId,
        margin: {
            MM: margin.MM,
            MtM: margin.MtM,
            worstScenario: margin.worstScenario
        },
        portfolio
    }
}

export async function getAccountPortfolio(subAccId: bigint): Promise<AccountPortfolio> {
    const addresses = await loadContractAddresses();

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
    console.log("Cash: ", portfolio.cash);
    for (const currency of Object.keys(portfolio.markets)) {
        console.log(currency);
        console.log("  Base: ", portfolio.markets[currency].base);
        console.log("  Perp: ", portfolio.markets[currency].perp);
        for (const optionKey of Object.keys(portfolio.markets[currency].options)) {
            console.log(`  ${optionKey}: `, portfolio.markets[currency].options[optionKey]);
        }
    }
}
