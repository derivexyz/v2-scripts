import {
    AuctionDetails,
    getAllAuctionsubAccIds, getAuctionBidPrice,
    getAuctionDetails, getAuctionMaxProportion,
    getAuctionParams
} from "../utils/contracts/auctions";
import { getAccountDetails, printPortfolio} from "../utils/contracts/subaccounts";
import * as console from "console";
import {logger} from "../utils/logger";
import {fromBN} from "../utils/web3/utils";
import chalk from "chalk";
import {prettifyBN} from "../utils/misc/prettifyBN";


const SUBMIT_FEED_DATA = true;


async function getAllCurrentAuctions() {
    const auctionParams = await getAuctionParams()
    const allsubAccIds = await getAllAuctionsubAccIds();

    const auctionResults: Promise<AuctionDetails>[] = []

    logger.info(`Checking ${allsubAccIds.size} total seen auctions`);

    for (const subAccId of allsubAccIds) {
        // manager, mm, mtm, worstScenario
        auctionResults.push(getAuctionDetails(subAccId));
        if (auctionResults.length % 10 == 0) {
            await Promise.all(auctionResults);
        }
    }

    const currentAuctions = (await Promise.all(auctionResults)).filter(a => a.ongoing);

    logger.info(`Getting details for ${currentAuctions.length} ongoing auctions`);

    const accountDetails = [];

    for (let i = 0; i < currentAuctions.length; ++i) {
        accountDetails.push(getAccountDetails(currentAuctions[i].subAccId));
        // Every 10 entries, wait for them all to finish before moving on
        if (accountDetails.length % 10 == 0) {
            await Promise.all(accountDetails);
        }
    }

    await Promise.all(accountDetails);

    for (let i = 0; i < currentAuctions.length; ++i) {
        const auction = currentAuctions[i];
        const portfolioComposition = await accountDetails[i];

        const [bidPrice, discount] = getAuctionBidPrice(auction, portfolioComposition.margin, auctionParams);
        logger.info(`\nSubaccount: ${chalk.bold(auction.subAccId)}`);
        printPortfolio(portfolioComposition.portfolio)
        logger.info(`MtM: ${prettifyBN(portfolioComposition.margin.MtM)}`);
        logger.info(`MM: ${prettifyBN(portfolioComposition.margin.MM)}`);
        logger.info(`auction is ${auction.insolvent ? chalk.yellow("insolvent") : chalk.blue("solvent")}`);
        logger.info(`bid price: ${chalk.yellow(fromBN(bidPrice))}`);
        logger.info(`discount %: ${fromBN(discount)}`);
        logger.info(`max bid percentage: ${
            auction.insolvent 
              ? "1.0" 
              : fromBN(getAuctionMaxProportion(portfolioComposition.margin, auctionParams, discount))
        }`);
    }
}


getAllCurrentAuctions().then().catch(console.error);
