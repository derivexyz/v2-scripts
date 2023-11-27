import { Wallet} from "ethers";
import {getAllFeedManagerData} from "./utils/getManagerData";
import {
    AuctionDetails,
    getAllAuctionsubAccIds, getAuctionBidPrice,
    getAuctionDetails,
    getAuctionParams, getSubaccountMargin
} from "../utils/contracts/auctions";
import {getAllAddresses} from "../utils/getAddresses";
import {getAccountDetails, printPortfolio} from "../utils/contracts/subaccounts";
import * as console from "console";


const SUBMIT_FEED_DATA = true;


async function getAllCurrentAuctions() {
    const auctionParams = await getAuctionParams()
    const allsubAccIds = await getAllAuctionsubAccIds();

    const currentAuctions: AuctionDetails[] = []

    for (const subAccId of allsubAccIds) {
        console.log('Checking', subAccId);
        // manager, mm, mtm, worstScenario
        const auctionDetails = await getAuctionDetails(subAccId);
        if (auctionDetails.ongoing) {
            currentAuctions.push(auctionDetails)
        }
    }

    console.log(currentAuctions);


    for (const auction of currentAuctions) {
        const portfolioComposition = await getAccountDetails(auction.subAccId);

        const bidPrice = getAuctionBidPrice(auction, portfolioComposition.margin, auctionParams);
        console.log('Checking auction', auction.subAccId);
        console.log("bid price", bidPrice);
        console.log(portfolioComposition)
        printPortfolio(portfolioComposition.portfolio)
    }
}


getAllCurrentAuctions().then(console.log).catch(console.error);
