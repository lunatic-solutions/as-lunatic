const enum ChannelReceivePrepareResult {
  Success = 0,
  Fail = 1,
}

const enum ChannelResult {
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
declare function channel(bound: usize, receiver: usize): ChannelResult;

// @ts-ignore: valid decorator here
@external("lunatic", "channel_receive_prepare")
declare function channel_receive_prepare(channel: u32, rec: usize): ChannelReceivePrepareResult;

// @ts-ignore: valid decorator here
@external("lunatic", "channel_receive")
declare function channel_receive(buffer: StaticArray<u8>, length: usize): ChannelReceiveResult;

// @ts-ignore: valid decorator here
@external("lunatic", "channel_send")
declare function channel_send(channel: u32, buffer: StaticArray<u8>, length: usize): ChannelSendResult;


// a static heap location reserved just for receiving data from lunatic
const receive_length_pointer = memory.data(sizeof<u32>());
// a static heap location reserved just for receiving data from lunatic
const receiver_pointer = memory.data(sizeof<u32>());

export namespace Channel {
  @unmanaged export class MessageChannel {
    get isValid(): bool {
      let channel_id = changetype<i32>(this);
      return channel_id != -1;
    }

    public send(bytes: StaticArray<u8>): bool {
      let channel_id = changetype<i32>(this);
      assert(channel_id !== -1);
      channel_send(<u32>channel_id, bytes, bytes.length);
      return false;
    }

    public receive(): StaticArray<u8> | null {
      let channel_id = changetype<i32>(this);
      assert(channel_id !== -1);

      let prepareResult = channel_receive_prepare(<u32>channel_id, receive_length_pointer);
      let length = load<u32>(receive_length_pointer);
      if (prepareResult == ChannelReceivePrepareResult.Fail) return null;
      let result = new StaticArray<u8>(length);
      channel_receive(result, length);
      return result;
    }
  }

  export function create(messageCount: usize): MessageChannel {
    let result = channel(messageCount, receiver_pointer);
    if (result == ChannelResult.Fail) return changetype<MessageChannel>(-1);
    return changetype<MessageChannel>(load<u32>(receiver_pointer));
  }
}
