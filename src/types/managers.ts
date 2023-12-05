import {getAllAddresses} from "../utils/getAddresses";

export type MarginType = "SM" | "PM";

export type ManagerType = "SM" | "ETH_PMRM" | "BTC_PMRM";

export function getCurrency(manager: ManagerType): string {
    if (manager == "SM") {
        throw new Error("SM does not have a currency");
    } else if (manager == "ETH_PMRM") {
        return "ETH";
    } else if (manager == "BTC_PMRM") {
        return "BTC";
    } else {
        throw new Error("Invalid manager type");
    }
}

export function getMarginType(manager: ManagerType): MarginType {
    if (manager == "SM") {
        return "SM";
    } else {
        return "PM";
    }
}

export async function getManagerAddress(manager: ManagerType): Promise<string> {
    const addresses = await getAllAddresses();

    if (manager == "SM") {
        return addresses.srm;
    } else if (manager == "ETH_PMRM") {
        return addresses.markets.ETH.pmrm;
    } else if (manager == "BTC_PMRM") {
        return addresses.markets.BTC.pmrm;
    } else {
        throw new Error("Invalid manager type");
    }
}