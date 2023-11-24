type OptionDetails = {
    isCall: boolean,
    expiry: bigint,
    strike: bigint,
}

export function subIdToOptionDetails(subId: bigint): OptionDetails {
    // expiry = subId & UINT32_MAX;
    // strike = ((subId >> 32) & UINT63_MAX) * 1e10;
    // isCall = (subId >> 95) > 0;

    const expiry = subId & 0xFFFFFFFFn;
    const strike = ((subId >> 32n) & 0x7FFFFFFFFFFFFFFFn) * 10_000_000_000n;
    const isCall = (subId >> 95n) > 0n;

    return {
        expiry,
        strike,
        isCall
    }
}