import { ASON } from "@ason/assembly";
import {
  Channel,
  ChannelReceivePrepareResult,
  channel_receive,
  channel_receive_prepare,
  receive_length_pointer,
} from "../channel";

/** The result of joining a process. */
const enum JoinResult {
  /** The join was successful, process exited cleanly. */
  Success = 0,
  /** The process errored. */
  Fail = 1,
}

/** This external method detatches a given process. */
// @ts-ignore: valid decorator
@external("lunatic", "detach_process")
declare function detach_process(pid: u32): void;

// @ts-ignore: valid decorator
@external("lunatic", "cancel_process")
declare function cancel_process(pid: u32): void;

// @ts-ignore: valid decorator
@external("lunatic", "join")
declare function join(pid: u32): JoinResult;

/** This is an internal class for helping deal with process payloads. */
class ProcessPayload<T> {
  constructor(
    /** This is a callback index on the WebAssembly.Table */
    public callback: i32,
    /** The payload is the initial value for the process. */
    // @ts-ignore: T will always be a number value
    public payload: T,
  ) {}
}

// @ts-ignore: valid external reference
@external("lunatic", "sleep_ms")
declare function sleep(ms: u64): void;

// @ts-ignore: valid decorator
@external("lunatic", "spawn_with_context")
declare function spawn_with_context(
  func: u32,
  buf_ptr: usize,
  buf_len: usize,
): u32;

/** A spawned process. */
export class Process<T> {
  private _pid: u32 = 0;
  public get pid(): u32 { return this._pid; }

  /** Sleep the current process for a given number of milliseconds. */
  public static sleep(ms: u64): void {
    sleep(ms);
  }

  constructor(val: T, callback: (val: T) => void) {
    let processCallback = (): void => {
      if (channel_receive_prepare(0, receive_length_pointer) == ChannelReceivePrepareResult.Success) {
        let length = <usize>load<u32>(receive_length_pointer);
        let buffer = new StaticArray<u8>(<i32>length);
        channel_receive(changetype<usize>(buffer), length);
        let result = ASON.deserialize<ProcessPayload<T>>(buffer);
        call_indirect(result.callback, result.payload);
      }
    };
    let payload = new ProcessPayload<T>(callback.index, val);
    let buffer = ASON.serialize(payload);
    this._pid = spawn_with_context(processCallback.index, changetype<usize>(buffer), <usize>buffer.length);
  }

  /**
   * Spawn a process.
   *
   * @param {T} val - The initial process value.
   * @param {(val: T) => void} callback - The process callback.
   * @returns The started process.
   */
  public static spawn<U>(val: U, callback: (val: U) => void): Process<U> {
    let process = new Process<U>(val, callback);
    return process;
  }

  /** Cancel the process and halt execution. */
  public cancel(): void {
    cancel_process(this._pid);
  }
  /** Detatch the process and let it keep running. */
  public detach(): void {
    detach_process(this._pid);
  }
  /** Block the current process until the child process is finished executing. */
  public join(): bool {
    return join(this._pid) == JoinResult.Success;
  }
}

/** A work queue. A simple process with a single channel */
export class WorkQueue<T> {
  /** The callback index on the WebAssembly.Table */
  private callbackIndex: i32;
  /** The message channel that accepts and receives work items. */
  private queue: Channel<T>;
  /** The underlying work process. */
  private process: Process<WorkQueue<T>>;

  constructor(callback: (val: T) => bool, limit: i32 = 0) {
    this.callbackIndex = callback.index;
    this.queue = Channel.create<T>(limit);
    this.process = Process.spawn(this, (self: WorkQueue<T>): void => {
      let queue = self.queue;
      let callbackIndex = self.callbackIndex;
      while (queue.receive()) {
        let result: bool = call_indirect(callbackIndex, queue.value);
        if (!result) break;
      }
    });
  }

  /**
   * Join the current process.
   *
   * @returns {bool} True if successful.
   */
  public join(): bool {
    return this.process.join()
  }

  /** Detatch the process. */
  public detatch(): void {
    this.process.detach();
  }

  /** Cancel the process and halt exeution. */
  public cancel(): void {
    this.process.cancel();
  }
}
