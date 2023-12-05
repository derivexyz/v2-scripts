import {ethers, Mnemonic} from "ethers";
import {tryRPC} from "./requests";
import {isRPCError} from "../../types/rpc";
import {
  Amount, Direction, InstrumentName, LimitPrice, MaxFee, Nonce,
  PrivateTransferPosition,
  PrivateTransferPositionParamsSchema, Signature, SignatureExpirySec, Signer, SubaccountId
} from "../../types/stubs/private.transfer_position";
import {getRandomNonce} from "../misc/getRandomNonce";
import {getAllBalances} from "./wallets/getBalances";
import {SignedAction} from "../contracts/matching/actionSigning";
import {getAllAddresses} from "../getAddresses";
import {toBN} from "../web3/utils";
import {optionDetailsToSubId} from "../contracts/option";


export async function transferAll(wallet: ethers.Wallet, from: bigint, to: bigint) {
  // Get balances and iterate
  const allBalances = await getAllBalances(wallet, from);

  for (const position of allBalances.result.positions) {
    await submitTransfer(wallet, from, to, position.instrument_name, position.instrument_type, position.amount);
  }

  console.log(allBalances.result.positions);
  console.log(allBalances.result.collaterals);
}


function getEncodedTradeData(asset: string, subId: bigint, limitPrice: bigint, amount: bigint, maxFee: bigint, subaccountId: bigint, direction: "buy" | "sell") {
  const tradeData = [
    asset, // Asset address
    subId, //sub id
    limitPrice, // limit
    amount, //desired amount
    maxFee, //worst fee
    subaccountId, //recipient id
    direction == "buy", //isbid
  ];

  // console.log('tradeData', tradeData);

  const TradeDataABI = ['address', 'uint', 'int', 'int', 'uint', 'uint', 'bool'];
  const encoder = ethers.AbiCoder.defaultAbiCoder();
  return encoder.encode(TradeDataABI, tradeData);
}


export async function submitTransfer(wallet: ethers.Wallet, from: bigint, to: bigint, instrumentName: string, type: string, amount: string) {
  const allAddresses = await getAllAddresses()
  const currency = instrumentName.split("-")[0];

  const limitPrice = 0n; // set a limit price for marking in history/wallet accounting

  const address = type == "perp" ? allAddresses.markets[currency].perp : allAddresses.markets[currency].option;
  let subId = 0n;
  if (type == "option") {
    // eg. ETH-20231205-2050-C"
    const [, expiry, strike, optionType] = instrumentName.split("-");
    const expiryDate = new Date(+expiry.slice(0, 4), (+expiry.slice(4,6) - 1), +expiry.slice(6, 8), 8);
    const optionDetails = {
      expiry: BigInt(expiryDate.valueOf() / 1000),
      strike: toBN(strike),
      isCall: optionType == "C",
    };
    subId = optionDetailsToSubId(optionDetails);
  }

  const tradeDataFrom = getEncodedTradeData(
    address,
    subId,
    limitPrice, // limit
    toBN(amount), //desired amount
    0n, //worst fee
    from,
    "sell"
  )

  const signedFrom = new SignedAction(
    Number(from), getRandomNonce(), Date.now() + 60 * 60, wallet, wallet.address, allAddresses.matching, tradeDataFrom
  );

  const tradeDataTo = getEncodedTradeData(
    address,
    subId,
    limitPrice, // limit
    toBN(amount), //desired amount
    0n, //worst fee
    to,
    "sell"
  )

  const signedTo = new SignedAction(
    Number(from), getRandomNonce(), Date.now() + 60 * 60, wallet, wallet.address, allAddresses.matching, tradeDataTo
  );


  const transferRes = await tryRPC<PrivateTransferPosition>(
    `private/transfer_position`,
    {
      wallet: wallet.address,
      maker_params: {
        amount,
        direction: "sell",
        instrument_name: instrumentName,
        limit_price: limitPrice.toString(),
        max_fee:  '0',
        nonce: signedFrom.nonce,
        signature: signedFrom.signAction(wallet),
        signature_expiry_sec: signedFrom.expiry,
        signer: wallet.address,
        subaccount_id: Number(from)
      },
      taker_params: {
        amount,
        direction: "buy",
        instrument_name: instrumentName,
        limit_price: limitPrice.toString(),
        max_fee: '0',
        nonce: signedTo.nonce,
        signature: signedTo.signAction(wallet),
        signature_expiry_sec: signedTo.expiry,
        signer: wallet.address,
        subaccount_id: Number(to)
      },
    },
    wallet,
    false,
  );

  if (isRPCError(transferRes)) {
    throw `Failed to transfer asset: ${JSON.stringify(transferRes.error)}`;
  }

  console.log(transferRes.result)
}

