import axios, { AxiosError, AxiosResponse, Method } from 'axios';
import { LyraAuthHeader } from './auth';
import { ethers } from 'ethers';
import { getLyraAuthHeader } from './auth';
import { RequestParamsType, ResponseType, MethodOf } from '../types/rpc';
import {vars} from "../../vars";

export type ResponseDigest<R = any> = {
    response: AxiosResponse<R>;
    stringified: string;
};

export async function tryRPCWithRetry<T extends { request: { method: string; params: any }; response: any }>(
    method: MethodOf<T>,
    params: RequestParamsType<T>,
    wallet?: ethers.Wallet,
    retries: number = 3,
) {
    let retry = 0;
    const delay = 5000;
    // eslint-disable-next-line no-constant-condition
    while (true) {
        try {
            return await tryRPC(method, params, wallet);
        } catch (error) {
            console.error(`An error occurred during tryRPCWithRetry: ${error}, retrying in ${delay / 1000} seconds...`);
            retry++;
            if (retry < retries) {
                await new Promise((res) => setTimeout(res, delay));
            } else {
                throw new Error('Maximum retries reached, could not request via TryRPCWithRetry');
            }
        }
    }
}

export async function tryRPC<T extends { request: { method: string; params: any }; response: any }>(
    method: MethodOf<T>,
    params: RequestParamsType<T>,
    wallet?: ethers.Wallet,
    verbose?: boolean,
): Promise<ResponseType<T>> {
    const subroute: string = method.startsWith('/') ? method : '/' + method;
    const header = wallet ? await getLyraAuthHeader(wallet) : undefined;
    const { response } = await tryRequest<RequestParamsType<T>, ResponseType<T>>(
        'POST',
        subroute,
        params,
        header,
        verbose,
    );
    if (response.data.error) {
        throw new Error(`RPC error: ${JSON.stringify(response.data.error)}`);
    }
    return response.data;
}

export async function tryRequest<T = any, R = any>(
    method: Method,
    subroute: string,
    data: T,
    authHeaders?: LyraAuthHeader,
    verbose = true,
): Promise<ResponseDigest<R>> {
    const base_url = vars.exchangeUrl;
    const url = base_url + subroute;
    const headers = authHeaders ? (authHeaders as Record<string, string>) : ({} as Record<string, string>);

    try {
        if (verbose) {
            console.log(
                `\x1b[34m${method} ${url}\x1b[0m request with data: \n`,
                `${JSON.stringify(data, null, '\t')}\n`,
            );
        }
        const response = await axios.request<R>({
            method,
            url,
            data,
            headers,
        });
        const stringified = JSON.stringify(response.data);
        if (verbose) {
            console.log(
                `\x1b[34m${method} ${url}\x1b[0m successful: \n`,
                `${JSON.stringify(response.data, null, '\t')}\n` + `with status: ${response.status}`,
            );
        }
        return {
            response: response,
            stringified: stringified,
        };
    } catch (error) {
        let errorMessage;
        if (error instanceof AxiosError) {
            errorMessage =
                `Caught Axios error while ${method}:${url} with message ${error.message} and code ${error.code}`;
            errorMessage += `\nRPC error message: ${JSON.stringify(error.response?.data, null, '\t')}`;
        } else if (error instanceof Error) {
            errorMessage = `Caught error while ${method}:${url} with message ${error.message}`;
        } else {
            errorMessage = `Caught unknown error while ${method}:${url} with message ${error}`;
        }
        throw new Error(errorMessage);
    }
}
