// @ts-ignore: @lazy!
@lazy export const opaquePtr = memory.data(sizeof<u64>());

/** TCP Reads can result in Timeouts, so we use a slightly different enum. */
export const enum TimeoutErrCode {
  /** The TCP Read was successful. */
  Success,
  /** The TCP Read resulted in some kind of an error or a disconnect and the socket is now closed. */
  Fail,
  /** The TCP Read resulted in a timeout, the socket is still open, but no bytes were read. */
  Timeout = 9027,
};

/** Success enum to describe the results of syscalls. The value `0` is successful. */
export const enum ErrCode {
  Success,
  Fail,
}

/** Describes the result of compiling a web assembly module. */
export const enum CompileModuleErrCode {
  Success = 0,
  Fail = 1,
  NotAllowed = -1,
}