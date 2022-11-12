import { Box, Mailbox, Message } from "../message";
import { MessageType } from "../message/util";
import { Process } from "../process";
import { Held, HeldContext, HeldEvent, ObtainHeldEvent } from "./held";

/** Represents the status of a resolution */
export const enum MaybeResolutionStatus {
    Pending,
    Resolved,
    Rejected,
}

/** This class is passed to the maybe callback, and it allows users to resolve or reject a Maybe. */
export class MaybeCallbackContext<TResolve, TReject> {
    private resolutionType: MaybeResolutionStatus = MaybeResolutionStatus.Pending;
    private resolved: Box<TResolve> | null = null;
    private rejected: Box<TReject> | null = null;

    /** Resolve the Maybe. Can only call resolve or reject once. */
    resolve(value: TResolve): void {
      if (this.resolutionType == MaybeResolutionStatus.Pending) {
        this.resolved = new Box<TResolve>(value);
        this.resolutionType = MaybeResolutionStatus.Resolved;
      }
    }

    /** Reject the Maybe. Can only call resolve or reject once. */
    reject(value: TReject): void {
      if (this.resolutionType == MaybeResolutionStatus.Pending) {
        this.rejected = new Box<TReject>(value);
        this.resolutionType = MaybeResolutionStatus.Rejected;
      }
    }

    /** Return a class that represents the resolution of this MaybeContext. */
    unpack(): MaybeResolution<TResolve, TReject> {
        return new MaybeResolution(
            this.resolutionType == MaybeResolutionStatus.Pending ? MaybeResolutionStatus.Resolved : this.resolutionType,
            this.resolved,
            this.rejected,
        );
    }
}

export type MaybeCallback<TResolve, TReject> = (ctx: MaybeCallbackContext<TResolve, TReject>) => void; 
export type ThenCallback<TValue, TResolveNext, TRejectNext> = (value: Box<TValue> | null, ctx: MaybeCallbackContext<TResolveNext, TRejectNext>) => void;


/** Data class that represents a maybe resolution. */
export class MaybeResolution<TResolve, TReject> {
    constructor(
        /** The status of this resolution. */
        public status: MaybeResolutionStatus = MaybeResolutionStatus.Pending,
        /** The resolved value is boxed if it was explicitly resolved. */
        public resolved: Box<TResolve> | null = null,
        /** The rejected value is boxed if it was explicitly rejected. */
        public rejected: Box<TReject> | null = null,
    ) {}
}


export class MaybeStartContext<TResolve, TReject> {
    constructor(
        public heldProcess: Process<HeldEvent<MaybeResolution<TResolve, TReject> | null>>,
        public callback: MaybeCallback<TResolve, TReject>,
    ) {}
}

export abstract class MaybeProcessEvent<TResolve, TReject> {
  abstract handle(ctx: MaybeCallbackContext<TResolve, TReject>, message: Message<MaybeProcessEvent<TResolve, TReject>>): bool;
}



export class ThenCallbackStartContext<TResolve, TReject, TResolveNext, TRejectNext> {
  constructor(
    public parentProcess: Process<HeldEvent<MaybeResolution<TResolve, TReject> | null>>,
    public resolveCallback: ThenCallback<TResolve, TResolveNext, TRejectNext>,
    public rejectCallback: ThenCallback<TReject, TResolveNext, TRejectNext>,
  ) {}
}


export class Maybe<TResolve, TReject> {
  static resolve<TResolve, TReject>(value: TResolve): Maybe<TResolve, TReject> {
    let result = new Maybe<TResolve, TReject>((ctx: MaybeCallbackContext<TResolve, TReject>) => {
      let msg = Mailbox.create<TResolve>().receive();
      assert(msg.type == MessageType.Data);
      let resolved = msg.unbox();
      ctx.resolve(resolved);
    });
    result.held.heldProcess.sendUnsafe<TResolve>(value);
    return result;
  }

  private held: Held<MaybeResolution<TResolve, TReject> | null>
    = Held.create<MaybeResolution<TResolve, TReject> | null>(null);

  constructor(callback: MaybeCallback<TResolve, TReject>) {
    this.held.execute(
      callback,
      (callback: MaybeCallback<TResolve, TReject>, ctx: HeldContext<MaybeResolution<TResolve, TReject> | null>) => {
        let callbackContext = new MaybeCallbackContext<TResolve, TReject>();
        callback(callbackContext);
        ctx.value = callbackContext.unpack();
      },
    );
  }

  then<TResolveNext, TRejectNext>(
    resolveCallback: ThenCallback<TResolve, TResolveNext, TRejectNext> = (val: Box<TResolve> | null, ctx: MaybeCallbackContext<TResolveNext, TRejectNext>) => {},
    rejectCallback: ThenCallback<TReject, TResolveNext, TRejectNext> = (val: Box<TReject> | null, ctx: MaybeCallbackContext<TResolveNext, TRejectNext>) => {},
  ): Maybe<TResolveNext, TRejectNext> {
    // assert(resolveCallback || rejectCallback);

    let ctx = new ThenCallbackStartContext<TResolve, TReject, TResolveNext, TRejectNext>(
      this.held.heldProcess,
      resolveCallback,
      rejectCallback
    );

    let m = new Maybe<TResolveNext, TRejectNext>((ctx: MaybeCallbackContext<TResolveNext, TRejectNext>) => {
      // obtain the start value
      let startMessage = Mailbox.create<ThenCallbackStartContext<TResolve, TReject, TResolveNext, TRejectNext>>()
        .receive();
      assert(startMessage.type == MessageType.Data);
      let start =  startMessage.unbox();
      
      // obtain the resolution from the parent
      let resolutionMessage = start.parentProcess.request<
        HeldEvent<MaybeResolution<TResolve, TReject> | null>,
        MaybeResolution<TResolve, TReject>
      >(new ObtainHeldEvent<MaybeResolution<TResolve, TReject> | null>());
      assert(startMessage.type == MessageType.Data);
      let resolution = resolutionMessage.unbox();
      startMessage.reply(0);

      if (resolution.status == MaybeResolutionStatus.Resolved) {
        if (start.resolveCallback) {
          start.resolveCallback!(resolution.resolved, ctx);
        }
      } else if (resolution.status == MaybeResolutionStatus.Rejected) {
        if (start.rejectCallback) {
          start.rejectCallback!(resolution.rejected, ctx);
        }
      } else {
        assert(false);
      }
    });
    
    // we are letting the process "borrow" the parent process. We reply to the start message to validate it's safe to continue
    let tag = Process.replyTag++;
    m.held.heldProcess.sendUnsafe<ThenCallbackStartContext<TResolve, TReject, TResolveNext, TRejectNext>>(ctx, tag);
    Mailbox.create<i32>().receive([tag]);

    return m;
  }

  /** Resolve the value  */
  get resolve(): Box<TResolve> | null {
    return this.held.value!.resolved;
  }


}
