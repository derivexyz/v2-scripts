import axios from "axios";
import { getAllAddresses} from "../utils/getAddresses";
import {timeSeconds} from "../utils/misc/time";
import {executeWeb3, toBN} from "../utils/web3/utils";
import {ethers} from "ethers";
import {vars} from "../vars";
import {
  encodeBaseFeedData,
  encodeForwardData,
  encodePerpData,
  encodeSpotData,
  encodeVolData
} from "../utils/feeds/encodeFeedData";
import {logger} from "../utils/logger";
import {mergeDeep} from "../utils/misc/deepMerge";


const abiCoder = new ethers.AbiCoder();


async function submitAllFeedData() {
  // TODO: forward/vol data
  // TODO: encode into manager data for a single executeWeb3 call

  const addresses = await getAllAddresses()

  // Start with a wallet on L2 that already has some USDC and ETH
  const wallet = new ethers.Wallet(vars.signingKey);

  logger.info(`Using ${wallet.address} as executor`);

  const data: any = {};

  for (const i of ["ETH", "BTC", ""]) {

    const res = await axios.get(`${vars.exchangeUrl}/public/get_latest_signed_feeds?currency=${i}`);
    mergeDeep(data, res.data.result);
  }

  const allData = [];
  const now = timeSeconds();

  for (const i of Object.keys(data.perp_data)) {
    for (const perpType of Object.keys(data.perp_data[i])) {
      const encodedData = encodePerpData(data.perp_data[i][perpType])
      if (perpType === "P") {
        allData.push([addresses.markets[i].perpFeed, encodedData]);
      } else if (perpType === "B") {
        allData.push([addresses.markets[i].ibpFeed, encodedData]);
      } else {
        allData.push([addresses.markets[i].iapFeed, encodedData]);
      }
    }
  }

  for (const i of Object.keys(data.spot_data)) {
    if (i === "USDC") {
      allData.push([addresses.stableFeed, encodeSpotData(data.spot_data["USDC"])]);
    } else {
      allData.push([addresses.markets[i].spotFeed, encodeSpotData(data.spot_data[i])]);
    }
  }

  for (const i of Object.keys(data.fwd_data)) {
    for (const expiry of Object.keys(data.fwd_data[i])) {
      if (+expiry < now) {
          continue;
      }
      allData.push([addresses.markets[i].forwardFeed, encodeForwardData(data.fwd_data[i][expiry])]);
    }
  }

  for (const i of Object.keys(data.vol_data)) {
    for (const expiry of Object.keys(data.vol_data[i])) {
      if (+expiry < now) {
        continue;
      }
      allData.push([addresses.markets[i].volFeed, encodeVolData(data.vol_data[i][expiry])]);
    }
  }

  logger.debug(allData);

  const managerData = abiCoder.encode(["(address,bytes)[]"], [allData]);
  await executeWeb3(wallet, addresses.dataSubmitter, "submitData(bytes)", [managerData]);
}

submitAllFeedData().then(console.log).catch(console.error);
