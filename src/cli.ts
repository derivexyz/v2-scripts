import { Command } from 'commander';
import submitFeedData from './scripts/submitFeedData';
import setupLiquidationAccs from './scripts/setupLiquidationAccs';
import liquidationFlow from './scripts/liquidationFlow';
import checkCashStats from './scripts/checkCashStats';
import debugTrace from './scripts/debugTrace';
import getAllCurrentAuctions from './scripts/getAllCurrentAuctions';
import getBalances from './scripts/getBalances';
import withdrawFromSubaccount from "./scripts/withdrawFromSubaccount";
import getOptionSettlements from "./scripts/getOptionSettlements";
import getAllParams from "./scripts/getAllParams";
import getMarketIds from "./scripts/getMarketIds";
import getLiquidationHistory from "./scripts/getLiquidationHistory";
import getBalanceHistory from "./scripts/getBalanceHistory";
import getAllLiquidationHistory from "./scripts/getAllLiquidationHistory";
import getOiCaps from "./scripts/getOiCaps";

const program = new Command();

program.version('0.0.1').description('A CLI for interacting with the Derive V2 Protocol');

program.addCommand(checkCashStats);
program.addCommand(debugTrace);
program.addCommand(getAllCurrentAuctions);
program.addCommand(getOptionSettlements);
program.addCommand(getBalances);
program.addCommand(liquidationFlow);
program.addCommand(submitFeedData);
program.addCommand(setupLiquidationAccs);
program.addCommand(withdrawFromSubaccount);
program.addCommand(getAllParams);
program.addCommand(getMarketIds);
program.addCommand(getOiCaps)
program.addCommand(getLiquidationHistory);
program.addCommand(getAllLiquidationHistory)
program.addCommand(getBalanceHistory);

program.parse(process.argv);
