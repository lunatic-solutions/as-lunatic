const enum ChannelReceivePrepareResult {
  Success = 0,
  Fail = 1,
}

const enum ChannelReceiveResult {
  Success = 0,
  Fail = 1,
}

const enum ChannelSendResult {
  Success = 0,
  Fail = 1,
}

// @ts-ignore: valid decorator here
@external("lunatic", "channel")
declare function channel(bound: usize, receiver: usize): u32;

// @ts-ignore: valid decorator here
@external("lunatic", "channel_receive_prepare")
declare function channel_receive_prepare(channel: u32, rec: usize): ChannelReceivePrepareResult;

// @ts-ignore: valid decorator here
@external("lunatic", "channel_receive")
declare function channel_receive(buffer: StaticArray<u8>, length: usize): ChannelReceiveResult;

// @ts-ignore: valid decorator here
@external("lunatic", "channel_send")
declare function channel_send(channel: u32, buffer: StaticArray<u8>, length: usize): ChannelSendResult;

// @ts-ignore: valid decorator ehre
@external("lunatic", "sender_serialize")
declare function sender_serialize(channel_id: u32): u32;
// @ts-ignore: valid decorator ehre
@external("lunatic", "sender_serialize")
declare function sender_deserialize(channel_id: u32): u32;

// @ts-ignore: valid decorator ehre
@external("lunatic", "receiver_serialize")
declare function receiver_serialize(channel_id: u32): u32;

// @ts-ignore: valid decorator ehre
@external("lunatic", "receiver_serialize")
declare function receiver_deserialize(channel_id: u32): u32;

// a static heap location reserved just for receiving data from lunatic
const receive_length_pointer = memory.data(sizeof<u32>());


// The channel namespace
export namespace Channel {

  // A message channel object
  @final export class MessageChannel {
    public sender: u32 = 0;
    public receiver: u32 = 0;

    // turns the u64 serialized ids into a MessageChannel for sending and receiving
    public static deserialize(value: u64): MessageChannel {
      let result = new MessageChannel();
      result.sender = sender_deserialize(<u32>(u32.MAX_VALUE & value));
      result.receiver = receiver_deserialize(<u32>(u32.MAX_VALUE & (value >>> 32)));
      return result;
    }

    // the sender_serialize and receiver_serialize methods are host methods, used to encode channel ids
    public serialize(): u64 {
      return (<u64>sender_serialize(this.sender)) | (<u64>receiver_serialize(this.receiver) << 32);
    }

    // send some data
    public send(bytes: StaticArray<u8>): bool {
      return channel_send(this.sender, bytes, bytes.length) == ChannelSendResult.Success;
    }

    public receive(): StaticArray<u8> | null {
      let prepareResult = channel_receive_prepare(this.receiver, receive_length_pointer);
      let length = load<u32>(receive_length_pointer);
      if (prepareResult == ChannelReceivePrepareResult.Fail) return null;
      let result = new StaticArray<u8>(length);
      channel_receive(result, length);
      return result;
    }
  }

  // create a brand new message channel
  export function create(bound: usize = 0): MessageChannel {
    let result = new MessageChannel();
    result.sender = channel(bound, changetype<usize>(result) + offsetof<MessageChannel>("receiver"));
    return result;
  }
}
