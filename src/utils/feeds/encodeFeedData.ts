import * as ethers from 'ethers';
import { toBN } from '../misc/BN';

const abiCoder = new ethers.AbiCoder();

////////////
// Shared //
////////////

export function encodeBaseFeedData(data: any, dataBytes: any): string {
  return abiCoder.encode(
    ['tuple(bytes,uint256,uint64,address[],bytes[])'],
    [[dataBytes, data.deadline, data.timestamp, data.signatures.signers, data.signatures.signatures]],
  );
}

export function encodeSpotData(data: any): string {
  return encodeBaseFeedData(data, abiCoder.encode(['uint96', 'uint64'], [toBN(data.price), toBN(data.confidence)]));
}

export function encodeForwardData(data: any): string {
  return encodeBaseFeedData(
    data,
    abiCoder.encode(
      ['uint64', 'uint', 'uint', 'int96', 'uint64'],
      [
        data.expiry,
        toBN(data.spot_aggregate_start),
        toBN(data.spot_aggregate_latest),
        toBN(data.fwd_diff),
        toBN(data.confidence),
      ],
    ),
  );
}

export function encodeVolData(data: any): string {
  return encodeBaseFeedData(
    data,
    abiCoder.encode(
      ['uint64', 'int', 'uint', 'int', 'int', 'uint', 'uint', 'uint64', 'uint64'],
      [
        data.expiry,
        toBN(data.vol_data.SVI_a),
        toBN(data.vol_data.SVI_b),
        toBN(data.vol_data.SVI_rho),
        toBN(data.vol_data.SVI_m),
        toBN(data.vol_data.SVI_sigma),
        toBN(data.vol_data.SVI_fwd),
        toBN(data.vol_data.SVI_refTau),
        toBN(data.confidence),
      ],
    ),
  );
}

export function encodePerpData(data: any): string {
  return encodeBaseFeedData(
    data,
    abiCoder.encode(['int96', 'uint64'], [toBN(data.spot_diff_value), toBN(data.confidence)]),
  );
}

export function encodeManagerData(data: any): string {
  return abiCoder.encode(['(address,bytes)[]'], [data]);
}
