import { ASON } from "@ason/assembly";
import { message } from "../bindings";
import { MessageType } from "../util";

let emptyTagset = [] as StaticArray<i64>;

export class Message<TMessage> {
  public tag: i64 = 0;
  private buffer: StaticArray<u8> | null = null;

  constructor(
    public type: MessageType,
  ) {
    if (type == MessageType.Data) {
      let size = message.data_size();
      let data = new StaticArray<u8>(<i32>size);
      let count = message.read_data(changetype<usize>(data), <usize>data.length);
      assert(count == size);
      this.buffer = data;
      this.tag = message.get_tag();
    } else if (type == MessageType.Signal) {
      this.tag = message.get_tag();
    }
  }

  /**
   * Obtain the message value if and only if the message type is MessageType.Value.
   */
  get value(): TMessage {
    assert(this.type == MessageType.Data);
    return ASON.deserialize<TMessage>(this.buffer!);
  }
}

@unmanaged export class Mailbox<TMessage> {
  constructor() { ERROR("Cannot construct a mailbox."); }

  receive(tags: StaticArray<i64> | null = null, timeout: u32 = 0): Message<TMessage> {
    tags = tags || emptyTagset;
    let tagsLength = tags!.length;

    /**
     * Returns:
     * 0    if it's a data message.
     * 1    if it's a signal turned into a message.
     * 9027 if call timed out.
     */
    let type = message.receive(changetype<usize>(tags), tagsLength, timeout);
    return new Message(type);
  }
}
