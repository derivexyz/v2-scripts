import {getAllAddresses} from "../getAddresses";
import {ethers} from "ethers";
import {callWeb3, executeWeb3} from "../web3/utils";
import {logger} from "../logger";


export async function approveIfNotApproved(wallet: ethers.Wallet, tokenContract: string, approvedAddr: string, checkAmount: bigint, approveAmount: bigint = BigInt(2) ** BigInt(256) - BigInt(1)) {
    const currentAllowance: bigint = await callWeb3(null, tokenContract, "allowance(address,address)", [wallet.address, approvedAddr], ["uint"]);

    logger.debug(`currentAllowance: ${currentAllowance}`)

    if (currentAllowance >= checkAmount) {
        return;
    }

    await executeWeb3(wallet, tokenContract, "approve(address,uint)", [approvedAddr, approveAmount]);
}