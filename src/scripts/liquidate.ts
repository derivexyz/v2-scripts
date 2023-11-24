import { Wallet} from "ethers";
import {getAllFeedManagerData} from "./utils/getManagerData";
import {
    AuctionDetails,
    getAllAuctionsubAccIds, getAuctionBidPrice,
    getAuctionDetails,
    getAuctionParams, getSubaccountMargin
} from "../utils/contracts/auctions";
import {loadContractAddresses} from "../utils/getAddresses";
import {getAccountDetails, printPortfolio} from "../utils/contracts/subaccounts";
import * as console from "console";


const SUBMIT_FEED_DATA = true;


async function runLiquidations() {
    const addresses = await loadContractAddresses();

    const pk = '0xbeefbeef00000000000000000000000000000000000000000000000000000000';
    const liquidatorId = 6540;
    const wallet = new Wallet(pk);

    let managerData = "";
    if (SUBMIT_FEED_DATA) {
        managerData = await getAllFeedManagerData();
    }
    // const pk1 = '0x' + Math.random().toString(16).slice(2).padEnd(64, '0');
    // const pk2 = '0x' + Math.random().toString(16).slice(2).padEnd(64, '0');
    //
    // console.log({pk1, pk2})

    // const cashAmount = "100000000";
    // await executeWeb3(ctx.wallet, ctx.addresses.subAccounts, 'createAccountWithApproval(address,address,address)', [ctx.wallet.address, ctx.addresses.auctionUtils, ctx.addresses.srm]);
    // await mintUSDC(ctx, ctx.wallet.address, "100000000");
    // await executeWeb3(ctx.wallet, ctx.addresses.usdc, 'approve(address,uint256)', [ctx.addresses.cash, ethers.parseUnits(cashAmount, 6)]);
    // await executeWeb3(ctx.wallet, ctx.addresses.cash, 'deposit(uint256,uint256)', [liquidatorId, ethers.parseUnits(cashAmount, 6)])

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
        //
        // await executeWeb3(
        //     wallet,
        //     addresses.auctionUtils,
        //     'advancedBid(uint256,uint256,uint256,uint256,int256,uint256,uint256,bool,bytes)',
        //     [
        //         auction.worstScenario,
        //         auction.subAccId,
        //         liquidatorId,
        //         toBN("0.01"),
        //         0,
        //         0,
        //         // collateral amount must be > 0.
        //         // Final balance of liquidator must be > BM * % for solvent, > MM * % for insolvent
        //         // So add enough collateral to cover that + the bid price * %
        //         getBufferMargin(auction, auctionParams),
        //         // Merge the account back into the one liquidating
        //         false,
        //         managerData
        //     ]
        // )
    }
}


runLiquidations().then(console.log).catch(console.error);
