import {BigNumberish} from "ethers";
import * as process from "process";
import {getAccountDetails, printPortfolio} from "../utils/contracts/subaccounts";
import console from "console";
import {logger} from "../utils/logger";

async function getBalances(subAccId: BigNumberish) {
    const accountDetails = await getAccountDetails(BigInt(subAccId));
    logger.debug(accountDetails)
    printPortfolio(accountDetails.portfolio)
}


getBalances(process.argv[process.argv.length - 1]).then().catch(console.error);
