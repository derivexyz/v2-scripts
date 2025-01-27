import { BigNumberish, ethers } from 'ethers';
import { exec, execSync } from 'child_process';
import { vars } from '../../vars';
import { debugTraceLog } from './debugTraceLog';
import { logger } from '../logger';

function execAsync(cmd: string, options: any) {
  return new Promise((resolve, reject) => {
    exec(cmd, options, (error, stdout, stderr) => {
      if (error) {
        console.warn(error);
      }
      resolve(stdout ? stdout : stderr);
    });
  });
}

export async function executeWeb3(
  signer: ethers.BaseWallet,
  contractAddr: string,
  func: string,
  args: any[],
  options?: string,
) {
  if (!options) {
    if (vars.fixedGas != '0') {
      options = ` --gas-limit ${vars.fixedGas} -- --broadcast`;
    } else {
      options = ' -- --broadcast';
    }
  }
  const argsStr = args.map((x) => `"${stringifyForCast(x)}"`).join(' ');
  logger.info(
    `sending from ${signer.address}\n
cast send <...> ${contractAddr} "${func}" ${argsStr.slice(0, 79) + (argsStr.length > 160 ? '[...]"' : '')} ${options}`
  );

  let lastError;
  for (let i = 0; i < 1; i++) {
    try {
      const out = execSync(
        `cast send --json --private-key ${signer.privateKey} --rpc-url ${vars.provider} ${contractAddr} "${func}" ${argsStr} ${options}`,
        { shell: '/bin/bash' },
      );
      return decodeCastOutput(out, func);
    } catch (e) {
      lastError = e;
      logger.debug('Cast send error: ', e);
      const randomDelay = Math.floor(Math.random() * 9000 + 1000); // Random delay between 1-10 seconds
      logger.debug(`Attempt ${i + 1} failed. Retrying in ${randomDelay / 1000} seconds...`);
      await new Promise((resolve) => setTimeout(resolve, randomDelay));
    }
  }

  logger.error('Max retries reached. Giving up.');
  throw new Error(`Error in executeWeb3: ${lastError}`);
}

export async function decodeCastOutput(out: Buffer, funcName: string): Promise<any> {
  const res = JSON.parse(out.toString('utf-8'));

  if (res.status !== '0x1') {
    logger.debug('=== FAILED TRANSACTION ===\n');
    logger.debug(JSON.stringify(res));
    await debugTraceLog(res.transactionHash);
    throw new Error(`Failed to execute command: ${res.error}. Tx hash: ${res.transactionHash}`);
  }
  logger.info(`${funcName} Success. Transaction hash: ${res.transactionHash}`);

  return res;
}

export async function callWeb3(
  signer: ethers.Wallet | null,
  contractAddr: string,
  func: string,
  args: any[],
  types?: any[],
  block?: number,
  retries = 5,
) {
  const PK = signer ? signer.privateKey : '0xbeefbeefbeefbeefbeefbeefbeefbeefbeefbeefbeefbeefbeefbeefbeefbeef';
  const argsStr = args.map((x) => `"${x.toString()}"`).join(' ');
  logger.debug(
    `cast call <...> ${contractAddr} "${func}" ${argsStr.slice(0, 79) + (argsStr.length > 80 ? '[...]"' : '')}  ${block ? `-B ${block}` : ''}`,
  );
  let out: any;
  while (true) {
    try {
      out = await execAsync(
        `cast call --private-key ${PK} --rpc-url ${vars.provider} ${block ? `--block ${block}` : ''} ${contractAddr} "${func}" ${argsStr}`,
        {
          shell: '/bin/bash',
          stdio: [],
        },
      );
      if (out.toString('utf-8').trim().includes('Error')) {
        throw new Error(out.toString('utf-8').trim());
      }
      break;
    } catch (e) {
      retries--;
      if (retries <= 0) {
        logger.error('Max retries reached. Giving up.');
        throw new Error(`Error in callWeb3: ${e}`);
      }
      logger.debug('Cast call error: ', e);
      const randomDelay = Math.floor(Math.random() * 9000 + 1000); // Random delay between 1-10 seconds
      logger.debug(`Retrying in ${randomDelay / 1000} seconds...`);
      await new Promise((resolve) => setTimeout(resolve, randomDelay));
    }
  }

  if (types) {
    const res = ethers.AbiCoder.defaultAbiCoder().decode(types, out.toString('utf-8').trim()).toArray();
    if (res.length === 0) {
      return undefined;
    } else if (res.length === 1) {
      return res[0];
    } else {
      return res;
    }
  } else {
    return out.toString('utf-8').trim();
  }
}


export async function getBlockWeb3(
  blockNumber: number | "latest",
) {
  logger.debug(
    `cast block <...> ${blockNumber}`,
  );
  const out: any = await execAsync(
    `cast block --rpc-url ${vars.provider}  ${blockNumber} --json`,
    {
      shell: '/bin/bash',
      stdio: 'ignore',
    },
  );

  return JSON.parse(out.toString('utf-8').trim());
}


export async function getLogsWeb3(contractAddr: string, eventType: string, fromBlock=0, toBlock: number | "latest" = "latest", filters: any[] = []) {
  // TODO: filters

  logger.debug(
    `cast logs --json --rpc-url ${vars.provider} --address ${contractAddr} --from-block ${fromBlock} --to-block ${toBlock} "${eventType}" ${filters.join(" ")}`,
  );
  let res;
  let retries = 5;
  while (true) {
    try {
      const out: any = await execAsync(
        `cast logs --json --rpc-url ${vars.provider} --address ${contractAddr} --from-block ${fromBlock} --to-block ${toBlock} "${eventType}"`,
        {
          shell: '/bin/bash',
          stdio: 'ignore',
          maxBuffer: 128 * 1024 * 1024, // 128MB
        },
      );

      res = JSON.parse(out.toString('utf-8').trim());
      break
    } catch (e) {
      retries--;
      if (retries <= 0) {
        logger.error('Max retries reached. Giving up.');
        throw new Error(`Error in getLogsWeb3: ${e}`);
      }
      logger.debug('Cast logs error: ', e);
      logger.debug(`Retrying in 1 seconds...`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  const types = eventType
    .split('(')[1]
    .split(')')[0]
    .split(',')
    .map((x) => {
      const split = x.trim().split(' ');
      return {
        name: split[split.length - 1],
        type: split[0],
      };
    });


  if (types) {
    return res.map((x: any) => {

      const eventData = `0x${x.topics.slice(1).map((x: string) => x.slice(2)).join('')}${x.data.slice(2)}`;

      const data = ethers.AbiCoder.defaultAbiCoder()
        .decode(types as any, eventData)
        .toObject();
      return {
        ...x,
        data,
      };
    });
  } else {
    return res;
  }
}

export async function getCalldata(fn: string, args: any[]): Promise<string> {
  const out = await execAsync(
    `cast calldata "${fn}" ${args.map((x) => `"${stringifyForCast(x)}"`).join(' ')}`,
    {
      shell: '/bin/bash',
      stdio: 'ignore',
    },
  ) as any;
  return out.toString('utf-8').trim();
}


export async function deployContract(signer: ethers.Wallet, bytecode: string) {
  const out = execSync(
    `cast send --json --private-key ${signer.privateKey} --rpc-url ${vars.provider} --create ${bytecode}`,
    {
      shell: '/bin/bash',
      stdio: 'ignore',
    },
  );
  const res = JSON.parse(out.toString('utf-8'));
  if (res.status !== '0x1') {
    logger.info(res);
    throw new Error(`Failed to deploy contract: ${res.error}. Tx hash: ${res.transactionHash}`);
  }
  return res.contractAddress;
}

function stringifyForCast(val: any) {
  return JSON.parse(
    JSON.stringify(val, (key, value) => {
      switch (typeof value) {
        case 'bigint':
          return value.toString();
        case 'object': // to handle arrays
          return `(${value.map((x: any) => stringifyForCast(x))})`;
        default:
          return value; // return everything else unchanged
      }
    }),
  );
}
