import axios from "axios";
import { getAllAddresses} from "../utils/getAddresses";
import {timeSeconds} from "../utils/misc/time";
import {executeWeb3, toBN} from "../utils/web3/utils";
import {ethers} from "ethers";
import {vars} from "../vars";
import {encodeBaseFeedData} from "../utils/feeds/encodeFeedData";


const abiCoder = new ethers.AbiCoder();

export function encodeForwardData(data: any): string {
  console.log(data);
  return encodeBaseFeedData(
    data,
    abiCoder.encode(
      ['uint64', 'uint', 'uint', 'int96', 'uint64'],
      [
        data.data.expiry,
        data.data.settlementStartAggregate,
        data.data.currentSpotAggregate,
        data.data.fwdSpotDifference,
        data.data.confidence,
      ],
    ),
  );
}

async function submitExpiryData(currency: string, expiry: number) {
  const addresses = await getAllAddresses()

  // Start with a wallet on L2 that already has some USDC and ETH
  const wallet = new ethers.Wallet(vars.signingKey);

  console.log(`Using ${wallet.address} as executor and signer`);

  const now = timeSeconds();
  const res = await axios.get(`http://103.4.9.137:12345/expiry-data?expiry=${expiry}&currency=${currency}`);

  console.log(res);
  const data = res.data;

  if (data.deadline < now) {
    console.warn(`Fwd feed expiry: ${expiry} is expired`);
    return;
  }

  const dataToSign = {
    ...data,
    signatures: {
      signers: [data.signers[1]],
      signatures: [data.signatures[1]],
    }
  }

  const encodedData = encodeForwardData(dataToSign);

  await executeWeb3(wallet as any, addresses.markets[currency].forwardFeed, 'acceptData(bytes)', [encodedData]);
}

submitExpiryData(process.argv[2], parseInt(process.argv[3])).then(console.log).catch(console.error);
