import { ASON } from "@ason/assembly";

/** This enum describes the result of calling channel_receive_prepare. */
export const enum ChannelReceivePrepareResult {
  /** There is a buffer payload to be received. */
  Success = 0,
  /** The channel was shut down. */
  Fail = 1,
}

/** This enum describes the result of calling the channel_receive function. */
export const enum ChannelReceiveResult {
  /** The buffer was written to memory. */
  Success = 0,
  /** Something was wrong. */
  Fail = 1,
}

/** This enum describes the result of calling the channel_send function. */
export const enum ChannelSendResult {
  /** The buffer was copied and sent to the channel. */
  Success = 0,
  /** Something went wrong. */
  Fail = 1,
}

/**
 * Create a channel with a given bound, and write the receiver
 * id to memory at the given receiver pointer.
 *
 * @param {usize} bound - The number of messages that can exist in this channel, (zero is unbounded.)
 * @param {usize} receiver - A pointer to four bytes of space, describing a u32 that represents the receiver id.
 * @returns {u32} - The u32 value that represents the sender id.
 */
// @ts-ignore: valid decorator here
@external("lunatic", "channel")
export declare function channel(bound: usize, receiver: usize): u32;

/**
 * In order to receive a message from a channel, the length of
 * the received buffer must be known. This function is called with
 * the channel receive id, and writes a usize value to memory describing
 * the length of the received buffer to the channel.
 *
 * @param {u32} channel - The receiving channel.
 * @param {usize} rec - A pointer to a `usize` that will contain the length
 * of the received buffer.
 * @returns {ChannelReceivePrepareResult} - The result of receiving a buffer from
 * the channel.
 */
// @ts-ignore: valid decorator here
@external("lunatic", "channel_receive_prepare")
export declare function channel_receive_prepare(channel: u32, rec: usize): ChannelReceivePrepareResult;

/**
 * Once the length of the received buffer is known, this method
 * accepts a pointer and a length to write the bytes to from the
 * host.
 *
 * @param {usize} buffer - A pointer to the buffer where the bytes should
 * be written.
 * @param {usize} length - The number of bytes to write.
 * @returns {ChannelReceiveResult} - The result of receiving the buffer.
 */
// @ts-ignore: valid decorator here
@external("lunatic", "channel_receive")
export declare function channel_receive(buffer: usize, length: usize): ChannelReceiveResult;

/**
 * Send a message to a send channel.
 *
 * @param {u32} channel - The send channel to send the message.
 * @param {usize} buffer - The pointer to the bytes being written.
 * @param {size} length - The number of bytes to write.
 *
 * @returns {ChannelSendResult} - The result of sending the message.
 */
// @ts-ignore: valid decorator here
@external("lunatic", "channel_send")
export declare function channel_send(channel: u32, buffer: usize, length: usize): ChannelSendResult;

/**
 * Serialize a sender channel.
 *
 * @param {u32} channel_id - The sender channel to be serialized.
 * @returns {u32} - The serialized sender channel value.
 */
// @ts-ignore: valid decorator here
@external("lunatic", "sender_serialize")
export declare function sender_serialize(channel_id: u32): u32;

/**
 * Deserialize a sender channel.
 *
 * @param {u32} channel_id - The serialized sender channel to deserialize.
 * @returns {u32} - The deserialized sender channel id.
 */
// @ts-ignore: valid decorator here
@external("lunatic", "sender_deserialize")
export declare function sender_deserialize(channel_id: u32): u32;


/**
 * Serialize a receiver channel.
 *
 * @param {u32} channel_id - The receiver channel to be serialized.
 * @returns {u32} - The serialized receiver channel value.
 */
// @ts-ignore: valid decorator here
@external("lunatic", "receiver_serialize")
export declare function receiver_serialize(channel_id: u32): u32;

/**
 * Deserialize a receiver channel.
 *
 * @param {u32} channel_id - The serialized receiver channel to deserialize.
 * @returns {u32} - The deserialized receiver channel id.
 */
// @ts-ignore: valid decorator here
@external("lunatic", "receiver_deserialize")
export declare function receiver_deserialize(channel_id: u32): u32;

/**
 * A static heap location reserved just for storing the length of
 * the received channel buffer.
 */
export const receive_length_pointer = memory.data(sizeof<u32>());

/**
 * A message channel with send and receive methods to serialize
 * and deserialize object references. Messages can be processed
 * and received on multiple processes on a First In First Out
 * basis.
 */
// @ts-ignore: (final decorator) A message channel object
@final export class Channel<T> {
  /** The sender id. */
  private sender: u32 = 0;
  /** The receiver id. */
  private receiver: u32 = 0;

  /** The last deserialized value, if `this.receive()` returns `true`. */
  public value: T = changetype<T>(0);

  /** The local serializer for this channel. */
  private serializer: ASON.Serializer<T> = new ASON.Serializer<T>();
  /** The local deserializer for this channel. */
  private deserializer: ASON.Deserializer<T> = new ASON.Deserializer<T>();

  public constructor(bound: usize = 0) {
    this.sender = channel(bound, changetype<usize>(this) + offsetof<Channel<T>>("receiver"));
  }

  /** A wrapper function that creates a new Channel object. */
  public static create<U>(bound: usize = 0): Channel<U> {
    let result = new Channel<U>(bound);
    return result;
  }

  /**
   * A public deserialize method used by the ASON library to
   * reconstruct the Channel objet on a receiving Process.
   *
   * @param {StaticArray<u8>} buffer - The serialized buffer to process.
   */
  public __asonDeserialize(buffer: StaticArray<u8>): void {
    let value = load<u64>(changetype<usize>(buffer));
    let sender = <u32>(<u64>u32.MAX_VALUE & value);
    this.sender = sender_deserialize(sender);
    let receiver = <u32>(<u64>u32.MAX_VALUE & (value >>> 32));
    this.receiver = receiver_deserialize(receiver);
    this.deserializer = new ASON.Deserializer<T>();
    this.serializer = new ASON.Serializer<T>();
  }

  /**
   * A public serialize method that returns a buffer containing
   * the serialized channel values.
   *
   * @returns {StaticArray<u8>} The serialized Channel in the form of a buffer.
   */
  public __asonSerialize(): StaticArray<u8> {
    let buffer = new StaticArray<u8>(sizeof<u64>());
    let sender = sender_serialize(this.sender);
    let receiver = receiver_serialize(this.receiver);
    store<u64>(changetype<usize>(buffer), (<u64>sender) | (<u64>receiver << <u64>32));
    return buffer;
  }

  /**
   * Send a given T to the Channel to be received elsewhere. If the Channel is
   * bounded, and it's full, this will block current Process execution.
   *
   * @param {T} value - The value to serialize and send.
   * @returns {bool} `true` if the send was successful.
   */
  public send(value: T): bool {
    let buffer = this.serializer.serialize(value);
    return channel_send(this.sender, changetype<usize>(buffer), buffer.length) == ChannelSendResult.Success;
  }

  /**
   * Block the current process and receive a `T` from the channel.
   *
   * @returns `true` if it was successful.
   */
  public receive(): bool {
    let prepareResult = channel_receive_prepare(this.receiver, receive_length_pointer);
    let length = load<u32>(receive_length_pointer);
    if (prepareResult == ChannelReceivePrepareResult.Success) {
      let result = new StaticArray<u8>(length);
      channel_receive(changetype<usize>(result), length);
      this.value = this.deserializer.deserialize(result);
      return true;
    }
    return false;
  }
}
