import * as console from "console";

async function fullLiquidationFlow() {
    // Start with a wallet on L2 that has some USDC and ETH
    // Create an account on the exchange
    // Deposit to the clob account - this is the trading account
    // Create a new subaccount on the base layer - this is the liquidation wallet
    // Approve auction utils to spend USDC
    // Create a liquidatable account
    // Bid on the account (creating a new subaccount)
    // Deposit the new subaccount into the exchange
    // Transfer all the assets from this new subaccount into the trading account
    // Clean up the outstanding subaccount
    throw new Error("Not implemented");
}

fullLiquidationFlow().then(console.log).catch(console.error);
