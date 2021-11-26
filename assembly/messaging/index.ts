import { ASON } from "@ason/assembly";
import { Result } from "../error";
import { message } from "../bindings";
import { MessageType, ReceiveType } from "../util";

let emptyTagset = [] as StaticArray<i64>;

export class Message<TMessage> {
  constructor(
    public type: MessageType,
    public tag: i64,
  ) {}
  /**
   * Obtain the message value if and only if the message type is MessageType.Value.
   */
  get value(): TMessage {
    assert(this.type == MessageType.Value);
    let size = message.data_size();
    let data = new StaticArray<u8>();
    let count = message.read_data(changetype<usize>(data), <usize>data.length);
    assert(count == size);
    return ASON.deserialize<TMessage>(data);
  }
}

@unmanaged export class Mailbox<TMessage> {
  constructor() { ERROR("Cannot construct a mailbox."); }

  receive(tags: StaticArray<i64> | null = null, timeout: u32 = 0): Message<TMessage> {
    tags = tags || emptyTagset;
    let tagsLength = tags.length;

    /**
     * Returns:
     * 0    if it's a data message.
     * 1    if it's a signal turned into a message.
     * 9027 if call timed out.
     */
    let type = message.receive(changetype<usize>(tags), tagsLength, timeout);

    switch (type) {
      case ReceiveType.DataMessage: return new Message(MessageType.Value, message.get_tag());
      case ReceiveType.SignalMessage: return new Message(MessageType.Signal, message.get_tag());
    }
    return new Message(MessageType.Error, message.get_tag())
  }
}
