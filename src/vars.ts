import {requireEnv} from "./utils/requireEnv";
import * as dotenv from "dotenv";

dotenv.config();

export const vars = {
    exchangeUrl: requireEnv("HTTP_ADDRESS"),
    provider: requireEnv("WEB3_RPC_URL")
}