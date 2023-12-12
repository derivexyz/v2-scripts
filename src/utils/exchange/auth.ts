import { tryRequest } from './requests';
import { ethers } from 'ethers';

import { assert } from 'console';

export interface LyraAuthHeader {
  [key: string]: string;
  'X-LyraWallet': string;
  'X-LyraTimestamp': string;
  'X-LyraSignature': string;
}

export async function getLyraAuthHeader(
  wallet: ethers.BaseWallet,
  signer?: ethers.BaseWallet,
): Promise<LyraAuthHeader> {
  const timestamp = Date.now().toString();
  const signature = signer
    ? (await signer.signMessage(timestamp)).toString()
    : (await wallet.signMessage(timestamp)).toString();

  return {
    'X-LyraWallet': wallet.address,
    'X-LyraTimestamp': timestamp,
    'X-LyraSignature': signature,
  };
}

export interface LyraAuthMessage {
  [key: string]: string;
  wallet: string;
  timestamp: string;
  signature: string;
}

export async function getLyraAuthMessage(
  wallet: ethers.BaseWallet,
  signer?: ethers.BaseWallet,
): Promise<LyraAuthMessage> {
  const header = await getLyraAuthHeader(wallet, signer);
  return {
    wallet: header['X-LyraWallet'],
    timestamp: header['X-LyraTimestamp'],
    signature: header['X-LyraSignature'],
  };
}
