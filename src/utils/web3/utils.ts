import { BigNumberish, ethers } from 'ethers';
import { exec, execSync } from 'child_process';
import {vars} from "../../vars";
import {debugTraceLog} from "../debugTraceLog";


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

// allow for decimals to be passed in up to 9dp of precision
export function toBN(val: string, decimals?: number): string {
    decimals = decimals ?? 18;
    // multiplier is to handle decimals
    if (val.includes('e')) {
        if (parseFloat(val) > 1) {
            const x = val.split('.');
            const y = x[1].split('e+');
            const exponent = parseFloat(y[1]);
            const newVal = x[0] + y[0] + '0'.repeat(exponent - y[0].length);
            console.warn(`Warning: toBN of val with exponent, converting to string. (${val}) converted to (${newVal})`);
            val = newVal;
        } else {
            console.warn(
                `Warning: toBN of val with exponent, converting to float. (${val}) converted to (${parseFloat(val).toFixed(
                    decimals,
                )})`,
            );
            val = parseFloat(val).toFixed(decimals);
        }
    } else if (val.includes('E')) {
        // e.g. "1E-8"
        val = parseFloat(val).toFixed(decimals);
    } else if (val.includes('.') && val.split('.')[1].length > decimals) {
        console.warn(`Warning: toBN of val with more than ${decimals} decimals. Stripping excess. (${val})`);
        const x = val.split('.');
        x[1] = x[1].slice(0, decimals);
        val = x[0] + '.' + x[1];
    }
    return ethers.parseUnits(val, decimals).toString();
}

export function fromBN(val: BigNumberish, dec?: number): string {
    return ethers.formatUnits(val, dec ?? 18);
}

export async function executeWeb3(
    signer: ethers.BaseWallet,
    contractAddr: string,
    func: string,
    args: any[],
    options = '--gas-limit 15000000 -- --broadcast',
) {
    const argsStr = args.map((x) => `"${x.toString()}"`).join(' ');
    console.log(
        `sending from ${signer.address}\n`,
        `cast send <...> ${contractAddr} "${func}" ${
            argsStr.slice(0, 149) + (argsStr.length > 150 ? '[...]"' : '')
        } ${options}`,
    );

    let res;
    let lastError;
    for (let i = 0; i < 3; i++) {
        try {
            const out = execSync(
                `cast send -j --private-key ${signer.privateKey} --rpc-url ${vars.provider} ${contractAddr} "${func}" ${argsStr} ${options}`,
                { shell: '/bin/bash' },
            );
            return decodeCastOutput(out, func);
        } catch (e) {
            lastError = e;
            console.log('Cast send error: ', e);
            const randomDelay = Math.floor(Math.random() * 9000 + 1000); // Random delay between 1-10 seconds
            console.log(`Attempt ${i + 1} failed. Retrying in ${randomDelay / 1000} seconds...`);
            await new Promise((resolve) => setTimeout(resolve, randomDelay));
        }
    }

    console.error('Max retries reached. Giving up.');
    throw new Error(`Error in executeWeb3: ${lastError}`);
}

export function decodeCastOutput(out: Buffer, funcName: string): Promise<string> {
    const res = JSON.parse(out.toString('utf-8'));

    if (res.status !== '0x1') {
        console.log('==========================');
        console.log('=== FAILED TRANSACTION ===');
        console.log('==========================\n');
        console.log(res);
        debugTraceLog(res.transactionHash);
        throw new Error(`Failed to execute command: ${res.error}. Tx hash: ${res.transactionHash}`);
    }
    console.log(`${funcName} Success. Transaction hash: ${res.transactionHash}`);

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
    console.log(
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

    console.log(
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
    const out = execSync(`cast send -j --private-key ${signer.privateKey} --rpc-url ${vars.provider} --create ${bytecode}`, {
        shell: '/bin/bash',
    });
    const res = JSON.parse(out.toString('utf-8'));
    if (res.status !== '0x1') {
        console.log(res);
        throw new Error(`Failed to deploy contract: ${res.error}. Tx hash: ${res.transactionHash}`);
    }
    return res.contractAddress;
}
