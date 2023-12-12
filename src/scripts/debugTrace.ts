import { debugTraceLog } from '../utils/web3/debugTraceLog';
import { Command } from 'commander';

export default new Command('debugTrace')
  .description('Debug trace a transaction')
  .argument('<txHash>', 'Transaction to debug trace')
  .action(debugTraceLog);
