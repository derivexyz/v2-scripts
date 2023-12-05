import {tryRPC} from "./requests";
import {sleep} from "../misc/time";
import console from "console";

export type Status = "requested" | "pending" | "settled" | "reverted" | "ignored";

export async function getSuccessfulTransaction(transaction_id: string, maxRetries = 20) {
    let status;
    for (let i = 0; i < maxRetries; i++) {
        console.log(`Checking transaction status for ${transaction_id}, attempt ${i}/${maxRetries}`);
        await sleep(1000);
        const res = await tryRPC('/public/get_transaction', {
            transaction_id: transaction_id,
        });
        status = res.result.status;
        if (status == "settled" || status == "reverted" || status == "ignored") {
            break;
        }
    }
    if (status == "reverted" || status == "ignored") {
        throw new Error(`Transaction ${transaction_id} reverted or ignored`);
    }
    if (status == "pending" || status == "requested") {
        throw new Error(`Transaction ${transaction_id} is still pending after ${maxRetries * 2}sec`);
    }
}
