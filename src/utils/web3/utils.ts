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
  logger.debug(
    `sending from ${signer.address}\n`,
    `cast send <...> ${contractAddr} "${func}" ${
      argsStr.slice(0, 149) + (argsStr.length > 150 ? '[...]"' : '')
    } ${options}`,
  );

  let lastError;
  for (let i = 0; i < 1; i++) {
    try {
      const out = execSync(
        `cast send -j --private-key ${signer.privateKey} --rpc-url ${vars.provider} ${contractAddr} "${func}" ${argsStr} ${options}`,
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
) {
  const PK = signer ? signer.privateKey : '0xbeefbeefbeefbeefbeefbeefbeefbeefbeefbeefbeefbeefbeefbeefbeefbeef';
  const argsStr = args.map((x) => `"${x.toString()}"`).join(' ');
  logger.debug(
    `cast call <...> ${contractAddr} "${func}" ${argsStr.slice(0, 79) + (argsStr.length > 80 ? '[...]"' : '')}`,
  );
  const out: any = await execAsync(
    `cast call --private-key ${PK} --rpc-url ${vars.provider} ${contractAddr} "${func}" ${argsStr}`,
    {
      shell: '/bin/bash',
    },
  );
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

export async function getLogsWeb3(contractAddr: string, eventType: string) {
  // TODO: filters

  logger.debug(
    `cast logs -j --rpc-url ${vars.provider} --address ${contractAddr} --from-block 0 --to-block latest "${eventType}"`,
  );
  const out: any = await execAsync(
    `cast logs -j --rpc-url ${vars.provider} --address ${contractAddr} --from-block 0 --to-block latest "${eventType}"`,
    {
      shell: '/bin/bash',
      maxBuffer: 128 * 1024 * 1024, // 128MB
    },
  );

  const res = JSON.parse(out.toString('utf-8').trim());

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
      const data = ethers.AbiCoder.defaultAbiCoder()
        .decode(types as any, x.data)
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

export async function deployContract(signer: ethers.Wallet, bytecode: string) {
  const out = execSync(
    `cast send -j --private-key ${signer.privateKey} --rpc-url ${vars.provider} --create ${bytecode}`,
    {
      shell: '/bin/bash',
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
