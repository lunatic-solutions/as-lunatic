import { ASON } from "@ason/assembly";
import { htSet } from "as-disposable/assembly";
import { OBJECT, TOTAL_OVERHEAD } from "assemblyscript/std/assembly/rt/common";
import { Process } from ".";
import { Mailbox, Message } from "../message";
import { MessageType } from "../message/util";
import { Box } from "./util";

export type ResolveCallback<TResolve> = (value: TResolve) => void;
export type RejectCallback<TReject> = (value: TReject) => void;
export type ThenCallback<TResolve, TNextResolve, TNextReject> = (value: TResolve) => Promise<TNextResolve, TNextReject>;
export type CatchCallback<TReject, TNextResolve, TNextReject> = (value: TReject) => Promise<TNextResolve, TNextReject>;


export const enum PromiseState {
  Pending,
  Resolved,
  Rejected,
}

export class PromiseListener {
  constructor(
    public listener: u64,
    public tag: u64,
  ) {}
}

export class PromiseEventContext<TResolve, TReject> {
  public promiseState: PromiseState = PromiseState.Pending;
  public promiseResolve: Box<TResolve> | null = null;
  public promiseReject: Box<TReject> | null = null;
  public listeners: PromiseListener[] = [];
  ref: i32 = 1;
  constructor() {}
}

export abstract class PromiseEvent<TResolve, TReject> {
  constructor() {}
  /** Return true to end the process. */
  abstract handle(
    ctx: PromiseEventContext<TResolve, TReject>,
    message: Message<PromiseEvent<TResolve, TReject>>
  ): bool;
}

export class IncrementPromiseEvent<TResolve, TReject> extends PromiseEvent<TResolve, TReject> {

  constructor() {
    super();
  }

  handle(ctx: PromiseEventContext<TResolve, TReject> , _message: Message<PromiseEvent<TResolve, TReject>>): bool {
    ctx.ref++;
    return false;
  }
}


export class DecrementPromiseEvent<TResolve, TReject> extends PromiseEvent<TResolve, TReject> {
  constructor() {
    super();
  }
  handle(ctx: PromiseEventContext<TResolve, TReject>, _message: Message<PromiseEvent<TResolve, TReject>>): bool {
    ctx.ref--;
    return ctx.ref == 0;
  }
}

export class RetreivePromiseValue<TResolve, TReject> {
  constructor(
    public state: PromiseState,
    public resolve: Box<TResolve> | null,
    public reject: Box<TReject> | null
  ) {}
}

export class RetreivePromiseEvent<TResolve, TReject> extends PromiseEvent<TResolve, TReject> {
  constructor() {
    super();
  }
  handle(ctx: PromiseEventContext<TResolve, TReject>, message: Message<PromiseEvent<TResolve, TReject>>): bool {
    if (ctx.promiseState == PromiseState.Pending) {
      ctx.listeners.push(new PromiseListener(message.sender, message.replyTag));
    } else {
      message.reply(
        new RetreivePromiseValue<TResolve, TReject>(
          ctx.promiseState,
          ctx.promiseResolve,
          ctx.promiseReject,
        ),
      );
    }
    return false;
  }
}

export class PromiseResolvedEvent<TResolve, TReject> extends PromiseEvent<TResolve, TReject> {
  constructor(
    public value: StaticArray<u8>,
  ) {
    super();
  }
  handle(ctx: PromiseEventContext<TResolve, TReject>, _message: Message<PromiseEvent<TResolve, TReject>>): bool {
    ctx.promiseState = PromiseState.Resolved;
    ctx.promiseResolve = new Box<TResolve>(ASON.deserialize<TResolve>(this.value));
    return false;
  }
}

export class PromiseRejectedEvent<TResolve, TReject> extends PromiseEvent<TResolve, TReject> {
  constructor(
    public value: StaticArray<u8>,
  ) {
    super();
  }
  handle(ctx: PromiseEventContext<TResolve, TReject>, _message: Message<PromiseEvent<TResolve, TReject>>): bool {
    ctx.promiseState = PromiseState.Resolved;
    ctx.promiseReject = new Box<TReject>(ASON.deserialize<TReject>(this.value));
    return false;
  }
}

export class RunPromiseContext<TResolve, TReject> {
  constructor(
    public process: Process<PromiseEvent<TResolve, TReject>>,
    public callback: (resolve: ResolveCallback<TResolve>, reject: RejectCallback<TReject>) => void,
  ) {}
}

export class ThenProcessContext<TResolve, TReject, TNextResolve, TNextReject> {
  constructor(
    public process: Process<PromiseEvent<TResolve, TReject>>,
    public thenCallback: ThenCallback<TResolve, TNextResolve, TNextReject> | null,
    public catchCallback: CatchCallback<TReject, TNextResolve, TNextReject> | null,
  ) {}
}

export class PromiseWrapper<TResolve, TReject> {
  constructor(
    public resolved: Box<TResolve> | null,
    public rejected: Box<TReject> | null,
  ) {}
}

export class Promise<TResolve, TReject> {
  static resolve<TResolve, TReject>(value: TResolve): Promise<TResolve, TReject> {
    let promise = new Promise<TResolve, TReject>((resolve: ResolveCallback<TResolve>, _reject: RejectCallback<TReject>) => {
      let value = changetype<Mailbox<TResolve>>(0).receive().unbox();
      resolve(value);
    });
    promise.value.sendUnsafe<TResolve>(value);
    return promise;
  }

  static reject<TResolve, TReject>(value: TReject): Promise<TResolve, TReject> {
    let promise = new Promise<TResolve, TReject>((_resolve: ResolveCallback<TResolve>, reject: RejectCallback<TReject>) => {
      let value = changetype<Mailbox<TReject>>(0).receive().unbox();
      reject(value);
    });
    promise.value.sendUnsafe<TReject>(value);
    return promise;
  }

  private static decrementCallback<TResolve, TReject>(): (held: u64) => void {
    return (held: u64) => {
      let dummy = Promise.dummy;
      dummy.id = held;
      let decrement = Promise.decrement;
      changetype<OBJECT>(changetype<usize>(decrement) - TOTAL_OVERHEAD).rtId = idof<DecrementPromiseEvent<TResolve, TReject>>();
      changetype<Process<PromiseEvent<TResolve, TReject>>>(dummy).send(
        changetype<DecrementPromiseEvent<TResolve, TReject>>(decrement),
      );
      dummy.send(Promise.decrement);
    };
  }

  private static state: PromiseState = PromiseState.Pending;
  private static promiseValue: StaticArray<u8> = [];

  private static dummy: Process<PromiseEvent<i32, i32>> = new Process<PromiseEvent<i32, i32>>(0, 0);
  private static decrement: PromiseEvent<i32, i32> = new DecrementPromiseEvent<i32, i32>();
  private value: Process<PromiseEvent<TResolve, TReject>>;

  constructor(callback: (resolve: ResolveCallback<TResolve>, reject: RejectCallback<TReject>) => void) {
    let value = Process
      .inheritSpawn<PromiseEvent<TResolve, TReject>>((mb: Mailbox<PromiseEvent<TResolve, TReject>>) => {
        let ctx = new PromiseEventContext<TResolve, TReject>();
      
        while (true) {
          let message = mb.receive();
      
          if (message.type == MessageType.Data) {
            let event = message.unbox();
            event.handle(ctx, message);
          }
        }
      })
      .expect() as Process<PromiseEvent<TResolve, TReject>>;
    // @ts-ignore: index callback
    htSet(changetype<usize>(this), value.id, Promise.decrementCallback<TResolve,TReject>().index);
    this.value = value;

    let ctx = new RunPromiseContext<TResolve, TReject>(value, callback);

    Process.inheritSpawnWith<RunPromiseContext<TResolve, TReject>, i32>(ctx,
      (start: RunPromiseContext<TResolve, TReject>, mb: Mailbox<i32>) => {
        start.callback(
          (value: TResolve): void => {
            Promise.state = PromiseState.Resolved;
            Promise.promiseValue = ASON.serialize(value);
          },
          (value: TReject): void => {
            Promise.state = PromiseState.Rejected;
            Promise.promiseValue = ASON.serialize(value);
          } 
        );

        if (Promise.state == PromiseState.Resolved) {
          start.process.send(new PromiseResolvedEvent<TResolve, TReject>(Promise.promiseValue));
        } else if (Promise.state == PromiseState.Rejected) {
          start.process.send(new PromiseRejectedEvent<TResolve, TReject>(Promise.promiseValue));
        }
      },
    );
  }

  then<TNextResolve, TNextReject>(
    thenCallback: ThenCallback<TResolve, TNextResolve, TNextReject> | null = null,
    catchCallback: CatchCallback<TReject, TNextResolve, TNextReject> | null = null,
  ): Promise<TNextResolve, TNextReject> {
    let ctx = new ThenProcessContext<TResolve, TReject, TNextResolve, TNextReject>(this.value, thenCallback, catchCallback);
    this.value.send(new IncrementPromiseEvent<TResolve, TReject>());
    let promise = new Promise<TNextResolve, TNextReject>((
      resolve: ResolveCallback<TNextResolve>,
      reject: RejectCallback<TNextReject>
    ) => {
      let message = changetype<Mailbox<ThenProcessContext<TResolve, TReject, TNextResolve, TNextReject>>>(0)
        .receive();
      assert(message.type == MessageType.Data);
      let ctx = message.unbox();
      let promiseValueMessage = ctx.process.request<
        PromiseEvent<TResolve, TReject>,
        RetreivePromiseValue<TResolve, TReject>
      >(new RetreivePromiseEvent<TResolve, TReject>());
      assert(promiseValueMessage.type == MessageType.Data);
      let promiseValue = promiseValueMessage.unbox();

      let value: Promise<TNextResolve, TNextReject> | null = null;

      if (ctx.thenCallback && promiseValue.resolve) {
        value = ctx.thenCallback!(promiseValue.resolve!.value);
      } 

      if (ctx.catchCallback && promiseValue.reject) {
        value = ctx.catchCallback!(promiseValue.reject!.value);
      }

      // TODO: figure out how to obtain the promise value in the current process
    });
    promise.value.sendUnsafe<ThenProcessContext<TResolve, TReject, TNextResolve, TNextReject>>(ctx);
    return promise;
  }

  __lunaticAwait(): TResolve {
    let result = this.value.request<PromiseEvent<TResolve, TReject>, TResolve>(
      new RetreivePromiseEvent<TResolve, TReject>()
    );
    assert(result.type == MessageType.Data);
    return result.unbox();
  }

  
  /** Utilized by ason to serialize a socket. */
  __asonSerialize(): StaticArray<u8> {
    this.value.send(new IncrementPromiseEvent<TResolve, TReject>());
    let buff = new StaticArray<u8>(sizeof<u64>());
    store<u64>(changetype<usize>(buff), this.value.id);
    return buff;
  }

  /** Utilized by ason to deserialize a socket. */
  __asonDeserialize(buff: StaticArray<u8>): void {
    let id = load<u64>(changetype<usize>(buff));
    // @ts-ignore: index
    htSet(changetype<usize>(this), id, Promise.decrementCallback().index);
  }
}
