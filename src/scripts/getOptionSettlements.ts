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
import {getLogsWeb3} from "../utils/web3/utils";
import {getAllAddresses} from "../utils/getAddresses";
import {subIdToOptionDetails} from "../utils/contracts/option";

async function getOptionSettlements() {
  const addresses = await getAllAddresses()
  let res = (await Promise.all([
    getLogsWeb3(
      addresses.markets['ETH'].pmrm,
      'OptionSettled(uint indexed accountId, address option, uint subId, int amount, int value)',
    ),
    getLogsWeb3(
      addresses.markets['BTC'].pmrm,
      'OptionSettled(uint indexed accountId, address option, uint subId, int amount, int value)',
    ),
    getLogsWeb3(
      addresses.srm,
      'OptionSettled(uint indexed accountId, address option, uint subId, int amount, int value)',
    ),
  ])).flat();

  let totalItmEthOptions = 0;
  let totalItmBtcOptions = 0;

  2563.9625255443

  for (let i = 0; i < res.length; i++) {
    const {accountId, option, subId, amount, value} = res[i].data;
    const market = option.toLowerCase() === addresses.markets['ETH'].option.toLowerCase() ? 'ETH' : 'BTC';
    // logger.info(`\nSubaccount: ${chalk.bold(accountId)}`);
    logger.info(`optionDetails: ${subIdToOptionDetails(subId).expiry} ${subIdToOptionDetails(subId).strike} ${subIdToOptionDetails(subId).isCall ? 'C' : 'P'}`);


    // logger.info(`market: ${market}`);
    // logger.info(`amount: ${fromBN(amount)}`);
    // logger.info(`value: ${fromBN(value)}`);
    if (value > 0) {
      if (market === 'ETH') {
        totalItmEthOptions += +fromBN(amount);
      } else {
        totalItmBtcOptions += +fromBN(amount);
      }
    }
  }

  logger.info(`\nTotal ITM ETH Options: ${totalItmEthOptions}`);
  logger.info(`Total ITM BTC Options: ${totalItmBtcOptions}`);
}

export default new Command('getOptionSettlements')
  .description('Get all option settlement stats.')
  .action(getOptionSettlements);
