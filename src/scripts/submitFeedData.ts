import axios from "axios";
import { getAllAddresses} from "../utils/getAddresses";
import {timeSeconds} from "../utils/misc/time";
import {executeWeb3} from "../utils/web3/utils";
import {ethers} from "ethers";
import {vars} from "../vars";
import {
  encodeForwardData,
  encodePerpData,
  encodeSpotData,
  encodeVolData
} from "../utils/feeds/encodeFeedData";
import {logger} from "../utils/logger";
import {mergeDeep} from "../utils/misc/deepMerge";
import {Command} from "commander";


const abiCoder = new ethers.AbiCoder();


async function submitAllFeedData(options: any) {
  let currencies = ["ETH", "BTC", "USDC"];
  if (!options.all && options.currencies) {
    currencies = options.currencies.split(",");
  }

  const addresses = await getAllAddresses()

  // Start with a wallet on L2 that already has some USDC and ETH
  const wallet = new ethers.Wallet(vars.signingKey);

  logger.info(`Using ${wallet.address} as executor`);

  const data: any = {};

  for (const i of currencies) {

    const res = await axios.get(`${vars.exchangeUrl}/public/get_latest_signed_feeds?currency=${i}`);
    mergeDeep(data, res.data.result);
  }

  const allData = [];
  const now = timeSeconds();

  if (options.all || options.perp) {
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
  }

  if (options.all || options.spot) {
    for (const i of Object.keys(data.spot_data)) {
      if (i === "USDC") {
        allData.push([addresses.stableFeed, encodeSpotData(data.spot_data["USDC"])]);
      } else {
        allData.push([addresses.markets[i].spotFeed, encodeSpotData(data.spot_data[i])]);
      }
    }
  }

  if (options.all || options.forward) {
    for (const i of Object.keys(data.fwd_data)) {
      for (const expiry of Object.keys(data.fwd_data[i])) {
        if (+expiry < now) {
          continue;
        }
        allData.push([addresses.markets[i].forwardFeed, encodeForwardData(data.fwd_data[i][expiry])]);
      }
    }
  }

  if (options.all || options.vol) {
    for (const i of Object.keys(data.vol_data)) {
      for (const expiry of Object.keys(data.vol_data[i])) {
        if (+expiry < now) {
          continue;
        }
        allData.push([addresses.markets[i].volFeed, encodeVolData(data.vol_data[i][expiry])]);
      }
    }
  }

  const managerData = abiCoder.encode(["(address,bytes)[]"], [allData]);

  if (options.execute) {
    await executeWeb3(wallet, addresses.dataSubmitter, "submitData(bytes)", [managerData]);
  } else {
    logger.info("managerData:");
    logger.info(managerData);
  }
}

export default new Command("submitFeedData")
  .description("Submit all feed data known to the exchange")
  .option("-a, --all", "Submit all data, overrides all other options (except execute)")
  .option("-c, --currencies <currencies>", "Currencies to submit data for, comma separated (eg. ETH,BTC,USDC). Leave blank to submit all.")
  .option("-f, --forward", "Submit forward data")
  .option("-p, --perp", "Submit perp data")
  .option("-s, --spot", "Submit spot data")
  .option("-v, --vol", "Submit vol data")
  .option("-e, --execute", "Execute the transaction, otherwise just output the managerData")
  .action(submitAllFeedData);
