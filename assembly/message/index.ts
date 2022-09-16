import { ASON } from "@ason/assembly";
import { message } from "./bindings";
import { MessageType } from "./util";

let emptyTagset = [] as StaticArray<i64>;

class Box<T> { constructor(public value: T) {} }

/** Represents a message received from a mailbox. */
export class Message<TMessage> {
  /** The number tag associated with this message. */
  public tag: i64 = 0;
  /** The internal buffer of this message. */
  private buffer: StaticArray<u8> | null = null;
  /** The received value. */
  public value: Box<TMessage> | null = null;

  constructor(
    public type: MessageType,
  ) {
    // if the message is a data message, read it
    if (type == MessageType.Data) {
      let size = message.data_size();
      let data = new StaticArray<u8>(<i32>size);
      let count = message.read_data(changetype<usize>(data), <usize>data.length);
      assert(count == size);
      this.buffer = data;
      this.tag = message.get_tag();
      this.value = new Box<TMessage>(ASON.deserialize<TMessage>(data));

      // signals have tags too, usually representing the resource id that is signalling a parent
    } else if (type == MessageType.Signal) {
      this.tag = message.get_tag();
    }
  }

  /**
   * Obtain the raw buffer.
   */
  get raw(): StaticArray<u8> {
    assert(this.type == MessageType.Data);
    return this.buffer!;
  }
}

/**
 * Mailbox is a dummy unmanaged reference, used to help receive messages of a specific type.
 * It cannot be constructed.
 */
@unmanaged export class Mailbox<TMessage> {
  constructor() { ERROR("Cannot construct a mailbox."); }

  /**
   * Receive a message sent to this process.
   *
   * @param {StaticArray<i64> | null} tags - An array of tags, identifying the type of message to be received.
   * @param {u32} timeout - A timeout for receiving messages in milliseconds.
   * @returns {Message<TMessage>} A message to this process.
   */
  receive(tags: StaticArray<i64> | null = null, timeout: u64 = u64.MAX_VALUE): Message<TMessage> {
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