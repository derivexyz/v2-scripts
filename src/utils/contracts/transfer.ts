import { getAllAddresses } from '../getAddresses';
import { executeWeb3 } from '../web3/utils';
import { ethers } from 'ethers';
import { getAllFeedManagerData } from '../feeds/getManagerData';

export async function submitTransfer(
  wallet: ethers.Wallet,
  subAccFrom: bigint,
  subAccTo: bigint,
  assetAddr: string,
  amount: bigint,
  subId: bigint,
) {
  const addresses = await getAllAddresses();

  const transfer = {
    fromAcc: subAccFrom,
    toAcc: subAccTo,
    asset: assetAddr,
    subId,
    amount,
    assetData: '0x' + '0'.repeat(64),
  };

  const managerData = await getAllFeedManagerData(false, true, true);

  await executeWeb3(
    wallet,
    addresses.subAccounts,
    'submitTransfer((uint256,uint256,address,uint256,int256,bytes32),bytes)',
    [
      [transfer.fromAcc, transfer.toAcc, transfer.asset, transfer.subId, transfer.amount, transfer.assetData],
      managerData,
    ],
  );
}
