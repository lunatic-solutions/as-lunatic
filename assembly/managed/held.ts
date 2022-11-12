import { Mailbox, Message } from "../message";
import { Process } from "../process";
import { process } from "../process/bindings";
import { ASManaged, htDel, htGet, htSet } from "as-disposable/assembly";
import { MessageType } from "../message/util";


/** This class is used internally to box the value. */
export class HeldContext<T> {
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

/** Represents a request to manipulate the held value with a callback. */
export class ExecuteHeldEvent<T, U> extends HeldEvent<T> {
  constructor(
    public value: U,
    public callback: (value: U, ctx: HeldContext<T>) => void,
  ) {
    super();
  }

  handle(ctx: HeldContext<T>, msg: Message<HeldEvent<T>>): bool {
    this.callback(this.value, ctx);
    return false;
  }
}


/** Represents a value held on another process. */
export class Held<T> extends ASManaged {

  /** Create a held process. */
  static create<T>(value: T): Held<T> {
    // We need to tell the child process who owns it, and what value to hold
    let startCxt = new HeldStartContext<T>(Process.processID, value); 

    // create a new process
    let proc = Process.inheritSpawnWith<HeldStartContext<T>, HeldEvent<T>>(startCxt, (start: HeldStartContext<T>, mb: Mailbox<HeldEvent<T>>): void => {
      // box the held value
      let ctx = new HeldContext<T>(start.value);

      while (true) {
        // for each message
        trace("trying to receive held message");
        let message = mb.receive();

        switch (message.type) {
          case MessageType.Data: {
            // unbox the message and handle it
            let event = message.unbox();
            if (event.handle(ctx, message)) return;
            continue;
          }
          case MessageType.Signal:
            continue;
          default:
          case MessageType.Timeout: {
            continue;
          }
        }
      }
      // we expect the value 
    }).expect();

    // return the held
    return new Held<T>(proc);
  }

  /** Keeps track if the process is still perceived to be alive. */
  private get alive(): bool {
    return htGet(changetype<usize>(this)) != null;
  }

  constructor(public heldProcess: Process<HeldEvent<T>>) {
    // When the held is cleaned up, we kill the process remotely
    super(heldProcess.id, process.kill);
  }

  /** Get or set the value of type T. */
  get value(): T {
    assert(this.alive);
    let event = new ObtainHeldEvent<T>();
    trace("requesting the value");
    let message = this.heldProcess.request<ObtainHeldEvent<T>, T>(event, Process.replyTag++, 10000);
    assert(message.type == MessageType.Data);
    return message.unbox();
  }

  set value(value: T) {
    trace("setting value");
    assert(this.alive);
    let event = new ReplaceHeldEvent<T>(value);
    this.heldProcess.send(event);
  }

  execute<U>(value: U, callback: (value: U, ctx: HeldContext<T>) => void): void {
    trace("Executing.");
    let event = new ExecuteHeldEvent<T, U>(value, callback);
    this.heldProcess.send(event);
  }

  /** If the held value is no longer used, we can free the resouces safely. */
  kill(): void {
    if (this.alive) {
      this.heldProcess.kill();
      htDel(changetype<usize>(this));
    }
  }

  /** Used by ASON to safely serialize a Held<T>. */
  __asonSerialize(): StaticArray<u8> {
    // We need to create a process that holds onto the value properly
    let held = Held.create<T>(this.value);
    // we don't want to kill the process the moment it gets garbage collected
    held.preventFinalize();
    // get the return value
    let array = new StaticArray<u8>(sizeof<u64>());
    // store the process id
    store<u64>(changetype<usize>(array), held.heldProcess.id);
    return array;
  }

  /** Used by ASON to safely deserialize a Held<T>. */
  __asonDeserialize(array: StaticArray<u8>): void {
    // create the process object unsafely
    this.heldProcess = new Process<HeldEvent<T>>(load<u64>(changetype<usize>(array)),0);

    // @ts-ignore function index, used to set up the disposable callback
    htSet(changetype<usize>(this), this.heldProcess.id, process.kill.index);
  }
}
