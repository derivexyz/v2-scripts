/* eslint-disable */
/**
 * This file was automatically generated by json-schema-to-typescript.
 * DO NOT MODIFY IT BY HAND. Instead, modify the source JSONSchema file,
 * and run json-schema-to-typescript to regenerate this file.
 */

/**
 * Transfer assets from one subaccount to another.
 */
export type PrivateTransfer = PrivateTransferJSONRPCSchema;
export type Method = "private/transfer";
/**
 * Base currency of the recipient subaccount (only for `PM` if creating a new subaccount)
 */
export type RecipientCurrency = string | null;
/**
 * Unique nonce defined as <UTC_timestamp in ms><random_number_up_to_6_digits> (e.g. 1695836058725001, where 001 is the random number)
 */
export type Nonce = number;
/**
 * Ethereum signature of the transfer
 */
export type Signature = string;
/**
 * Unix timestamp in seconds. Expiry MUST be >5min from now
 */
export type SignatureExpirySec = number;
/**
 * Ethereum wallet address that is signing the transfer
 */
export type Signer = string;
/**
 * `PM` (Portfolio Margin) or `SM` (Standard Margin) if creating a new subaccount. Can be omitted otherwise
 */
export type RecipientMarginType = ("PM" | "SM") | null;
/**
 * Subaccount_id of the recipient
 */
export type RecipientSubaccountId = number;
/**
 * Subaccount_id
 */
export type SubaccountId = number;
/**
 * Ethereum address of the asset being transferred
 */
export type Address = string;
/**
 * Amount to transfer
 */
export type Amount = string;
/**
 * Sub ID of the asset being transferred
 */
export type SubId = number;
/**
 * List of transfers
 */
export type Transfers = TransferDetailsSchema[];
/**
 * `requested`
 */
export type Status = string;
/**
 * Transaction id of the transfer
 */
export type TransactionId = string;

export interface PrivateTransferJSONRPCSchema {
  request: PrivateTransferRequestSchema;
  response: PrivateTransferResponseSchema;
}
export interface PrivateTransferRequestSchema {
  id?: string | number;
  method: Method;
  params: PrivateTransferParamsSchema;
}
export interface PrivateTransferParamsSchema {
  recipient_currency?: RecipientCurrency;
  recipient_details: SignatureDetailsSchema;
  recipient_margin_type?: RecipientMarginType;
  recipient_subaccount_id: RecipientSubaccountId;
  sender_details: SignatureDetailsSchema1;
  subaccount_id: SubaccountId;
  transfers: Transfers;
}
/**
 * Details of the recipient
 */
export interface SignatureDetailsSchema {
  nonce: Nonce;
  signature: Signature;
  signature_expiry_sec: SignatureExpirySec;
  signer: Signer;
}
/**
 * Details of the sender
 */
export interface SignatureDetailsSchema1 {
  nonce: Nonce;
  signature: Signature;
  signature_expiry_sec: SignatureExpirySec;
  signer: Signer;
}
export interface TransferDetailsSchema {
  address: Address;
  amount: Amount;
  sub_id: SubId;
}
export interface PrivateTransferResponseSchema {
  id: string | number;
  result: PrivateTransferResultSchema;
}
export interface PrivateTransferResultSchema {
  status: Status;
  transaction_id: TransactionId;
}