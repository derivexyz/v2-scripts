import { ethers, ZeroAddress } from 'ethers';
import { fromBN } from '../misc/BN';
import { tryRPC } from './requests';
import { PrivateWithdraw } from '../../types/stubs/private.withdraw';
import { SignedAction } from '../contracts/matching/actionSigning';
import { getAllAddresses } from '../getAddresses';
import { getRandomNonce } from '../misc/getRandomNonce';
import { PrivateDeposit } from '../../types/stubs/private.deposit';
import { constructAndSignDeposit } from '../contracts/matching/deposit';

export async function depositToExchange(wallet: ethers.Wallet, subAccount: bigint, amount: bigint) {
  const addresses = await getAllAddresses();

  const depositAction = await constructAndSignDeposit(wallet, amount, 'SM', wallet, Number(subAccount));

  await tryRPC<PrivateDeposit>(
    `private/deposit`,
    {
      subaccount_id: depositAction.accountId,
      nonce: depositAction.nonce,
      signer: wallet.address,
      amount: fromBN(amount, 6),
      signature: depositAction.signAction(),
      signature_expiry_sec: depositAction.expiry,
      asset_name: 'USDC',
    },
    wallet,
  );
}
