type OptionDetails = {
  isCall: boolean;
  expiry: bigint;
  strike: bigint;
};

export function subIdToOptionDetails(subId: bigint): OptionDetails {
  // expiry = subId & UINT32_MAX;
  // strike = ((subId >> 32) & UINT63_MAX) * 1e10;
  // isCall = (subId >> 95) > 0;

  const expiry = subId & 0xffffffffn;
  const strike = ((subId >> 32n) & 0x7fffffffffffffffn) * 10_000_000_000n;
  const isCall = subId >> 95n > 0n;

  return {
    expiry,
    strike,
    isCall,
  };
}

export function optionDetailsToSubId(optionDetails: OptionDetails): bigint {
  // return (isCall ? 1n : 0n) << 95n | strike / 1e10 << 32n | expiry;
  return (
    ((optionDetails.isCall ? 1n : 0n) << 95n) | ((optionDetails.strike / 10_000_000_000n) << 32n) | optionDetails.expiry
  );
}
