import { Mailbox } from "../message";
import { MessageType } from "../message/util";
import { Process } from "../process";

/** Represents a shared map using the std lib hashmap. */
export class SharedMap<TValue> {

  /** The process that runs the hashmap. */
  private self: Process<SharedMapEvent> = Process.inheritSpawn((mb: Mailbox<SharedMapEvent>) => {
    let map = new Map<string, TValue>();
    while (true) {
      let message = mb.receive();
      if (message.type == MessageType.Data) {
        let event = message.box!.value;
        if (event instanceof GetSharedMapEvent) {
          let key = (<GetSharedMapEvent>event).key;
          message.reply<TValue>(map.get(key));
        } else if (event instanceof SetSharedMapEvent<TValue>) {
          let key = (<SetSharedMapEvent<TValue>>event).key;
          let value = (<SetSharedMapEvent<TValue>>event).value;
          map.set(key, value);
        } else if (event instanceof DeleteSharedMapEvent) {
          let key = (<DeleteSharedMapEvent>event).key;
          map.delete(key);
        } else if (event instanceof ClearSharedMapEvent) {
          map.clear();
        } else if (event instanceof HasSharedMapEvent) {
          const key = (<HasSharedMapEvent>event).key;
          message.reply<bool>(map.has(key));
        } else if (event instanceof SizeSharedMapEvent) {
          message.reply<i32>(map.size);
        } else if (event instanceof KeysSharedMapEvent) {
          message.reply<string[]>(map.keys());
        } else if (event instanceof ValuesSharedMapEvent) {
          message.reply<TValue[]>(map.values());
        }
      }
    }
  }).expect();

  /** Get a value based on the given key. */
  get(key: string): TValue {
    let event = new GetSharedMapEvent(key);
    let message = this.self.request<GetSharedMapEvent, TValue>(event);
    assert(message.type == MessageType.Data);
    return message.box!.value;
  }

  /** Set a value with a given key. */
  set(key: string, value: TValue): this {
    let event = new SetSharedMapEvent<TValue>(key, value);
    this.self.send(event);
    return this;
  }

  /** Delete a key. */
  delete(key: string): void {
    let event = new DeleteSharedMapEvent(key);
    this.self.send(event);
  }

  /** Clear the hashmap. */
  clear(): void {
    const event = new ClearSharedMapEvent();
    this.self.send(event);
  }

  /** Check to see if it has the key. */
  has(key: string): bool {
    const event = new HasSharedMapEvent(key);
    const message = this.self.request<HasSharedMapEvent, bool>(event);
    assert(message.type == MessageType.Data);
    return message.box!.value;
  }

  /** Get the size of the hashmap. */
  get size(): i32 {
    const event = new SizeSharedMapEvent();
    const message = this.self.request<SizeSharedMapEvent, i32>(event);
    assert(message.type == MessageType.Data);
    return message.box!.value;
  }

  /** Get all the keys in the hashmap. */
  keys(): string[] {
    const event = new KeysSharedMapEvent();
    const message = this.self.request<KeysSharedMapEvent, string[]>(event);
    assert(message.type == MessageType.Data);
    return message.box!.value;
  }

  /** Get all the values in the hashmap. */
  values(): TValue[] {
    const event = new ValuesSharedMapEvent();
    const message = this.self.request<ValuesSharedMapEvent, TValue[]>(event);
    assert(message.type == MessageType.Data);
    return message.box!.value;
  }
}

abstract class SharedMapEvent {}

class GetSharedMapEvent extends SharedMapEvent {
  constructor(
    public key: string
  ) {
    super();
  }
}

class DeleteSharedMapEvent extends SharedMapEvent {
  constructor(
    public key: string
  ) {
    super();
  }
}

class SetSharedMapEvent<TValue> extends SharedMapEvent {
  constructor(
    public key: string,
    public value: TValue,
  ) {
    super();
  }
}

class ClearSharedMapEvent extends SharedMapEvent {}

class HasSharedMapEvent extends SharedMapEvent {
  constructor(public key: string) {
    super();
  }
}

class SizeSharedMapEvent extends SharedMapEvent {}

class KeysSharedMapEvent extends SharedMapEvent {}

class ValuesSharedMapEvent extends SharedMapEvent {}
