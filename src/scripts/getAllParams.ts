import { Command } from 'commander';
import path from "path";
import fs from "fs";
import {vars} from "../vars";
import {getAllPMParams} from "./getAllParams/pmParams";
import {getAllSRMParams} from "./getAllParams/smParams";
import {getAllPM2Params} from "./getAllParams/pm2Params";


async function getAllParams(): Promise<void> {

  const paramsDir = path.join(__dirname, '../../data', vars.environment);
  if (!fs.existsSync(paramsDir)) {
    fs.mkdirSync(paramsDir, { recursive: true });
  }

  //
  // console.log("# PM Params #");
  // const pmParams: any = await getAllPMParams();
  // let filePath = path.join(paramsDir, 'pmParams.json');
  // fs.writeFileSync(filePath, JSON.stringify(pmParams, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2));
  // console.log(`Results written to ${filePath}`);
  //

  console.log("# PM2 Params #");
  const pm2Params: any[] = await getAllPM2Params();
  // write results to "data/{vars.envirnoment}/pm2Params.json"
  for (const market of pm2Params) {
    let pm2FilePath = path.join(paramsDir, `${market.market}_PM2Params.json`);
    fs.writeFileSync(pm2FilePath, JSON.stringify(market, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2));
    console.log(`Results written to ${pm2FilePath}`);
  }

  console.log("# SRM Params #");
  const srmParams: any = await getAllSRMParams();
  console.log(srmParams)
  // write results to "data/srmParams.json"
  const srmFilePath = path.join(paramsDir, 'srmParams.json');
  fs.writeFileSync(srmFilePath, JSON.stringify(srmParams, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2));
  console.log(`Results written to ${srmFilePath}`);
  // for (const market of srmParams.marketParams) {
  //   console.log(`${market.marketName.toUpperCase()}_MARKETID=${market.marketId}`);
  // }
}

export default new Command('getAllParams')
  .description('Log all system params')
  .action(getAllParams);