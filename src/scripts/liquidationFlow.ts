import * as dotenv from "dotenv";
import {ethers} from "ethers";
import {createAccount, depositToNewSubaccount, getLatestSubaccount} from "../utils/exchange/createAccount";
import {assert} from "console";
import {vars} from "../vars";
import {executeWeb3, toBN} from "../utils/web3/utils";
import {approveIfNotApproved} from "../utils/contracts/cash";
import {getAllAddresses} from "../utils/getAddresses";
import {approveSubaccount, createAndGetNewSubaccount, getSubaccountIdFromEvents} from "../utils/contracts/subaccounts";
import * as process from "process";
import {bidOnAccount} from "../utils/contracts/auctions";
import {sleep} from "../utils/utils/time";

dotenv.config();


async function liquidationFlow(accountToBidOn: string) {
    if (!accountToBidOn) {
        console.error("Please specify an account to bid on");
        process.exit(1);
    }

    const addresses = await getAllAddresses();

    // Start with a wallet on L2 that already has some USDC and ETH
    const wallet = new ethers.Wallet(process.env.SIGNING_KEY as string);

    console.log(`Using ${wallet.address} as executor and signer`);

    await approveIfNotApproved(wallet, addresses.usdc, addresses.deposit, toBN("200000", 6));
    await approveIfNotApproved(wallet, addresses.usdc, addresses.deposit, toBN("200000", 6));

    // Create an account on the exchange, depositing into it
    await createAccount(wallet);
    if (!vars.tradingSubaccount) {
        // create subaccount
        // deposit to subaccount
        await depositToNewSubaccount(wallet, toBN("1000", 6));
        vars.tradingSubaccount = await getLatestSubaccount(wallet);
    }

    // Create a new subaccount on the base layer - this is the liquidation wallet
    if (!vars.biddingSubaccount) {
        // create subaccount
        // deposit to subaccount
        vars.biddingSubaccount = await createAndGetNewSubaccount(wallet, 'SM');
    }

    // Approve auction utils to use bidding subaccount
    await approveSubaccount(wallet, addresses.auctionUtils, BigInt(vars.biddingSubaccount));

    // Bid on the account (creating a new subaccount)
    const tx = await bidOnAccount(wallet, BigInt(accountToBidOn), BigInt(vars.biddingSubaccount), toBN("0.01"));
    const newSubAcc = getSubaccountIdFromEvents(tx.logs);

    // Deposit the new subaccount into the exchange
    await approveSubaccount(wallet, addresses.matching, newSubAcc);
    await executeWeb3(wallet, addresses.matching, 'depositSubAccount(uint256)', [newSubAcc]);

    // Now we wait for the CLOB to detect the new subaccount
    await sleep(10000);

    // TODO: Transfer all the assets from this new subaccount into the trading account
    // TODO: Clean up the outstanding subaccount
}

liquidationFlow(process.argv[2]).then(console.log).catch(console.error);
