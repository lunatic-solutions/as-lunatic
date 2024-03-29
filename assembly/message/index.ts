import { ASON } from "@ason/assembly";
import { UnmanagedResult } from "../error";
import { Process } from "../process";
import { opaquePtr } from "../util";
import { message } from "./bindings";
import { MessageType } from "./util";

let emptyTagset = [] as StaticArray<i64>;

export class Box<T> { constructor(public value: T) {} }

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

  @unsafe constructor(
    public type: MessageType,
  ) {
    // if the message is a data message, read it
    if (type == MessageType.Data) {
      // get the buffer sizes
      let size = <usize>message.data_size();
      let bufferSize = size - sizeof<u64>();
      let count = message.read_data(opaquePtr, sizeof<u64>());
      assert(count == sizeof<u64>());
      this.sender = load<u64>(opaquePtr);

      let data = new StaticArray<u8>(<i32>bufferSize);
      message.read_data(changetype<usize>(data), bufferSize);

      // deserialize and obtain the message tag
      let value = ASON.deserialize<TMessage>(data);
      this.tag = message.get_tag();
      this.box = new Box<TMessage>(value);

      // signals have tags too, usually representing the process id that is signalling a parent
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

  /** Reply back to the process that sent this message with the given reply tag. This should be used with process.request() */
  reply<UMessage>(message: UMessage): void {
    let p = new Process<UMessage>(this.sender, Process.tag++);
    p.send(message, this.tag);
  }

  unbox(): TMessage {
    assert(this.type == MessageType.Data);
    return this.box!.value;
  }
}

/**
 * Represents a raw unsafe message with a buffer. This is unsafe to construct because
 * there might be host managed objects attached to the message that might need to be obtained.
 */
export class UnmanagedMessage {
  /** The number tag associated with this message. */
  public tag: i64 = 0;
  /** The internal buffer of this message. */
  public buffer: StaticArray<u8> | null = null;

  @unsafe constructor(
    public type: MessageType,
  ) {
    // if the message is a data message, read it
    if (type == MessageType.Data) {
      // get the buffer size
      let size = <usize>message.data_size();

      // obtain the buffer
      let buffer = new StaticArray<u8>(<i32>size);
      message.read_data(changetype<usize>(buffer), size);
      this.buffer = buffer;

      // obtain the message tag
      this.tag = message.get_tag();
      // signals have tags too, usually representing the process id that is signalling a parent
    } else if (type == MessageType.Signal) {
      this.tag = message.get_tag();
    }
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

  
  /**
   * Receive a raw message sent to this process.
   *
   * @param {StaticArray<i64> | null} tags - An array of tags, identifying the type of message to be received.
   * @param {u32} timeout - A timeout for receiving messages in milliseconds.
   * @returns {Message<TMessage>} A message to this process.
   */
  receiveUnsafe(tags: StaticArray<i64> | null = null, timeout: u64 = u64.MAX_VALUE): UnmanagedMessage {
    tags = tags || emptyTagset;
    let tagsLength = tags!.length;
    /**
     * Returns:
     * 0    if it's a data message.
     * 1    if it's a signal turned into a message.
     * 9027 if call timed out.
     */
    let type = message.receive(changetype<usize>(tags), tagsLength, timeout);

    return new UnmanagedMessage(type);
  }
}
