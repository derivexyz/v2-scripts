import {BigNumberish} from "ethers";
import * as process from "process";
import {getAccountDetails, printPortfolio} from "../utils/contracts/subaccounts";
import console from "console";

async function getBalances(subAccId: BigNumberish) {
    const accountDetails = await getAccountDetails(BigInt(subAccId));
    console.log(accountDetails)
    printPortfolio(accountDetails.portfolio)
}


getBalances(process.argv[process.argv.length - 1]).then(() => {
    console.log("done");
}).catch((err) => {
    console.error(err);
});
