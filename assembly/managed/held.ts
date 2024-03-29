import { Box, Mailbox, Message } from "../message";
import { Process } from "../process";
import { process } from "../process/bindings";
import { ASManaged, htDel, htGet, htSet } from "as-disposable/assembly";
import { MessageType } from "../message/util";
import { Parameters } from "../process/util";
import { ErrCode, opaquePtr } from "../util";
import { UnmanagedResult } from "../error";
import { sandbox } from "../process/sandbox";


/** This class is used internally to box the value. */
export class HeldContext<T> {
  ref: i32 = 1;
  constructor(public value: T) {}
}

/** Represents an abstract event that can be handled. */
export abstract class HeldEvent<T> {
  constructor() {}
  /** Handle the event. */
  abstract handle(ctx: HeldContext<T>, msg: Message<HeldEvent<T>>): bool;
}

/** Represents a request to obtain the value from a Held. */
export class ObtainHeldEvent<T> extends HeldEvent<T> {
  constructor() {
    super();
  }

  /** Reply to the message with the held value. */
  handle(ctx: HeldContext<T>, msg: Message<HeldEvent<T>>): bool {
    msg.reply<T>(ctx.value);
    return false;
  }
}

/** Represents a request to replace the held value. */
export class ReplaceHeldEvent<T> extends HeldEvent<T> {
  constructor(public value: T) {
    super();
  }

  /** Replace the held value. */
  handle(ctx: HeldContext<T>, _msg: Message<HeldEvent<T>>): bool {
    ctx.value = this.value;
    return false;
  }
}


/** This class is used a start message to notify the child process of the parent and the initial value. */
export class HeldStartContext<T> {
  constructor(
    public parent: u64,
    public value: T,
  ) {}
}

export class ExecuteHeldEventSandboxContext<T, U> {
  constructor(
    public event: ExecuteHeldEvent<T, U>,
    public value: T,
  ) {}
}

/** Represents a request to manipulate the held value with a callback. */
export class ExecuteHeldEvent<T, U> extends HeldEvent<T> {
  constructor(
    public value: U,
    public callback: (value: U, ctx: T) => T,
    public timeout: u64 = u64.MAX_VALUE,
  ) {
    super();
  }

  handle(ctx: HeldContext<T>, msg: Message<HeldEvent<T>>): bool {
    let handleContext = new ExecuteHeldEventSandboxContext<T, U>(this, ctx.value);
    let result = sandbox<ExecuteHeldEventSandboxContext<T, U>, T>(handleContext, (ctx: ExecuteHeldEventSandboxContext<T, U>) => {
      return ctx.event.callback(ctx.event.value, ctx.value);
    });
    if (result.isOk()) {
      ctx.value = result.expect().value;
    }
    return false;
  }
}

export class IncrementHeldEvent<T> extends HeldEvent<T> {
  constructor() {
    super();
  }
  handle(ctx: HeldContext<T>, _msg: Message<HeldEvent<T>>): bool {
    ctx.ref++;
    return false;
  }
}

export class DecrementHeldEvent<T> extends HeldEvent<T> {
  constructor(
    public parentProcessId: u64,
  ) {
    super();
  }
  handle(ctx: HeldContext<T>, _msg: Message<HeldEvent<T>>): bool {
    let ref = ctx.ref--;
    process.unlink(this.parentProcessId);
    return (ref - 1) <= 0; 
  }
}

export class LinkHeldEvent<T> extends HeldEvent<T> {
  constructor(
    public holderProcessId: u64,
  ) {
    super();
  }

  handle(ctx: HeldContext<T>, msg: Message<HeldEvent<T>>): bool {
    process.link(Process.tag++, this.holderProcessId);
    return false;
  }
}

export class RequestHeldEventSandboxContext<T, U, UReturn> {
  constructor(
    public event: RequestHeldEvent<T, U, UReturn>,
    public ctx: HeldContext<T>,
  ) {}
}

export class RequestHeldEventSandboxReturn<T, UReturn> {
  constructor(
    public ctx: HeldContext<T>,
    public ret: UReturn,
  ) {}
}

export class RequestHeldEvent<T, U, UReturn> extends HeldEvent<T> {
  constructor(
    public value: U,
    public callback: (value: U, ctx: HeldContext<T>) => UReturn,
    public timeout: u64 = u64.MAX_VALUE,
  ) {
    super();
  }

  handle(ctx: HeldContext<T>, msg: Message<HeldEvent<T>>): bool {
    let sandboxCtx = new RequestHeldEventSandboxContext<T, U, UReturn>(this, ctx);
    let result = sandbox<
      RequestHeldEventSandboxContext<T, U, UReturn>,
      RequestHeldEventSandboxReturn<T, UReturn>
    >(
      sandboxCtx,
      (val: RequestHeldEventSandboxContext<T, U, UReturn>) => {
        let ret = val.event.callback(val.event.value, val.ctx);
        return new RequestHeldEventSandboxReturn<T, UReturn>(val.ctx, ret);
      },
      this.timeout
    );

    if (result.isOk()) {
      let unboxed = result.expect().value;
      ctx.value = unboxed.ctx.value;
      msg.reply<Box<UReturn> | null>(new Box<UReturn>(unboxed.ret));
    } else {
      msg.reply<Box<UReturn> | null>(null);
    }

    return false;
  }
}

// UTF8 for __heldDecrement
export const __heldDecrementName = [0x5f, 0x5f, 0x68, 0x65, 0x6c, 0x64, 0x44, 0x65, 0x63, 0x72, 0x65, 0x6d, 0x65, 0x6e, 0x74] as StaticArray<u8>;


/** Represents a value held on another process. */
export class Held<T> extends ASManaged {

  /** Create a held process. */
  static create<T>(value: T): Held<T> {
    // We need to tell the child process who owns it, and what value to hold
    let startCxt = new HeldStartContext<T>(Process.processID, value); 

    // create a new process
    let proc = Process.inheritSpawnWith<HeldStartContext<T>, HeldEvent<T>>(
      startCxt, 
      (start: HeldStartContext<T>, mb: Mailbox<HeldEvent<T>>): void => {
        Process.dieWhenLinkDies = false;

        // box the held value
        let ctx = new HeldContext<T>(start.value);

        while (true) {
          // for each message
          let message = mb.receive();

          switch (message.type) {
            case MessageType.Data: {
              // unbox the message and handle it
              let event = message.unbox();
              // assert(event);
              if (event.handle(ctx, message)) return;
              continue;
            }
            case MessageType.Signal:
              ctx.ref--;
          }
        }
        // we expect the value 
      },
    ).expect();

    // return the held
    return new Held<T>(proc);
  }

  /** Keeps track if the process is still perceived to be alive. */
  private get alive(): bool {
    return htGet(changetype<usize>(this)) != null;
  }

  constructor(public heldProcess: Process<HeldEvent<T>>) {
    
    // When the held is cleaned up, we kill the process remotely
    super(heldProcess.id, (held: u64): void => {
      let params = Parameters.reset()
        .i64(held)
        .i64(Process.processID)
        .i32(idof<DecrementHeldEvent<T>>());
        
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

    heldProcess.send<LinkHeldEvent<T>>(new LinkHeldEvent<T>(Process.processID));
  }

  /** Get or set the value of type T. */
  getValue(timeout: u64 = u64.MAX_VALUE): UnmanagedResult<Box<T> | null> {
    assert(this.alive);
    let event = new ObtainHeldEvent<T>();
    let message = this.heldProcess.request<ObtainHeldEvent<T>, T>(event, Process.replyTag++, timeout);
    if (message.type == MessageType.Timeout) return new UnmanagedResult<Box<T> | null>(null, "Request timed out.")
    assert(message.type == MessageType.Data);
    
    return new UnmanagedResult<Box<T> | null>(message.box);
  }

  /** Set the value, accepts a T. */
  setValue(value: T): void {
    assert(this.alive);
    let event = new ReplaceHeldEvent<T>(value);
    this.heldProcess.send(event);
  }

  /** Execute a callback on the Held process with a value and a context. */
  execute<U>(value: U, callback: (value: U, ctx: T) => T): void {
    assert(this.alive);
    let event = new ExecuteHeldEvent<T, U>(value, callback);
    this.heldProcess.send(event);
  }

  /** Request a calculated value, executing the callback that returns the requested value on the held process. */
  request<U, UReturn>(value: U, callback: (value: U, ctx: HeldContext<T>) => UReturn, timeout: u64 = u64.MAX_VALUE): UnmanagedResult<Box<UReturn> | null> {
    assert(this.alive);
    // this operation blocks until the calllback is executed
    let reply = this.heldProcess
      .request<RequestHeldEvent<T, U, UReturn>, Box<UReturn> | null>(new RequestHeldEvent<T, U, UReturn>(value, callback, timeout), Process.replyTag++, timeout);
    
    if (reply.type == MessageType.Timeout) return new UnmanagedResult<Box<UReturn> | null>(null, "The request timed out.");
    
    return new UnmanagedResult<Box<UReturn> | null>(reply.unbox());
  }

  /** If the held value is no longer used, we can free the resouces safely. */
  free(): void {
    if (this.alive) {
      this.heldProcess.send(new DecrementHeldEvent<T>(Process.processID));
      htDel(changetype<usize>(this));
    }
  }

  /** Used by ASON to safely serialize a Held<T>. */
  __asonSerialize(): StaticArray<u8> {
    assert(this.alive);
    // node -p "[...Buffer.from(``STRING``)]" in PowerShell
    Process.inheritSpawnParameter<i32>(this.heldProcess.id, (value: u64, mb: Mailbox<i32>) => {
      let event = new IncrementHeldEvent<T>();
      let p = new Process<HeldEvent<T>>(value, Process.tag++);
      p.send(event);
    }).expect();

    // get the return value
    let array = new StaticArray<u8>(sizeof<u64>());
    // store the process id
    store<u64>(changetype<usize>(array), this.heldProcess.id);
    return array;
  }

  /** Used by ASON to safely deserialize a Held<T>. */
  __asonDeserialize(array: StaticArray<u8>): void {
    // create the process object unsafely
    this.heldProcess = new Process<HeldEvent<T>>(load<u64>(changetype<usize>(array)), 0);


    Process.inheritSpawnTwoParameters<i32>(this.heldProcess.id, Process.processID, (sendProcessId: u64, holderProcessId: u64, mb: Mailbox<i32>) => {
      let event = new LinkHeldEvent<T>(holderProcessId);
      let p = new Process<HeldEvent<T>>(sendProcessId, Process.tag++);
      p.send(event);
    }).expect();

    // @ts-ignore function index, used to set up the disposable callback
    htSet(changetype<usize>(this), this.heldProcess.id, ((held: u64): void => {
      let params = Parameters.reset()
        .i64(held)
        .i64(Process.processID)
        .i32(idof<DecrementHeldEvent<T>>());
        
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
