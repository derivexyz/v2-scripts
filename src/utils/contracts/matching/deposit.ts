import {ethers} from "ethers";
import {getAllAddresses} from "../../getAddresses";
import {SignedAction} from "./actionSigning";
import {getRandomNonce} from "../../utils/getRandomNonce";
import {getCurrency, getManagerAddress, ManagerType, MarginType} from "../../types/managers";
import {timeSeconds} from "../../utils/time";


export async function constructAndSignDeposit(
    wallet: ethers.Wallet,
    amount: bigint,
    manager: ManagerType = 'SM',
    signer?: ethers.BaseWallet,
    subaccount_id?: number,
): Promise<SignedAction> {
    const addresses = await getAllAddresses();

    const encoder = ethers.AbiCoder.defaultAbiCoder();
    const signature_expiry = timeSeconds() + 600; // 10 min for safety
    const nonce = getRandomNonce();

    const depositData = [
        amount.toString(),
        addresses.cash, // Asset address
        await getManagerAddress(manager), // Manager address
    ];
    console.log({amount: amount.toString()});

    const DepositDataABI = ['uint256', 'address', 'address'];
    const encodedData = encoder.encode(DepositDataABI, depositData);

    const deposit_order = new SignedAction(
        subaccount_id ? subaccount_id : 0, // subaccount_id
        nonce, // nonce
        signature_expiry, // signature_expiry_sec
        wallet, // owner
        signer ? signer.address : wallet.address, // signer
        addresses.deposit, // module
        encodedData, // data
    );

    await deposit_order.sign(signer ? signer : wallet);

    return deposit_order;
}
