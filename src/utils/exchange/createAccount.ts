import {ethers} from "ethers";
import {tryRequest, tryRPC, tryRPCWithRetry} from "./requests";
import {assert} from "console";
import {constructAndSignDeposit} from "../contracts/matching/deposit";
import {getCurrency, getMarginType, ManagerType, MarginType} from "../types/managers";
import {getSuccessfulTransaction} from "./transactions";
import {isRPCError} from "../types/rpc";
import {fromBN} from "../web3/utils";

export async function createAccount(wallet: ethers.Wallet | string) {
    if (wallet instanceof ethers.Wallet) {
        wallet = wallet.address;
    }

    const res = await tryRequest('POST', `/public/create_account`, {
        wallet: wallet,
    });

    assert(res.response.status == 200);
    console.debug(res.response.data.result);

    return res.response.data;
}

export async function depositToNewSubaccount(wallet: ethers.Wallet, amount: bigint, manager: ManagerType = 'SM'){
    const deposit_order = await constructAndSignDeposit(wallet, amount, manager);
    const res = await tryRPCWithRetry(
        `private/create_subaccount`,
        {
            margin_type: getMarginType(manager),
            wallet: deposit_order.owner.address,
            signer: deposit_order.signer,
            nonce: deposit_order.nonce,
            amount: fromBN(amount.toString(), 6),
            signature: deposit_order.signature,
            signature_expiry_sec: deposit_order.expiry,
            asset_name: 'USDC',
            currency: manager == 'SM' ? undefined : getCurrency(manager),
        },
        wallet,
        3,
    );

    await getSuccessfulTransaction(res.result.transaction_id);

    return res.result;
}

export async function getLatestSubaccount(wallet: ethers.Wallet): Promise<bigint> {

    const subaccountsResponse = await tryRPC(
        `private/get_subaccounts`,
        { wallet: wallet.address },
        wallet,
        false,
    );

    if (isRPCError(subaccountsResponse)) {
        throw `Failed to get subaccounts during subaccount creation: ${JSON.stringify(subaccountsResponse.error)}`;
    }

    const subaccounts = subaccountsResponse.result.subaccount_ids;

    return BigInt(Math.max(...subaccounts.map(Number)));
}