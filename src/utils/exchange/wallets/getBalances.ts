import {ethers} from "ethers";
import {tryRPC} from "../requests";
import {PrivateGetSubaccount} from "../../../types/stubs/private.get_subaccount";
import {isRPCError} from "../../../types/rpc";

export async function getAllBalances(wallet: ethers.Wallet, subAcc: bigint) {
  const result = await tryRPC<PrivateGetSubaccount>(
    `private/get_subaccount`,
    {
      subaccount_id: Number(subAcc),
    },
    wallet
  )

  if (isRPCError(result)) {
    throw `Failed to get subaccount ${subAcc} balances: ${JSON.stringify(result.error)}`;
  }

  return result;
}