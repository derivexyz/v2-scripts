import { ethers } from 'ethers';
import WebSocket from 'ws';
import { vars } from '../../../vars';
import { sleep } from '../../misc/time';
import { logger } from '../../logger';
import { getLyraAuthMessage } from './headers';
import chalk from 'chalk';

export async function getAuthenticatedWs(wallet: ethers.Wallet) {
  const ws = await connectWs();
  await loginClient(ws, wallet);
  return ws;
}

export async function connectWs(): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(vars.exchangeWsUrl);

    ws.on('open', async () => {
      await sleep(50);
      resolve(ws);
    });

    ws.on('error', (err: Error) => {
      console.log('client caught error:', err);
      reject(err);
    });

    ws.on('close', (code: number, reason: Buffer) => {
      if (code && reason.toString() != '') {
        logger.warn(`WebSocket closed with code: ${code}`);
      }
    });
  });
}

async function loginClient(wsc: WebSocket, wallet: ethers.Wallet, sessionKey?: ethers.BaseWallet) {
  const login_request = JSON.stringify({
    method: 'public/login',
    params: await getLyraAuthMessage(wallet, sessionKey),
    id: Math.round(Math.random() * 10000),
  });

  logger.debug(chalk.blue(`WS.SEND ${wsc.url}/public/login\n${JSON.stringify(login_request)}`));
  wsc.send(login_request);
  // TODO: instead of sleep, listen for response
  await sleep(1000);
}
