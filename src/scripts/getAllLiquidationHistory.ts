import { BigNumberish } from 'ethers';
import {
  getAccountDetails,
  getSpotPricesForAccount,
  printPortfolio
} from '../utils/contracts/subaccounts';
import { Command } from 'commander';
import {getBlockWeb3, getLogsWeb3} from "../utils/web3/utils";
import {getAllAddresses} from "../utils/getAddresses";
import {logger} from "../utils/logger";


async function getLiquidationHistory(option: any) {
  // TODO: handle insolvent edge cases
  const daysToCheck = parseFloat(option["days"]);
  const getAccountDetails = option["accounts"];
  const getSpot = option["getSpot"];

  logger.info(`Getting all auction events from last ${daysToCheck} days - getSpot: ${getSpot}`);

  const allAddresses = await getAllAddresses();

  const latestBlock = await getBlockWeb3("latest");

  const fromBlock = Math.floor(latestBlock.number - (60 * 60 * 24 * daysToCheck / 2));

  console.log('From Block:', fromBlock);
  console.log('To block:', latestBlock.number);

  const solventAuctionStarted = await getLogsWeb3(
    allAddresses.auction, 'SolventAuctionStarted(uint256 accountId, uint256 scenarioId, int256 markToMarket, uint256 fee)', fromBlock, "latest"
  )

  console.log('Solvent Auctions:', solventAuctionStarted[0]);

  const insolventAuctionStarted = await getLogsWeb3(
    allAddresses.auction, 'InsolventAuctionStarted(uint256 accountId, uint256 scenarioId, int256 maintenanceMargin)', fromBlock, "latest"
  )

  console.log('Insolvent Auctions:', insolventAuctionStarted[0]);

  const auctionEnded = await getLogsWeb3(
    allAddresses.auction, 'AuctionEnded(uint256 accountId, uint256 endTime)', fromBlock, "latest"
  )

  console.log('Auction Ended:', auctionEnded[0]);

  const bids = await getLogsWeb3(
    allAddresses.auction, 'Bid(uint256 accountId, uint256 bidderId, uint256 finalPercentage, uint256 cashFromBidder, uint256 cashToBidder)', fromBlock, "latest"
  )

  console.log('Bids:', bids[0]);

  console.log('Solvent Auctions:', solventAuctionStarted.length);

  let count = 1;
  for (const solv of solventAuctionStarted) {
    const block = parseInt(solv.blockNumber, 16);

    console.log(`\n## [${count}/${solventAuctionStarted.length}] Solvent auction of subaccount ${solv.data.accountId}; block ${block}; tx ${solv.transactionHash}`)
    count += 1;

    if (!getAccountDetails) {
      continue;
    }
    const accountDetails = await getAccountDetails(BigInt(solv.data.accountId), block - 1);

    printPortfolio(accountDetails);

    if (!getSpot) {
      continue;
    }

    const spotPrices = await getSpotPricesForAccount(accountDetails, block)
        console.log("\n### Spot prices at time of flagging")
        console.log('```')
        for (const [key, value] of Object.entries(spotPrices)) {
          console.log(key, value)
        }
        console.log('```')
  }



  //
  // const allAuctions = {
  //
  // }
  //
  // for (let i = 0; i < solventAuctionStarted.length; i++) {
  //   const log = solventAuctionStarted[i];
  //   if (log.data.accountId.toString() === subAccId.toString()) {
  //     userEvents.push({ started:log, ended: null});
  //   }
  // }
  //
  //
  // for (let i = 0; i < auctionEnded.length; i++) {
  //   const log = auctionEnded[i];
  //   if (log.data.accountId.toString() === subAccId.toString()) {
  //     for (let j = 0; j < userEvents.length; j++) {
  //       if (userEvents[j].started.blockNumber < log.blockNumber && !userEvents[j].ended) {
  //         userEvents[j].ended = log;
  //         break;
  //       }
  //     }
  //   }
  // }
  //
  // // console.log('User events:', userEvents);
  //
  // for (const event of userEvents) {
  //   const startBlock = parseInt(event.started.blockNumber, 16)
  //   const endBlock = parseInt(event.ended.blockNumber, 16)
  //
  //   console.log("\n\n## Liquidation of subaccount", subAccId, "from block", startBlock, "to block", endBlock)
  //
  //   console.log("\n### Before flagging")
  //   const accountDetails = await getAccountDetails(BigInt(subAccId), startBlock - 1);
  //   console.log('```')
  //   printPortfolio(accountDetails);
  //   console.log('```')
  //
  //   console.log("\n### After flagging")
  //   const accountDetails2 = await getAccountDetails(BigInt(subAccId), startBlock);
  //   console.log('```')
  //   printPortfolio(accountDetails2);
  //   console.log('```')
  //
  //   if (getSpot) {
  //     const spotPrices = await getSpotPricesForAccount(accountDetails, startBlock)
  //     console.log("\n### Spot prices at time of flagging")
  //     console.log('```')
  //     for (const [key, value] of Object.entries(spotPrices)) {
  //       console.log(key, value)
  //     }
  //     console.log('```')
  //   }
  //
  //   console.log("\n### Before auction end")
  //   const accountDetails3 = await getAccountDetails(BigInt(subAccId), endBlock - 1);
  //   console.log('```')
  //   printPortfolio(accountDetails3);
  //   console.log('```')
  //
  //   console.log("\n### After auction end")
  //   const accountDetails4 = await getAccountDetails(BigInt(subAccId), endBlock);
  //   console.log('```')
  //   printPortfolio(accountDetails4);
  //   console.log('```')
  // }

  // // console.log('Account details:', accountDetails);
}

export default new Command('getAllLiquidationHistory')
  .description('Get liquidation history')
  .option('-d, --days <days>', 'Number of days to check', '7')
  .option('-a, --accounts', 'Get account details', false)
  .option('-s, --getSpot', 'Get spot prices (requires -a)', false)
  .action(getLiquidationHistory);
