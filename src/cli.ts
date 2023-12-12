import { Command } from 'commander';
import submitFeedData from './scripts/submitFeedData';
import submitExpiryData from './scripts/submitExpiryData';
import setupLiquidationAccs from './scripts/setupLiquidationAccs';
import liquidationFlow from './scripts/liquidationFlow';
import checkCashStats from './scripts/checkCashStats';
import debugTrace from './scripts/debugTrace';
import getAllCurrentAuctions from './scripts/getAllCurrentAuctions';
import getBalances from './scripts/getBalances';

const program = new Command();

program.version('0.0.1').description('A CLI for interacting with the Lyra V2 Protocol');

program.addCommand(checkCashStats);
program.addCommand(debugTrace);
program.addCommand(getAllCurrentAuctions);
program.addCommand(getBalances);
program.addCommand(liquidationFlow);
program.addCommand(submitFeedData);
program.addCommand(submitExpiryData);
program.addCommand(setupLiquidationAccs);

program.parse(process.argv);
