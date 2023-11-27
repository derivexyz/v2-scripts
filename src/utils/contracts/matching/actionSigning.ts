import { ethers } from 'ethers';

export class SignedAction {
    accountId: number;
    nonce: number;
    module: string;
    expiry: number;
    owner: ethers.Wallet;
    signer: string;
    data: string;
    signature: string;

    constructor(
        subaccount_id: number,
        nonce: number,
        signature_expiry_sec: number,
        owner: ethers.Wallet,
        signer: string,
        module: string,
        data: string,
    ) {
        this.accountId = subaccount_id;
        this.nonce = nonce;
        this.module = module;
        this.expiry = signature_expiry_sec;
        this.owner = owner;
        this.signer = signer;
        this.data = data;
        this.signature = '0x';
    }

    async sign(wallet?: ethers.BaseWallet): Promise<void> {
        this.signature = this.signAction(wallet);
    }

    // NOTE: if signing with a different signer than this.signer,
    // make sure to change this.signer to wallet? before calling this function
    public signAction(wallet?: ethers.BaseWallet): string {
        const signer = wallet ? wallet : this.owner;
        const encodedDataHashed: string = this.getActionHash(this.module);
        const typedDataHash = SignedAction.toTypedDataHash(encodedDataHashed);
        return signer.signingKey.sign(typedDataHash).serialized;
    }

    private getActionHash(matchingModuleAddress: string): string {
        const encoder = ethers.AbiCoder.defaultAbiCoder();

        return ethers.keccak256(
            encoder.encode(
                ['bytes32', 'uint256', 'uint256', 'address', 'bytes32', 'uint256', 'address', 'address'],
                [
                    process.env.ACTION_TYPEHASH,
                    this.accountId,
                    this.nonce,
                    matchingModuleAddress,
                    ethers.keccak256(Buffer.from(this.data.slice(2), 'hex')),
                    this.expiry,
                    this.owner.address,
                    this.signer,
                ],
            ),
        );
    }

    public static toTypedDataHash(actionHash: string) {
        return ethers.keccak256(
            Buffer.concat([
                Buffer.from('1901', 'hex'),
                Buffer.from(SignedAction.domainSeparator().slice(2), 'hex'),
                Buffer.from(actionHash.slice(2), 'hex'),
            ]),
        );
    }

    public static domainSeparator(): string {
        if (!process.env.DOMAIN_SEPARATOR) {
            throw Error('DOMAIN_SEPARATOR env variable not set');
        }
        return process.env.DOMAIN_SEPARATOR;
    }
}

