import { ASON } from "@ason/assembly";
import { Channel } from "channel";
import {
  ChannelReceivePrepareResult,
  channel_receive,
  channel_receive_prepare,
  receive_length_pointer,
} from "../channel";

const enum JoinResult {
  Success = 0,
  Fail = 1,
}

// @ts-ignore: valid decorator
@external("lunatic", "detach_process")
declare function detach_process(pid: u32): void;

// @ts-ignore: valid decorator
@external("lunatic", "cancel_process")
declare function cancel_process(pid: u32): void;

// @ts-ignore: valid decorator
@external("lunatic", "join")
declare function join(pid: u32): JoinResult;

class ProcessPayload<T> {
  constructor(
    public callback: i32,
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

export class Process {
  private _pid: u32 = 0;
  public get pid(): u32 { return this._pid; }

  public static sleep(ms: u64): void {
    sleep(ms);
  }


  public static spawn<T>(val: T, callback: (val: T) => void): Process {
    let process = new Process();
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
    process._pid = spawn_with_context(processCallback.index, changetype<usize>(buffer), <usize>buffer.length);
    return process;
  }

  public drop(): void {
    cancel_process(this._pid);
  }
  public detatch(): void {
    detach_process(this._pid);
  }
  public join(): bool {
    return join(this._pid) == JoinResult.Success;
  }
}

export class WorkQueue<T> {
  callbackIndex: i32;
  queue: Channel<T>;

  constructor(callback: (val: T) => bool, limit: i32 = 0) {
    this.callbackIndex = callback.index;
    this.queue = Channel.create<T>(limit);
    Process.spawn(this, (self: WorkQueue<T>): void => {
      let queue = self.queue;
      let callbackIndex = self.callbackIndex;
      while (queue.receive()) {
        let result: bool = call_indirect(callbackIndex, queue.value);
        if (!result) break;
      }
    });
  }
}
