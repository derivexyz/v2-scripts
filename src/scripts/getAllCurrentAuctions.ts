import {
  AuctionDetails,
  getAllAuctionsubAccIds,
  getAuctionBidPrice,
  getAuctionDetails,
  getAuctionMaxProportion,
  getAuctionParams,
} from '../utils/contracts/auctions';
import { getAccountDetails, printPortfolio } from '../utils/contracts/subaccounts';
import { logger } from '../utils/logger';
import chalk from 'chalk';
import { fromBN, prettifyBN } from '../utils/misc/BN';
import { Command } from 'commander';

async function getAllCurrentAuctions() {
  const auctionParams = await getAuctionParams();
  const allsubAccIds = await getAllAuctionsubAccIds();

  const auctionResults: Promise<AuctionDetails>[] = [];

  logger.info(`Checking ${allsubAccIds.size} total seen auctions`);

  for (const subAccId of allsubAccIds) {
    // manager, mm, mtm, worstScenario
    auctionResults.push(getAuctionDetails(subAccId));
    // Every 20 entries, wait for them all to finish before moving on
    if (auctionResults.length % 20 == 0) {
      await Promise.all(auctionResults);
    }
  }

  const currentAuctions = (await Promise.all(auctionResults)).filter((a) => a.ongoing);

  logger.info(`Getting details for ${currentAuctions.length} ongoing auctions`);

  const accountDetails = [];

  for (let i = 0; i < currentAuctions.length; ++i) {
    accountDetails.push(getAccountDetails(currentAuctions[i].subAccId));
    // Every 20 entries, wait for them all to finish before moving on
    if (accountDetails.length % 20 == 0) {
      await Promise.all(accountDetails);
    }
  }

  await Promise.all(accountDetails);

  for (let i = 0; i < currentAuctions.length; ++i) {
    const auction = currentAuctions[i];
    const portfolio = await accountDetails[i];

    logger.info(`\nSubaccount: ${chalk.bold(auction.subAccId)} (lastTradeId: ${portfolio.lastTradeId})`);
    logger.info(`auction is ${auction.insolvent ? chalk.yellow('insolvent') : chalk.blue('solvent')}`);
    printPortfolio(portfolio.portfolio);
    if (portfolio.margin) {
      const [bidPrice, discount] = getAuctionBidPrice(auction, portfolio.margin, auctionParams);
      logger.info(`MtM: ${prettifyBN(portfolio.margin.MtM)}`);
      logger.info(`MM: ${prettifyBN(portfolio.margin.MM)}`);
      logger.info(`bid price: ${chalk.yellow(fromBN(bidPrice))}`);
      logger.info(`discount %: ${fromBN(discount)}`);
      logger.info(
        `max bid percentage: ${
          auction.insolvent ? '1.0' : fromBN(getAuctionMaxProportion(portfolio.margin, auctionParams, discount))
        }`,
      );

      if (auction.insolvent && portfolio.margin.MM > 0n) {
        logger.warn(chalk.red('⚠️ Auction can be terminated'));
      }
    } else {
      logger.warn(chalk.red('Could not compute margin (must update feeds)'));
    }
  }
}

export default new Command('getAllCurrentAuctions')
  .description('Get all current auctions. Note; may need to submitFeedData first to get accurate values.')
  .action(getAllCurrentAuctions);
