import { ASON } from "@ason/assembly";
import { Process } from "../process";
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
  public box: Box<TMessage> | null = null;
  /** The sender process. */
  public sender: u64 = 0;
  public replyTag: u64 = 0;

  constructor(
    public type: MessageType,
  ) {
    // if the message is a data message, read it
    if (type == MessageType.Data) {
      // read the message data
      let size = message.data_size();
      let tempPtr = heap.alloc(<usize>size);
      let count = message.read_data(tempPtr, <usize>size);
      assert(count == size);

      // set the raw buffer
      let dataLength = size - sizeof<u64>() * 2;
      let data = new StaticArray<u8>(<i32>dataLength);
      memory.copy(
        changetype<usize>(data),
        tempPtr + sizeof<u64>() * 2,
        <usize>dataLength,
      );
      this.buffer = data;

      // serialize
      let value = ASON.deserialize<TMessage>(data)
      this.tag = message.get_tag();
      this.box = new Box<TMessage>(value);

      // set the sender
      this.sender =  load<u64>(tempPtr);

      // set the reply tag
      this.replyTag = load<u64>(tempPtr, sizeof<u64>());

      // free heap allocation
      heap.free(tempPtr);

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

  reply<UMessage>(message: UMessage): void {
    let p = new Process<UMessage>(this.sender, Process.tag++);
    p.send(message);
  }

  unbox(): TMessage {
    assert(this.type == MessageType.Data);
    return this.box!.value;
  }
}

export class MessageWrapper<T> {
  constructor(
    public value: T,
    public sender: u64,
  ) {}
}

/**
 * Mailbox is a dummy unmanaged reference, used to help receive messages of a specific type.
 * It cannot be constructed.
 */
@unmanaged export class Mailbox<TMessage> {
  constructor() { ERROR("Cannot construct a mailbox."); }

  static create<TMessage>(): Mailbox<TMessage> {
    return changetype<Mailbox<TMessage>>(0);
  }

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