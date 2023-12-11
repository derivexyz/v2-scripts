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


async function setupLiquidationAccs(tradingDepositAmt: string, biddingDepositAmt: string) {
    const addresses = await getAllAddresses();

    // Start with a wallet on L2 that already has some USDC and ETH
    const wallet = new ethers.Wallet(process.env.SIGNING_KEY as string);

    logger.info(`Using ${wallet.address} as executor and signer`);

    // create an exchange account
    await createAccount(wallet);

    // Create a subaccount on the exchange, depositing into it
    if (!vars.tradingSubaccount) {
        await approveIfNotApproved(wallet, addresses.usdc, addresses.deposit, toBN(tradingDepositAmt, 6));
        // create subaccount
        // deposit to subaccount
        await depositToNewSubaccount(wallet, toBN(tradingDepositAmt, 6));
        vars.tradingSubaccount = await getLatestSubaccount(wallet);
        logger.info(`Created trading subaccount: ${vars.tradingSubaccount}`);
    } else {
        logger.info(`Using existing trading subaccount: ${vars.tradingSubaccount}`);
        logger.warn(`Not depositing into trading subaccount, not implemented`)
        // TODO: deposit into this subaccount
    }

    // Create a new subaccount on the base layer - this is the liquidation wallet
    if (!vars.biddingSubaccount) {

        // create subaccount
        vars.biddingSubaccount = await createAndGetNewSubaccount(wallet, 'SM');
        logger.info(`Created bidding subaccount: ${vars.biddingSubaccount}`);
    } else {
        logger.info(`Using existing bidding subaccount: ${vars.biddingSubaccount}`);
    }

    const depositBn = toBN(biddingDepositAmt, 6);
    if (depositBn > 0n) {
        await approveIfNotApproved(wallet, addresses.usdc, addresses.cash, toBN(biddingDepositAmt, 6));
        await executeWeb3(wallet, addresses.cash, 'deposit(uint256,uint256)', [vars.biddingSubaccount, toBN(biddingDepositAmt, 6)]);
    }

    logger.info(`Trading subaccount: ${vars.tradingSubaccount}`);
    logger.info(`Bidding subaccount: ${vars.biddingSubaccount}`);
}

setupLiquidationAccs(process.argv[process.argv.length - 2], process.argv[process.argv.length - 2])
  .then()
  .catch(console.error);
