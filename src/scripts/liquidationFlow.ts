import * as dotenv from "dotenv";
import {ethers} from "ethers";
import {createAccount, depositToNewSubaccount, getLatestSubaccount} from "../utils/exchange/wallets/createAccount";
import {vars} from "../vars";
import {executeWeb3, toBN} from "../utils/web3/utils";
import {approveIfNotApproved} from "../utils/contracts/cash";
import {getAllAddresses} from "../utils/getAddresses";
import {approveSubaccount, createAndGetNewSubaccount, getSubaccountIdFromEvents} from "../utils/contracts/subaccounts";
import * as process from "process";
import {bidOnAccount} from "../utils/contracts/auctions";
import {sleep} from "../utils/misc/time";
import {logger} from "../utils/logger";

dotenv.config();


async function liquidationFlow(accountToBidOn: string, percentage: string, collateralAmount: string, lastTradeId: string) {
    if (!accountToBidOn) {
        console.error("Please specify an account to bid on");
        process.exit(1);
    }
    if (!vars.tradingSubaccount || !vars.biddingSubaccount) {
        throw Error(
          "Please run setupLiquidationAccs first. Must set TRADING_SUBACCOUNT and BIDDING_SUBACCOUNT in .env"
        );
    }


    const addresses = await getAllAddresses();

    // Start with a wallet on L2 that already has some USDC and ETH
    const wallet = new ethers.Wallet(process.env.SIGNING_KEY as string);

    logger.info(`Using ${wallet.address} as executor and signer`);

    // Approve auction utils to use bidding subaccount
    await approveSubaccount(wallet, addresses.auctionUtils, BigInt(vars.biddingSubaccount));

    // Bid on the account (creating a new subaccount)
    const tx = await bidOnAccount(wallet, BigInt(accountToBidOn), BigInt(vars.biddingSubaccount), toBN(percentage), toBN(collateralAmount), BigInt(lastTradeId));
    const newSubAcc = getSubaccountIdFromEvents(tx.logs);

    logger.info(`Created new subaccount from bidding: ${newSubAcc}`);

    // Deposit the new subaccount into the exchange
    await approveSubaccount(wallet, addresses.matching, newSubAcc);
    await executeWeb3(wallet, addresses.matching, 'depositSubAccount(uint256)', [newSubAcc]);

    // Now we wait for the CLOB to detect the new subaccount
    await sleep(10000);

    const subAcc = await getLatestSubaccount(wallet);
    logger.info(`Using subaccount: ${subAcc}`);

    // TODO: Transfer all the assets from this new subaccount into the trading account
    // await transferAll(wallet, subAcc, vars.tradingSubaccount);
    // TODO: Clean up the outstanding subaccount
}

// TODO: add a price limit/more configuration (i.e. merge) for bidding
liquidationFlow(
  // account to bid on
  process.argv[process.argv.length - 4],
  // percentage of account to bid on
  process.argv[process.argv.length - 3],
  // collateral amount to bid with
  process.argv[process.argv.length - 2],
  // last trade id
  process.argv[process.argv.length - 1]
).then().catch(console.error);
