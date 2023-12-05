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

dotenv.config();


async function setupLiquidationAccs(tradingDepositAmt: string, biddingDepositAmt: string) {
    const addresses = await getAllAddresses();

    // Start with a wallet on L2 that already has some USDC and ETH
    const wallet = new ethers.Wallet(process.env.SIGNING_KEY as string);

    console.log(`Using ${wallet.address} as executor and signer`);

    // create an exchange account
    await createAccount(wallet);

    // Create a subaccount on the exchange, depositing into it
    if (!vars.tradingSubaccount) {
        await approveIfNotApproved(wallet, addresses.usdc, addresses.deposit, toBN(tradingDepositAmt, 6));
        // create subaccount
        // deposit to subaccount
        await depositToNewSubaccount(wallet, toBN(tradingDepositAmt, 6));
        vars.tradingSubaccount = await getLatestSubaccount(wallet);
        console.log(`Created trading subaccount: ${vars.tradingSubaccount}`);
    } else {
        console.log(`Using existing trading subaccount: ${vars.tradingSubaccount}`);
        // TODO: deposit into this subaccount
    }

    // Create a new subaccount on the base layer - this is the liquidation wallet
    if (!vars.biddingSubaccount) {

        // create subaccount
        vars.biddingSubaccount = await createAndGetNewSubaccount(wallet, 'SM');
        console.log(`Created bidding subaccount: ${vars.biddingSubaccount}`);
    } else {
        console.log(`Using existing bidding subaccount: ${vars.biddingSubaccount}`);
    }

    const depositBn = toBN(biddingDepositAmt, 6);
    if (depositBn > 0n) {
        await approveIfNotApproved(wallet, addresses.usdc, addresses.cash, toBN(biddingDepositAmt, 6));
        await executeWeb3(wallet, addresses.cash, 'deposit(uint256,uint256)', [vars.biddingSubaccount, toBN(biddingDepositAmt, 6)]);
    }

    console.log(`Trading subaccount: ${vars.tradingSubaccount}`);
    console.log(`Bidding subaccount: ${vars.biddingSubaccount}`);
}

setupLiquidationAccs(process.argv[process.argv.length - 2], process.argv[process.argv.length - 2])
  .then(console.log)
  .catch(console.error);
