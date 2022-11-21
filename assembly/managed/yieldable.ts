
import { UnmanagedResult } from "../error";
import { Box, Mailbox, Message } from "../message";
import { message } from "../message/bindings";
import { MessageType } from "../message/util";
import { Process } from "../process";
import { Held, HeldContext } from "./held";
import { Maybe, MaybeCallbackContext } from "./maybe";

export type YieldableCallback<TStart, TIn, TOut> = (start: TStart, ctx: YieldableContext<TStart, TIn, TOut>) => void;

export class YieldableContext<TStart, TIn, TOut> {
  constructor(
    public start: TStart, 
    public callback: YieldableCallback<TStart, TIn, TOut>,
  ) {}
  private last: Message<TIn> | null = null;

  public yield(out: TOut): TIn {
    while (true) {
      let message = Mailbox.create<TIn>().receive();   
      switch(message.type) {
        case MessageType.Data: {
          message.reply(new Box<TOut>(out));
          return message.unbox();
        }
      }
    }
  }
}

export interface Consumable<TIn, TOut> {
  next(value: TIn, timeout: u64): UnmanagedResult<Box<TOut> | null>;
  maybeNext(value: TIn, timeout: u64): Maybe<TOut, string>;
}

export class MaybeNextConfiguration<TIn, TOut> {
  constructor(
    public self: Consumable<TIn, TOut>,
    public value: TIn,
    public timeout: u64, 
  ) {}
}

export class StartWithYieldableContext<TStart, TIn, TOut> {
    constructor(
        public start: TStart,
        public callback: (start: TStart, ctx: YieldableContext<TStart, TIn, TOut>) => void,
    ) {}
}

/** Represents a handle to a a process that yields values. */
export class Yieldable<TStart, TIn, TOut> implements Consumable<TIn, TOut> {

  private held: Held<YieldableContext<TStart, TIn, TOut>>;

  constructor(start: TStart, callback: YieldableCallback<TStart, TIn, TOut>) {
    this.held = Held.create(new YieldableContext<TStart, TIn, TOut>(start, callback));
    this.held.execute<i32>(
      0,
      (_: i32, ctx: HeldContext<YieldableContext<TStart, TIn, TOut>>) => {
        // execute the generator
        ctx.value.callback(ctx.value.start, ctx.value);

        // if there was a requestor, return null
        let last = load<Message<TIn> | null>(changetype<usize>(ctx.value));
        if (last) {
          last.reply<Box<TOut> | null>(null);
        }

        for (;;) {
          let msg = Mailbox.create<TIn>().receive();
          if (msg.type == MessageType.Data) {
            msg.reply<Box<TOut> | null>(null);
          }
        }
      },
    );
  }

  /** Obtain a result to a box of the next generated value. */
  next(value: TIn, timeout: u64 = u64.MAX_VALUE): UnmanagedResult<Box<TOut> | null> {
    let message = this.held.heldProcess.requestUnsafe<TIn, Box<TOut> | null>(value, Process.replyTag++, timeout);
    if (message.type == MessageType.Data) {
      return new UnmanagedResult<Box<TOut> | null>(message.unbox());
    }
    return new UnmanagedResult<Box<TOut> | null>(null, "Request timed out.");
  }

  /** Return a maybe that resolves or rejects to the next generated value. */
  maybeNext(value: TIn, timeout: u64 = u64.MAX_VALUE): Maybe<TOut, string> {
    let config = new MaybeNextConfiguration<TIn, TOut>(this, value, timeout);
    return Maybe.resolve<MaybeNextConfiguration<TIn, TOut>, i32>(config).then(
      (value: Box<MaybeNextConfiguration<TIn, TOut>> | null, ctx: MaybeCallbackContext<TOut, string>) => {
        let config = value!.value;
        let out = config.self.next(config.value, config.timeout);
        if (out.error) {
          ctx.reject(out.error);
        } else {
          if (out.value) {
            ctx.resolve(out.value!.value);
          }
          // else we resolve to nothing because the iterator is done
        }
      },
    );
  }
}
