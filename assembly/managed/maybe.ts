import { Box } from "../message";
import { Held, HeldContext } from "./held";

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

/** Define the callback types */
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

export class ThenContext<TResolve, TReject, TResolveNext, TRejectNext> {
  constructor(
    public resolve: ThenCallback<TResolve, TResolveNext, TRejectNext>,
    public reject: ThenCallback<TReject, TResolveNext, TRejectNext>,
    public held: Held<MaybeResolution<TResolve, TReject>>,
    public timeout: u64,
  ) {}
}

export class Maybe<TResolve, TReject> {

  static resolve<TResolve, TReject>(value: TResolve): Maybe<TResolve, TReject> {
    let maybe = new Maybe<TResolve, TReject>(() => {});
    maybe.held.execute<TResolve>(
      value,
      (value: TResolve, ctx: HeldContext<MaybeResolution<TResolve, TReject>>) => {
        ctx.value.status = MaybeResolutionStatus.Resolved;
        ctx.value.resolved = new Box<TResolve>(value);
      },
    );
    return maybe;
  }

  static reject<TResolve, TReject>(value: TReject): Maybe<TResolve, TReject> {
    let maybe = new Maybe<TResolve, TReject>(() => {});
    maybe.held.execute<TReject>(
      value,
      (value: TReject, ctx: HeldContext<MaybeResolution<TResolve, TReject>>) => {
        ctx.value.status = MaybeResolutionStatus.Rejected;
        ctx.value.rejected = new Box<TReject>(value);
      },
    );
    return maybe; 
  }

  /** The held value, resolution of the promise. */
  private held: Held<MaybeResolution<TResolve, TReject>> = Held
    .create<MaybeResolution<TResolve, TReject>>(new MaybeResolution<TResolve, TReject>());

  constructor(callback: MaybeCallback<TResolve, TReject>) {
    // this operation is async and atomic
    this.held.execute<MaybeCallback<TResolve, TReject>>(
      callback,
      (value: MaybeCallback<TResolve, TReject>, ctx: HeldContext<MaybeResolution<TResolve, TReject>>) => {
        let maybeContext = new MaybeCallbackContext<TResolve, TReject>();
        value(maybeContext);
        ctx.value = maybeContext.unpack();
      },
    );
  }

  /** Act upon the resolution of a Maybe asynchronously. */
  then<TResolveNext, TRejectNext>(
    resolve: ThenCallback<TResolve, TResolveNext, TRejectNext> = () => {},
    reject: ThenCallback<TReject, TResolveNext, TRejectNext> = () => {},
  ): Maybe<TResolveNext, TRejectNext> {

    // create the maybe
    let maybe = new Maybe<TResolveNext, TRejectNext>(() => {});

    // execute an atomic operation on the maybe with a `ThenContext` which
    // has the callbacks and the held of the parent `Maybe`
    maybe.held.execute<ThenContext<TResolve, TReject, TResolveNext, TRejectNext>>(
      new ThenContext<TResolve, TReject, TResolveNext, TRejectNext>(
        resolve,
        reject,
        this.held,
        this._timeout,
      ),
      (
        thenCtx: ThenContext<TResolve, TReject, TResolveNext, TRejectNext>,
        heldCtx: HeldContext<MaybeResolution<TResolveNext, TRejectNext>>
      ): void => {
        // read the resolution of the parent Maybe
        // note: Held#value is a getter that blocks until the Maybe resolves
        let resolutionResult = thenCtx.held.getValue();
         // every Maybe requires a MaybeCallbackContext to store the result of the resolution
        // because AssemblyScript does not have closures.
        let maybeCallbackCtx = new MaybeCallbackContext<TResolveNext, TRejectNext>();

        // the resolution could have timed out
        if (resolutionResult.isOk()) {
          let resolution = resolutionResult.expect().value;
         

          // call the appropriate callback
          if (resolution.status == MaybeResolutionStatus.Resolved) {
            thenCtx.resolve(resolution.resolved, maybeCallbackCtx);
          } else if (resolution.status == MaybeResolutionStatus.Rejected) {
            thenCtx.reject(resolution.rejected, maybeCallbackCtx);
          }

          // finally set the resolution
          heldCtx.value = maybeCallbackCtx.unpack();
        } else {
          // resolution wasn't okay. we resolve to an empty rejected
          thenCtx.reject(null, maybeCallbackCtx);
        }
      }
    );
    return maybe;
  }



  get value(): MaybeResolution<TResolve, TReject> {
    return this.held.getValue().expect().value;
  }

  private _timeout: u64 = u64.MAX_VALUE;

  timeout(ms: u64): MaybeResolution<TResolve, TReject> {
    this._timeout = ms;
  }

  getTimeout(): u64 {
    return this._timeout;
  }
}
