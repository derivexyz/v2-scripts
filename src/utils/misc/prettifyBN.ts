import chalk from "chalk";
import {fromBN} from "../web3/utils";

export function prettifyBN(bn: bigint) {
  if (bn < 0n) {
    return chalk.red(fromBN(bn))
  } else if (bn == 0n) {
    return chalk.yellow(fromBN(bn))
  } else {
    return chalk.green(fromBN(bn))
  }
}