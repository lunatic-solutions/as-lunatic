import { Process } from "./index";
import { UnmanagedResult } from "../error";
import { Box, Mailbox } from "../message";
import { MessageType } from "../message/util";

export class SandboxStartContext<TStart, TReturn> {
  constructor(
    public start: TStart,
    public callback: (val: TStart) => TReturn,
  ) {}
}

export function sandbox<TStart, TReturn>(value: TStart, callback: (val: TStart) => TReturn, timeout: u64 = u64.MAX_VALUE): UnmanagedResult<Box<TReturn> | null> {
  let ctx = new SandboxStartContext<TStart, TReturn>(value, callback);
  trace("creating process");
  let p = Process.inheritSpawnWith<SandboxStartContext<TStart, TReturn>, i32>(
    ctx,
    (start: SandboxStartContext<TStart, TReturn>, mb: Mailbox<i32>) => {
      trace("sandbox callback executing");
      let ret = start.callback(start.start);
      let message = mb.receive();
      message.reply<TReturn>(ret);
    },
  ).expect();
  trace("process created, requesting");
  let message = p.request<i32, TReturn>(0, timeout);
  trace("message returned");
  return message.type == MessageType.Data
    ? new UnmanagedResult<Box<TReturn> | null>(new Box<TReturn>(message.unbox()))
    : new UnmanagedResult<Box<TReturn> | null>(null, "Timeout.");
}
