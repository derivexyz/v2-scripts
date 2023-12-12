export type RPCErrorCode = {
  code: number;
  message: string;
  data?: any;
};

export interface RPCError {
  id: number | string;
  error: RPCErrorCode;
}

export type MethodOf<T> = T extends { request: { method: infer M } } ? M : never;
export type RequestParamsType<T> = T extends { request: { params: infer P } } ? P : never;
export type ResponseType<T> = T extends { response: infer S } ? S : never;

function isRPCError(obj: any): obj is RPCError {
  // narrows the type of RPC response of the form SomeResponseStubSchema | RPCError to RPCError
  // ts is smart enough to know that if this is false, type of the object will be SomeResponseStubSchema
  return (obj as RPCError).error !== undefined;
}

export { isRPCError };
