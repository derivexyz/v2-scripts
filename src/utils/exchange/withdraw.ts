import { ethers } from 'ethers';
import { fromBN } from '../misc/BN';
import { tryRPC } from './requests';
import { PrivateWithdraw } from '../../types/stubs/private.withdraw';
import { SignedAction } from '../contracts/matching/actionSigning';
import { getAllAddresses } from '../getAddresses';
import { getRandomNonce } from '../misc/getRandomNonce';

export async function withdrawFromExchange(wallet: ethers.Wallet, subAccount: bigint, amount: bigint) {
  const addresses = await getAllAddresses();

  const withdrawData = [
    addresses.cash, // Asset address
    amount,
  ];
  const WithdrawalDataABI = ['address', 'uint'];
  const encoder = ethers.AbiCoder.defaultAbiCoder();
  const encodedData = encoder.encode(WithdrawalDataABI, withdrawData);

  const withdrawalAction = new SignedAction(
    Number(subAccount),
    getRandomNonce(),
    Date.now() + 60 * 60,
    wallet,
    wallet.address,
    addresses.withdrawal,
    encodedData,
  );

  await tryRPC<PrivateWithdraw>(
    `private/withdraw`,
    {
      subaccount_id: withdrawalAction.accountId,
      nonce: withdrawalAction.nonce,
      signer: wallet.address,
      amount: fromBN(amount, 6),
      signature: withdrawalAction.signAction(),
      signature_expiry_sec: withdrawalAction.expiry,
      asset_name: 'USDC',
    },
    wallet,
  );
}
