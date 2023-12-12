import { execSync } from 'child_process';
import { AllContracts, getAllAddresses } from '../getAddresses';
import { vars } from '../../vars';
import { logger } from '../logger';

export async function debugTraceLog(tx_hash: string) {
  // Parse JSON data
  const data: AllContracts = await getAllAddresses(); // switch .env to .env.<cluster> to use different cluster

  // Initial command
  let command = `cast run --rpc-url ${vars.provider} ${tx_hash}`;

  // Iterate over each key-value pair in the object and append to the command
  for (const market of Object.keys(data.markets)) {
    command += ` --label ${data.markets[market].option}:option-${market}:`;
    command += ` --label ${data.markets[market].perp}:perp-${market}:`;
    command += ` --label ${data.markets[market].base}:base-${market}`;
    command += ` --label ${data.markets[market].spotFeed}:spotFeed-${market}`;
    command += ` --label ${data.markets[market].volFeed}:volFeed-${market}`;
    command += ` --label ${data.markets[market].forwardFeed}:forwardFeed-${market}`;
    command += ` --label ${data.markets[market].perpFeed}:perpFeed-${market}`;
    command += ` --label ${data.markets[market].ibpFeed}:ibpFeed-${market}`;
    command += ` --label ${data.markets[market].iapFeed}:iapFeed-${market}`;
    command += ` --label ${data.markets[market].rateFeed}:rateFeed-${market}`;
    command += ` --label ${data.markets[market].pmrm}:pmrm-${market}`;
  }

  command += ` --label ${data.usdc}:usdc`;
  command += ` --label ${data.matching}:matching`;
  command += ` --label ${data.deposit}:deposit`;
  command += ` --label ${data.trade}:trade`;
  command += ` --label ${data.transfer}:transfer`;
  command += ` --label ${data.withdrawal}:withdrawal`;
  command += ` --label ${data.subAccountCreator}:subAccountCreator`;
  command += ` --label ${data.subAccounts}:subAccounts`;
  command += ` --label ${data.cash}:cash`;
  command += ` --label ${data.auction}:auction`;
  command += ` --label ${data.rateModel}:rateModel`;
  command += ` --label ${data.securityModule}:securityModule`;
  command += ` --label ${data.srmViewer}:srmViewer`;
  command += ` --label ${data.srm}:srm`;
  command += ` --label ${data.stableFeed}:stableFeed`;
  command += ` --label ${data.dataSubmitter}:dataSubmitter`;
  command += ` --label ${data.optionSettlementHelper}:optionSettlementHelper`;
  command += ` --label ${data.perpSettlementHelper}:perpSettlementHelper`;

  // Execute command
  logger.debug('command is:', command);
  try {
    const output = execSync(command, { shell: '/bin/bash' });
    logger.debug(output.toString());
  } catch (error) {
    logger.error(`Error: ${error}`);
  }
}
