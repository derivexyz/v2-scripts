import { vars } from '../vars';

const winston = require('winston');

export const logger = winston.createLogger({
  level: vars.logDebug.toLowerCase() == 'true' ? 'debug' : 'info',
  format: winston.format.printf((f: any) => f.message),
  transports: [new winston.transports.Console()],
});
