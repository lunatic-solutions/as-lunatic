import { Mailbox } from "../message";
import { MessageType } from "../message/util";
import { Process } from "../process";

export class SharedMap<TValue> {
  self: Process<SharedMapEvent<TValue>> = Process.inheritSpawn((mb: Mailbox<SharedMapEvent<TValue>>) => {
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

  set(key: string, value: TValue): void {
    let event = new SetSharedMapEvent<TValue>(key, value);
    this.self.send(event);
  }

  delete(key: string): void {
    let event = new DeleteSharedMapEvent<TValue>(key);
    this.self.send(event);
  }
}

export abstract class SharedMapEvent<TValue> {}

export class GetSharedMapEvent<TValue> extends SharedMapEvent<TValue> {
  constructor(
    public key: string
  ) {
    super();
  }
}

export class DeleteSharedMapEvent<TValue> extends SharedMapEvent<TValue> {
  constructor(
    public key: string
  ) {
    super();
  }
}

export class SetSharedMapEvent<TValue> extends SharedMapEvent<TValue> {
  constructor(
    public key: string,
    public value: TValue,
  ) {
    super();
  }
}