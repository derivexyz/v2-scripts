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

const program = new Command();

program.version('0.0.1').description('A CLI for interacting with the Lyra V2 Protocol');

program.addCommand(checkCashStats);
program.addCommand(debugTrace);
program.addCommand(getAllCurrentAuctions);
program.addCommand(getOptionSettlements);
program.addCommand(getBalances);
program.addCommand(liquidationFlow);
program.addCommand(submitFeedData);
program.addCommand(setupLiquidationAccs);
program.addCommand(withdrawFromSubaccount);

program.parse(process.argv);
