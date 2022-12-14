
import { ASManaged, htSet } from "as-disposable/assembly";
import { UnmanagedResult } from "../error";
import { Box, Mailbox, Message } from "../message";
import { MessageType } from "../message/util";
import { Process } from "../process";
import { process } from "../process/bindings";
import { Parameters } from "../process/util";
import { ErrCode, opaquePtr } from "../util";
import { __heldDecrementName } from "./held";
import { Maybe, MaybeCallbackContext } from "./maybe";

export abstract class YieldableEvent<TStart, TIn, TOut> {
  abstract handle(
    ctx: YieldableContext<TStart, TIn, TOut>,
    msg: Message<YieldableEvent<TStart, TIn, TOut>>,
  ): Box<TIn> | null;
}

export class MaybeNextConfiguration<TStart, TIn, TOut> {
  constructor(
    public self: Yieldable<TStart, TIn, TOut>,
    public inValue: TIn,
    public timeout: u64,
  ) {}
}

export type YieldableCallback<TStart, TIn, TOut> = (start: TStart, ctx: YieldableContext<TStart, TIn, TOut>) => void;

export class YieldableContext<TStart, TIn, TOut> {
  public ref: i64 = 1;
  public done: bool = false;

  constructor() {}

  public yield(out: TOut): TIn {
    // When we yield, we have to exhaust the messaged in the mailbox until we receive
    // an actionable message before we can return back to executing the function.  
    let mb = Mailbox.create<YieldableEvent<TStart, TIn, TOut>>();

    // We allocate space on the stack for inValue so that if an event returns
    // an inValue, we can return back to the callback 
    let inValue: Box<TIn> | null = null;
    while (true) {
      let message = mb.receive();
      if (message.type == MessageType.Data) {
        let event = message.unbox();
        inValue = event.handle(this, message);
        
        if (inValue) {
          // once we have the inValue, we can reply to the caller, and continue execution
          message.reply<Box<TOut> | null>(new Box<TOut>(out));
          return inValue.value;
        }
      } else if (message.type == MessageType.Signal) {
        let event = new DecrementYieldableEvent<TStart, TIn, TOut>(message.tag);
        event.handle(this, message);
      }
    }
  }
}

/** Yieldables need a closure type, so treating them like the input and output interface can be useful. */
export interface Consumable<TIn, TOut> {
  next(value: TIn, timeout: u64): UnmanagedResult<Box<TOut> | null>;
  maybeNext(value: TIn, timeout: u64): Maybe<TOut, string>;
  __asonPut<U>(ser: U, entryId: u32): void;
}

export class NextYieldableEvent<TStart, TIn, TOut> extends YieldableEvent<TStart, TIn, TOut> {
  constructor(
    public inValue: TIn,
  ) {
    super();
  }
  /** If the generator is done, we return null. */
  handle(ctx: YieldableContext<TStart, TIn, TOut>, _msg: Message<YieldableEvent<TStart, TIn, TOut>>): Box<TIn> | null {
    if (ctx.done) return null;
    return new Box<TIn>(this.inValue);
  }
}

export class IncrementYieldableEvent<TStart, TIn, TOut> extends YieldableEvent<TStart, TIn, TOut> {
  constructor() {
    super();
  }
  handle(ctx: YieldableContext<TStart, TIn, TOut>, _msg: Message<YieldableEvent<TStart, TIn, TOut>>): Box<TIn> | null {
    ctx.ref++;
    return null;
  }
}

export class DecrementYieldableEvent<TStart, TIn, TOut> extends YieldableEvent<TStart, TIn, TOut> {
  constructor(
    public parentProcessId: u64,
  ) {
    super();
  }
  handle(ctx: YieldableContext<TStart, TIn, TOut>, _msg: Message<YieldableEvent<TStart, TIn, TOut>>): Box<TIn> | null {
    ctx.ref--;
    process.unlink(this.parentProcessId);
    if (ctx.ref <= 0) process.kill(process.process_id());
    return null; 
  }
}

export class LinkYieldableEvent<TStart, TIn, TOut> extends YieldableEvent<TStart, TIn, TOut> {
  constructor(
    public holderProcessId: u64,
  ) {
    super();
  }

  handle(ctx: YieldableContext<TStart, TIn, TOut>, msg: Message<YieldableEvent<TStart, TIn, TOut>>): Box<TIn> | null {
    process.link(Process.tag++, this.holderProcessId);
    return null;
  }
}

export class StartYieldableContext<TStart, TIn, TOut> {
  constructor(
    public start: TStart,
    public callback: (start: TStart, ctx: YieldableContext<TStart, TIn, TOut>) => void,
  ) {}
}

/** Represents a handle to a a process that yields values. */
// @ts-ignore: __asonPut is implemented by ASON
export class Yieldable<TStart, TIn, TOut> extends ASManaged implements Consumable<TIn, TOut> {
  private proc: Process<YieldableEvent<TStart, TIn, TOut>>;

  constructor(start: TStart, callback: YieldableCallback<TStart, TIn, TOut>) {
    let ctx = new StartYieldableContext<TStart, TIn, TOut>(start, callback);

    let proc = Process.inheritSpawnWith<
      StartYieldableContext<TStart, TIn, TOut>,
      YieldableEvent<TStart, TIn, TOut>
    >(
      ctx,
      (start: StartYieldableContext<TStart, TIn, TOut>, mb: Mailbox<YieldableEvent<TStart, TIn, TOut>>) => {
        Process.dieWhenLinkDies = false;
        let ctx = new YieldableContext<TStart, TIn, TOut>();
        
        // once the callback is done, we need to handle events and reply with null values
        // to indicate the yieldable is exhausted
        start.callback(start.start, ctx);
        ctx.done = true;

        while (true) {
          let message = mb.receive();
          if (message.type == MessageType.Data) {
            let event = message.unbox();
            assert(!event.handle(ctx, message)); 
          } else if (MessageType.Signal) {
            ctx.ref--;
          }
        }
      },
    ).expect();

    // When the held is cleaned up, we kill the process remotely
    super(proc.id, (held: u64): void => {
      let params = Parameters.reset()
        .i64(held)
        .i64(Process.processID)
        .i32(idof<DecrementYieldableEvent<TStart, TIn, TOut>>());
        
      let result = process.spawn(
        0,
        -1,
        -1,
        changetype<usize>(__heldDecrementName),
        <usize>__heldDecrementName.length,
        params.ptr,
        params.byteLength,
        opaquePtr,
      );
      assert(result == ErrCode.Success);
    });
    this.proc = proc;
    proc.send<LinkYieldableEvent<TStart, TIn, TOut>>(new LinkYieldableEvent<TStart, TIn, TOut>(Process.processID));
  }

  /** Obtain a result to a box of the next generated value. */
  next(value: TIn, timeout: u64 = u64.MAX_VALUE): UnmanagedResult<Box<TOut> | null> {
    let event = new NextYieldableEvent<TStart, TIn, TOut>(value);
    let message = this.proc.request<NextYieldableEvent<TStart, TIn, TOut>, Box<TOut> | null>(event, timeout);
    if (message.type == MessageType.Data) {
      return new UnmanagedResult<Box<TOut> | null>(message.unbox());
    }
    return new UnmanagedResult<Box<TOut> | null>(null, "Timeout");
  }

  /** Return a maybe that resolves or rejects to the next generated value. */
  maybeNext(value: TIn, timeout: u64 = u64.MAX_VALUE): Maybe<TOut, string> {
    let config = new MaybeNextConfiguration<TStart, TIn, TOut>(this, value, timeout);
    return Maybe.resolve<MaybeNextConfiguration<TStart, TIn, TOut>, i32>(config).then(
      (value: Box<MaybeNextConfiguration<TStart, TIn, TOut>> | null, ctx: MaybeCallbackContext<TOut, string>) => {
        let config = value!.value;
        let out = config.self.next(config.inValue, config.timeout);
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
  
  /** Used by ASON to safely serialize a Held<T>. */
  __asonSerialize(): StaticArray<u8> {
    // node -p "[...Buffer.from(``STRING``)]" in PowerShell
    Process.inheritSpawnParameter<i32>(this.proc.id, (value: u64, mb: Mailbox<i32>) => {
      let event = new IncrementYieldableEvent<TStart, TIn, TOut>();
      let p = new Process<YieldableEvent<TStart, TIn, TOut>>(value, Process.tag++);
      p.send(event);
    }).expect();

    // get the return value
    let array = new StaticArray<u8>(sizeof<u64>());
    // store the process id
    store<u64>(changetype<usize>(array), this.proc.id);
    return array;
  }

  /** Used by ASON to safely deserialize a Held<T>. */
  __asonDeserialize(array: StaticArray<u8>): void {
    // create the process object unsafely
    this.proc = new Process<YieldableEvent<TStart, TIn, TOut>>(load<u64>(changetype<usize>(array)), 0);

    Process.inheritSpawnTwoParameters<i32>(this.proc.id, Process.processID, (sendProcessId: u64, holderProcessId: u64, mb: Mailbox<i32>) => {
      let event = new LinkYieldableEvent<TStart, TIn, TOut>(holderProcessId);
      let p = new Process<YieldableEvent<TStart, TIn, TOut>>(sendProcessId, Process.tag++);
      p.send(event);
    }).expect();

    // @ts-ignore function index, used to set up the disposable callback
    htSet(changetype<usize>(this), this.proc.id, ((held: u64): void => {
      let params = Parameters.reset()
        .i64(held)
        .i64(Process.processID)
        .i32(idof<DecrementYieldableEvent<TStart, TIn, TOut>>());
        
      let result = process.spawn(
        0,
        -1,
        -1,
        changetype<usize>(__heldDecrementName),
        <usize>__heldDecrementName.length,
        params.ptr,
        params.byteLength,
        opaquePtr,
      );
      assert(result == ErrCode.Success);
    }).index);
  }
}
