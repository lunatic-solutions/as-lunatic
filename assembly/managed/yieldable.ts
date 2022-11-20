
import { UnmanagedResult } from "../error";
import { Box, Mailbox, Message } from "../message";
import { message } from "../message/bindings";
import { MessageType } from "../message/util";
import { Process } from "../process";
import { Held, HeldContext } from "./held";
import { Maybe, MaybeCallbackContext } from "./maybe";

export type YieldableCallback<TIn, TOut> = (ctx: YieldableContext<TIn, TOut>) => void;

export class YieldableContext<TIn, TOut> {
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

export class MaybeNextConfiguration<TIn, TOut> {
  constructor(
    public self: Yieldable<TIn, TOut>,
    public value: TIn,
    public timeout: u64, 
  ) {}
}

/** Represents a handle to a a process that yields values. */
export class Yieldable<TIn, TOut> {
  private held: Held<YieldableContext<TIn, TOut>>;

  constructor(callback: YieldableCallback<TIn, TOut>) {
    this.held = Held.create(new YieldableContext<TIn, TOut>());
    this.held.execute<YieldableCallback<TIn, TOut>>(
      callback,
      (callback: YieldableCallback<TIn, TOut>, ctx: HeldContext<YieldableContext<TIn, TOut>>) => {
        // execute the generator
        callback(ctx.value);

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
