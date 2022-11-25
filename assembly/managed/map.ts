import { Mailbox } from "../message";
import { MessageType } from "../message/util";
import { Process } from "../process";

export class SharedMap<TValue> {
  private self: Process<SharedMapEvent<TValue>> = Process.inheritSpawn((mb: Mailbox<SharedMapEvent<TValue>>) => {
    let map = new Map<string, TValue>();
    while (true) {
      let message = mb.receive();
      if (message.type == MessageType.Data) {
        let event = message.box!.value;
        if (event instanceof GetSharedMapEvent<TValue>) {
          let key = (<GetSharedMapEvent<TValue>>event).key;
          message.reply<TValue>(map.get(key));
        } else if (event instanceof SetSharedMapEvent<TValue>) {
          let key = (<SetSharedMapEvent<TValue>>event).key;
          let value = (<SetSharedMapEvent<TValue>>event).value;
          map.set(key, value);
        } else if (event instanceof DeleteSharedMapEvent<TValue>) {
          let key = (<DeleteSharedMapEvent<TValue>>event).key;
          map.delete(key);
        } else if (event instanceof ClearSharedMapEvent<TValue>) {
          map.clear();
        } else if (event instanceof HasSharedMapEvent<TValue>) {
          const key = (<HasSharedMapEvent<TValue>>event).key;
          message.reply<bool>(map.has(key));
        } else if (event instanceof SizeSharedMapEvent<TValue>) {
          message.reply<i32>(map.size);
        } else if (event instanceof KeysSharedMapEvent<TValue>) {
          message.reply<string[]>(map.keys());
        } else if (event instanceof ValuesSharedMapEvent<TValue>) {
          message.reply<TValue[]>(map.values());
        }
      }
    }
  }).expect();

  get(key: string): TValue {
    let event = new GetSharedMapEvent<TValue>(key);
    let message = this.self.request<GetSharedMapEvent<TValue>, TValue>(event);
    assert(message.type == MessageType.Data);
    return message.box!.value;
  }

  set(key: string, value: TValue): this {
    let event = new SetSharedMapEvent<TValue>(key, value);
    this.self.send(event);
    return this;
  }

  delete(key: string): void {
    let event = new DeleteSharedMapEvent<TValue>(key);
    this.self.send(event);
  }

  clear(): void {
    const event = new ClearSharedMapEvent<TValue>();
    this.self.send(event);
  }

  has(key: string): bool {
    const event = new HasSharedMapEvent<TValue>(key);
    const message = this.self.request<HasSharedMapEvent<TValue>, bool>(event);
    assert(message.type == MessageType.Data);
    return message.box!.value;
  }

  get size(): i32 {
    const event = new SizeSharedMapEvent<TValue>();
    const message = this.self.request<SizeSharedMapEvent<TValue>, i32>(event);
    assert(message.type == MessageType.Data);
    return message.box!.value;
  }

  keys(): string[] {
    const event = new KeysSharedMapEvent<TValue>();
    const message = this.self.request<KeysSharedMapEvent<TValue>, string[]>(event);
    assert(message.type == MessageType.Data);
    return message.box!.value;
  }

  values(): TValue[] {
    const event = new ValuesSharedMapEvent<TValue>();
    const message = this.self.request<ValuesSharedMapEvent<TValue>, TValue[]>(event);
    assert(message.type == MessageType.Data);
    return message.box!.value;
  }
}

abstract class SharedMapEvent<TValue> {}

class GetSharedMapEvent<TValue> extends SharedMapEvent<TValue> {
  constructor(
    public key: string
  ) {
    super();
  }
}

class DeleteSharedMapEvent<TValue> extends SharedMapEvent<TValue> {
  constructor(
    public key: string
  ) {
    super();
  }
}

class SetSharedMapEvent<TValue> extends SharedMapEvent<TValue> {
  constructor(
    public key: string,
    public value: TValue,
  ) {
    super();
  }
}

class ClearSharedMapEvent<TValue> extends SharedMapEvent<TValue> {}

class HasSharedMapEvent<TValue> extends SharedMapEvent<TValue> {
  constructor(public key: string) {
    super();
  }
}

class SizeSharedMapEvent<TValue> extends SharedMapEvent<TValue> {}

class KeysSharedMapEvent<TValue> extends SharedMapEvent<TValue> {}

class ValuesSharedMapEvent<TValue> extends SharedMapEvent<TValue> {}
