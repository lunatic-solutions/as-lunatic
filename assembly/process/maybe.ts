import { htSet } from "as-disposable/assembly";
import { Mailbox, Message } from "../message";
import { MessageType } from "../message/util";
import { ErrCode, opaquePtr } from "../util";
import { process } from "./bindings";
import { Process } from "./index";
import { Box, Parameters } from "./util";

export const enum MaybeResolutionType {
  Pending,
  Resolved,
  Rejected,
}

export class MaybeResolution<TResolve, TReject> {
  constructor(
    public type: MaybeResolutionType,
    public resolve: Box<TResolve> | null,
    public reject: Box<TReject> | null,
  ) {}
}

export abstract class MaybeEvent<TResolve, TReject> {
  /** Return true to kill the process and free the memory. */
  abstract handle(ctx: MaybeContext<TResolve, TReject>, msg: Message<MaybeEvent<TResolve, TReject>>): bool;
}

export class IncrementMaybeRefEvent<TResolve, TReject> extends MaybeEvent<TResolve, TReject> {
  handle(ctx: MaybeContext<TResolve, TReject>, _msg: Message<MaybeEvent<TResolve, TReject>>): bool {
    ctx.ref++;
    return false;
  }
}

export class DecrementMaybeRefEvent<TResolve, TReject> extends MaybeEvent<TResolve, TReject> {
  handle(ctx: MaybeContext<TResolve, TReject>, _msg: Message<MaybeEvent<TResolve, TReject>>): bool {
    ctx.ref--;
    return ctx.ref <= 0;
  }
}

/** Represents an event that results in a promise resolution request. */
export class ObtainMaybeResolutionEvent<TResolve, TReject> extends MaybeEvent<TResolve, TReject> {
  handle(ctx: MaybeContext<TResolve, TReject>, msg: Message<MaybeEvent<TResolve, TReject>>): bool {
    msg.reply<MaybeResolution<TResolve, TReject>>(
      new MaybeResolution<TResolve, TReject>(
        ctx.type,
        ctx.resolvedValue,
        ctx.rejectedValue,
      ),
    );
    return false;
  }
}

export function maybe<TResolve, TReject>(callback: (ctx: MaybeContext<TResolve, TReject>) => void): Maybe<TResolve, TReject> {
  return new Maybe<TResolve, TReject>(callback);
}

/** This is the MaybeContext closure that provides resolve() and reject() callbacks. */
export class MaybeContext<TResolve, TReject> {

  constructor(
    public callback: (context: MaybeContext<TResolve, TReject>) => void,
  ) {}

  public ref: i32 = 1;
  public rejectedValue: Box<TReject> | null = null;
  public resolvedValue: Box<TResolve> | null = null;
  public type: MaybeResolutionType = MaybeResolutionType.Pending;

  /** Resolve this maybe with a TResolve value. */
  resolve(value: TResolve): void {
    if (this.resolvedValue || this.rejectedValue) return;
    this.type = MaybeResolutionType.Resolved;
    this.resolvedValue = new Box<TResolve>(value);
  }
  /** Reject this maybe with a TReject value. */
  reject(value: TReject): void {
    if (this.resolvedValue || this.rejectedValue) return;
    this.type = MaybeResolutionType.Rejected;
    this.rejectedValue = new Box<TReject>(value);
  }
}

export type MaybeCallback<TResolve, TReject> = (context: MaybeContext<TResolve, TReject>) => void;

/** Closure class for .then() */
export class ThenMaybeContext<TResolve, TReject, TResolveNext, TRejectNext> {
  constructor(
    public parentProcess: Process<MaybeEvent<TResolve, TReject>>,
    public resolveCallback:(value: Box<TResolve> | null, context: MaybeContext<TResolveNext, TRejectNext>) => void,
    public rejectCallback:(value: Box<TReject> | null, context: MaybeContext<TResolveNext, TRejectNext>) => void,
  ) {}
}


/** Represents a value that resolves to either a TResolve or rejects to a TReject. */
export class Maybe<TResolve, TReject> {

  /** Create a maybe that resolves to a given value. */
  static resolve<TResolve, TReject>(value: TResolve): Maybe<TResolve, TReject> {
    let resolvedMaybe = new Maybe<TResolve, TReject>((ctx: MaybeContext<TResolve, TReject>): void => {
      let message = changetype<Mailbox<TResolve>>(0).receive();
      assert(message.type == MessageType.Data);
      let value = message.unbox();
      ctx.resolve(value);
    });
    resolvedMaybe.process.sendUnsafe<TResolve>(value);
    return resolvedMaybe;
  }

  /** Create a maybe that rejects to a given value. */
  static reject<TResolve, TReject>(value: TReject): Maybe<TResolve, TReject> {
    let resolvedMaybe = new Maybe<TResolve, TReject>((ctx: MaybeContext<TResolve, TReject>): void => {
      let message = changetype<Mailbox<TReject>>(0).receive();
      assert(message.type == MessageType.Data);
      let value = message.unbox();
      ctx.reject(value);
    });
    resolvedMaybe.process.sendUnsafe<TReject>(value);
    return resolvedMaybe;
  }


  /** The process that holds the value. */
  private process: Process<MaybeEvent<TResolve, TReject>>;

  constructor(callback: MaybeCallback<TResolve, TReject>) {
    // create a maybe context
    let ctx = new MaybeContext<TResolve, TReject>(callback);

    // create the process that will house the maybe result
    this.process = Process.inheritSpawnWith<MaybeContext<TResolve, TReject>, MaybeEvent<TResolve, TReject>>(
      ctx, 
      function maybeCallback(start: MaybeContext<TResolve, TReject>, mb: Mailbox<MaybeEvent<TResolve, TReject>>): void {
        start.callback(start);

        while (true) {
          let message = mb.receive();
          switch (message.type) {
            case MessageType.Data: {
              let event = message.unbox();
              if (event) {
                if (event.handle(start, message)) return;
              }
              else {
                start.ref --;
                if (start.ref <= 0) return;
              }
              continue;
            }
            case MessageType.Signal: // not possible, fall through
            case MessageType.Timeout: {
              continue;
            }
          }
        }
      }
    ).expect();

    // manually set finalization 
    htSet(changetype<usize>(this), this.process.id, ((held: u64): void => {
      let p = Parameters.reset()
        .i64(held)
        .i32(idof<DecrementMaybeRefEvent<TResolve, TReject>>());
      let success = process.spawn(
        0,
        -1,
        -1,
        changetype<usize>([0x5f, 0x5f, 0x64, 0x65, 0x63, 0x72, 0x65, 0x6d, 0x65, 0x6e, 0x74] as StaticArray<u8>),
        11,
        p.ptr,
        p.byteLength,
        opaquePtr,
      );
      assert(success == ErrCode.Success);
      // @ts-ignore
    }).index);
  }

  then<TResolveNext, TRejectNext>(
    resolveCallback: (value: Box<TResolve> | null, context: MaybeContext<TResolveNext, TRejectNext>) => void
      = (_value: Box<TResolve> | null, _context: MaybeContext<TResolveNext, TRejectNext>): void => {},
    rejectCallback: (value: Box<TReject> | null, context: MaybeContext<TResolveNext, TRejectNext>) => void
      = (_value: Box<TReject> | null, _context: MaybeContext<TResolveNext, TRejectNext>): void => {},
  ): Maybe<TResolveNext, TRejectNext> {
    // ARC increment right away
    this.process.send(new IncrementMaybeRefEvent<TResolve, TReject>());

    // pass the callbacks and the parent process to the maybe via a ThenMaybeContext
    let thenMaybeCtx = new ThenMaybeContext<TResolve, TReject, TResolveNext, TRejectNext>(
      this.process,
      resolveCallback,
      rejectCallback,
    );

    // create the result
    let result = new Maybe<TResolveNext, TRejectNext>((ctx: MaybeContext<TResolveNext, TRejectNext>) => {
      // unbox the ThenMaybeContext callbacks
      let message = changetype<Mailbox<ThenMaybeContext<TResolve, TReject, TResolveNext, TRejectNext>>>(0).receive();
      assert(message.type == MessageType.Data);
      let thenMaybeCtx = message.unbox();

      // obtain the resolution value
      let resolutionMessage = thenMaybeCtx.parentProcess
        .request<ObtainMaybeResolutionEvent<TResolve, TReject>, MaybeResolution<TResolve, TReject>>(
          new ObtainMaybeResolutionEvent<TResolve, TReject>(),
        );
      assert(resolutionMessage.type == MessageType.Data);
      let resolution = resolutionMessage.unbox();

      // once we obtain the value, we no longer need to keep the process alive
      thenMaybeCtx.parentProcess.send<DecrementMaybeRefEvent<TResolve, TReject>>(
        new DecrementMaybeRefEvent<TResolve, TReject>(),
      );

      // pass the resolution value to the context callbacks
      if (resolution.type == MaybeResolutionType.Resolved) {
        thenMaybeCtx.resolveCallback(resolution.resolve, ctx);
      } else if (resolution.type == MaybeResolutionType.Rejected) {
        thenMaybeCtx.rejectCallback(resolution.reject, ctx);
      }
    });
    
    // send the context unsafely to the maybe process
    result.process.sendUnsafe(thenMaybeCtx);

    return result;
  }
}
