const enum ChannelReceivePrepareResult {
  Success = 0,
  Fail = 1,
}

// @ts-ignore: valid decorator here
@external("lunatic", "channel_receive_prepare")
declare function channel_receive_prepare(channel: u32, rec: usize): ChannelReceivePrepareResult;

// @ts-ignore: valid decorator here
@external("lunatic", "channel_receive")
declare function channel_receive(buffer: StaticArray<u8>, length: usize): u32;

// a static heap location reserved just for receiving data from lunatic
const receive_length_pointer = memory.data(sizeof<u32>());

export namespace Channel {
  export function send(channel: u32, bytes: StaticArray<u8>): bool {
    return false;
  }

  export function receive(channel: u32): StaticArray<u8> | null {
    let prepareResult = channel_receive_prepare(channel, receive_length_pointer);
    let length = load<u32>(receive_length_pointer);
    if (prepareResult == ChannelReceivePrepareResult.Fail) return null;
    let result = new StaticArray<u8>(length);
    channel_receive(result, length);
    return result;
  }
}


