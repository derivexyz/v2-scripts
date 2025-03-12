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


async function getLiquidationHistory(subAccId: BigNumberish, option: any) {
  // TODO: handle insolvent edge cases
  const daysToCheck = parseInt(option["days"]);
  const getSpot = option["getSpot"];

  logger.info(`Getting auction events for ${subAccId} from last ${daysToCheck} days - getSpot: ${getSpot}`);

  const allAddresses = await getAllAddresses();

  const latestBlock = await getBlockWeb3("latest");

  const fromBlock = Math.floor(latestBlock.number - (60 * 60 * 24 * daysToCheck / 2));

  console.log('From Block:', fromBlock);
  console.log('To block:', latestBlock.number);

  const solventAuctionStarted = await getLogsWeb3(
    allAddresses.auction, 'SolventAuctionStarted(uint256 accountId, uint256 scenarioId, int256 markToMarket, uint256 fee)', fromBlock, "latest"
  )

  // const insolventAuctionStarted = await getLogsWeb3(
  //   allAddresses.auction, 'InsolventAuctionStarted(uint accountId, uint scenarioId, int maintenanceMargin)', sevenDaysAgo, latestBlock.number
  // )

  const auctionEnded = await getLogsWeb3(
    allAddresses.auction, 'AuctionEnded(uint256 accountId, uint256 endTime)', fromBlock, latestBlock.number
  )

  const userEvents: {started: any, ended: any}[] = []

  console.log(`Found ${solventAuctionStarted.length} events`)

  let totalFees = BigInt(0);
  for (let i = 0; i < solventAuctionStarted.length; i++) {
    const log = solventAuctionStarted[i];
    if (log.data.accountId.toString() === subAccId.toString()) {
      userEvents.push({ started:log, ended: null});
    }
    totalFees += BigInt(log.data.fee);
  }

  console.log('Total fees:', totalFees.toString());


  for (let i = 0; i < auctionEnded.length; i++) {
    const log = auctionEnded[i];
    if (log.data.accountId.toString() === subAccId.toString()) {
      for (let j = 0; j < userEvents.length; j++) {
        if (userEvents[j].started.blockNumber < log.blockNumber && !userEvents[j].ended) {
          userEvents[j].ended = log;
          break;
        }
      }
    }
  }

  console.log(allAddresses.securityModule);

  const smPaidOut = await getLogsWeb3(
    allAddresses.securityModule, 'SecurityModulePaidOut(uint256 accountId,uint256 cashAmountNeeded,uint256 cashAmountPaid)', fromBlock, latestBlock.number
  )

  console.log(smPaidOut);

  let totalPaidOut = BigInt(0);
  for (let i = 0; i < smPaidOut.length; i++) {
    const log = smPaidOut[i];
    totalPaidOut += BigInt(log.data.cashAmountPaid);
  }

  console.log('Total paid out:', totalPaidOut.toString());


  console.log('User events:', userEvents);

  for (const event of userEvents) {
    const startBlock = parseInt(event.started.blockNumber, 16)
    const endBlock = parseInt(event.ended.blockNumber, 16)

    console.log("\n\n## Liquidation of subaccount", subAccId, "from block", startBlock, "to block", endBlock)

    console.log("\n### Before flagging")
    const accountDetails = await getAccountDetails(BigInt(subAccId), startBlock - 1);
    console.log('```')
    printPortfolio(accountDetails);
    console.log('```')

    console.log("\n### After flagging")
    const accountDetails2 = await getAccountDetails(BigInt(subAccId), startBlock);
    console.log('```')
    printPortfolio(accountDetails2);
    console.log('```')

    if (getSpot) {
      const spotPrices = await getSpotPricesForAccount(accountDetails, startBlock)
      console.log("\n### Spot prices at time of flagging")
      console.log('```')
      for (const [key, value] of Object.entries(spotPrices)) {
        console.log(key, value)
      }
      console.log('```')
    }

    console.log("\n### Before auction end")
    const accountDetails3 = await getAccountDetails(BigInt(subAccId), endBlock - 1);
    console.log('```')
    printPortfolio(accountDetails3);
    console.log('```')

    console.log("\n### After auction end")
    const accountDetails4 = await getAccountDetails(BigInt(subAccId), endBlock);
    console.log('```')
    printPortfolio(accountDetails4);
    console.log('```')
  }

  // console.log('Account details:', accountDetails);
}

export default new Command('getLiquidationHistory')
  .description('Get balances for a subaccount')
  .argument('<subaccount>', 'Subaccount to get balances for')
  .option('-d, --days <days>', 'Number of days to check', '7')
  .option('-s, --getSpot', 'Get spot prices', false)
  .action(getLiquidationHistory);
