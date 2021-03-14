export const enum ChannelReceivePrepareResult {
  Success = 0,
  Fail = 1,
}

export const enum ChannelReceiveResult {
  Success = 0,
  Fail = 1,
}

export const enum ChannelSendResult {
  Success = 0,
  Fail = 1,
}

// @ts-ignore: valid decorator here
@external("lunatic", "channel")
export declare function channel(bound: usize, receiver: usize): u32;

// @ts-ignore: valid decorator here
@external("lunatic", "channel_receive_prepare")
export declare function channel_receive_prepare(channel: u32, rec: usize): ChannelReceivePrepareResult;

// @ts-ignore: valid decorator here
@external("lunatic", "channel_receive")
export declare function channel_receive(buffer: usize, length: usize): ChannelReceiveResult;

// @ts-ignore: valid decorator here
@external("lunatic", "channel_send")
export declare function channel_send(channel: u32, buffer: usize, length: usize): ChannelSendResult;

// @ts-ignore: valid decorator ehre
@external("lunatic", "sender_serialize")
export declare function sender_serialize(channel_id: u32): u32;
// @ts-ignore: valid decorator ehre
@external("lunatic", "sender_deserialize")
export declare function sender_deserialize(channel_id: u32): u32;

// @ts-ignore: valid decorator ehre
@external("lunatic", "receiver_serialize")
export declare function receiver_serialize(channel_id: u32): u32;

// @ts-ignore: valid decorator ehre
@external("lunatic", "receiver_deserialize")
export declare function receiver_deserialize(channel_id: u32): u32;

// a static heap location reserved just for receiving data from lunatic
export const receive_length_pointer = memory.data(sizeof<u32>());

// A message channel object
@final export class Channel {
  public sender: u32 = 0;
  public receiver: u32 = 0;

  // create a brand new message channel
  public static create(bound: usize = 0): Channel {
    let result = new Channel();
    result.sender = channel(bound, changetype<usize>(result) + offsetof<Channel>("receiver"));
    return result;
  }

  // turns the u64 serialized ids into a Channel for sending and receiving
  public static deserialize(value: u64): Channel {
    let result = new Channel();
    let sender = <u32>(<u64>u32.MAX_VALUE & value);
    result.sender = sender_deserialize(sender);
    let receiver = <u32>(<u64>u32.MAX_VALUE & (value >>> 32));
    result.receiver = receiver_deserialize(receiver);
    return result;
  }

  // the sender_serialize and receiver_serialize methods are host methods, used to encode channel ids
  public serialize(): u64 {
    let sender = sender_serialize(this.sender);
    let receiver = receiver_serialize(this.receiver);
    return (<u64>sender) | (<u64>receiver << <u64>32);
  }

  // send some data
  public send(bytes: StaticArray<u8>): bool {
    return this.sendUnsafe(changetype<usize>(bytes), <usize>bytes.length);
  }

  @unsafe public sendUnsafe(ptr: usize, length: usize): bool {
    return channel_send(this.sender, ptr, length) == ChannelSendResult.Success;
  }

  public receive(): StaticArray<u8> | null {
    let prepareResult = channel_receive_prepare(this.receiver, receive_length_pointer);
    let length = load<u32>(receive_length_pointer);
    if (prepareResult == ChannelReceivePrepareResult.Fail) return null;
    let result = new StaticArray<u8>(length);
    channel_receive(changetype<usize>(result), length);
    return result;
  }
}