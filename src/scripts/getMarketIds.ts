import { getLogsWeb3 } from '../utils/web3/utils';
import { Command } from 'commander';
import { requireEnv } from "../utils/requireEnv";


async function getMarketIds() {
  const srm = requireEnv('SRM_ADDRESS');

  const logs = await getLogsWeb3(srm, 'MarketCreated(uint256 id,string marketName)', 0);
  const markets = logs.map((x: any) => x.data);

  console.log(markets)
}

export default new Command('getMarketIds')
  .description('Log all market ids')
  .action(getMarketIds);