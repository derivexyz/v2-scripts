import {ethers} from "ethers";
import {approveSubaccount, createAndGetNewSubaccount} from "../utils/contracts/subaccounts";
import {approveIfNotApproved} from "../utils/contracts/cash";
import {getAllAddresses} from "../utils/getAddresses";
import {executeWeb3, toBN} from "../utils/web3/utils";
import {submitTransfer} from "../utils/contracts/transfer";
import {logger} from "../utils/logger";


async function mintAccountsAndTradePerps() {
    const addresses = await getAllAddresses();

    // Note: assumes these two wallets have been funded with USDC and ETH
    const wallet1 = new ethers.Wallet('0x' + "c0ffee".padEnd(64, '0'));
    const wallet2 = new ethers.Wallet('0x' + "c1ffee".padEnd(64, '0'));
    logger.info(`Creating a perp trade between ${wallet1.address} and ${wallet2.address}`);

    // get subaccounts ready for trading
    const subAcc1 = await prepareAccount(wallet1, toBN("100", 6));
    const subAcc2 = await prepareAccount(wallet2, toBN("100", 6));

    // have them trade perps against each other
    // Wallet 1 approves wallet 2 to trade on its behalf (meaning all funds can be taken by wallet 2)
    await approveSubaccount(wallet1, wallet2.address, subAcc1);

    // Wallet 2 transfers perps from subaccount 2 to subaccount 1
    // Theres ~15x leverage, so with $100, max trade size is 1500/2000 = ~0.75
    await submitTransfer(wallet2, subAcc2, subAcc1, addresses.markets["ETH"].perp, toBN("0.7", 18), BigInt(0));
}


async function prepareAccount(wallet: ethers.Wallet, collateralAmount: bigint) {
    const addresses = await getAllAddresses();

    // create subaccount
    const subAcc = await createAndGetNewSubaccount(wallet, 'SM');

    // deposit cash for collateral
    await approveIfNotApproved(wallet, addresses.usdc, addresses.cash, collateralAmount);
    await executeWeb3(wallet, addresses.cash, 'deposit(uint256,uint256)', [subAcc, collateralAmount])

    return subAcc;
}

mintAccountsAndTradePerps().then().catch(console.error);
