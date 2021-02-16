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

const enum SpawnWithContextResult {
  Success = 0,
  Fail = 1,
}

// @ts-ignore: valid decorator here
@external("lunatic", "channel")
declare function channel(bound: usize, receiver: usize): usize;

// @ts-ignore: valid decorator here
@external("lunatic", "channel_receive_prepare")
declare function channel_receive_prepare(channel: u32, rec: usize): ChannelReceivePrepareResult;

// @ts-ignore: valid decorator here
@external("lunatic", "channel_receive")
declare function channel_receive(buffer: StaticArray<u8>, length: usize): ChannelReceiveResult;

// @ts-ignore: valid decorator here
@external("lunatic", "channel_send")
declare function channel_send(channel: u32, buffer: StaticArray<u8>, length: usize): ChannelSendResult;

// @ts-ignore: valid decorator here
@external("lunatic", "sender_serialize")
declare function sender_serialize(channel_id: u32): u32;

// @ts-ignore: valid decorator here
@external("lunatic", "sender_serialize")
declare function sender_deserialize(channel_id: u32): u32;

// @ts-ignore: valid decorator here
@external("lunatic", "receiver_serialize")
declare function receiver_serialize(channel_id: u32): u32;

// @ts-ignore: valid decorator here
@external("lunatic", "receiver_serialize")
declare function receiver_deserialize(channel_id: u32): u32;

// @ts-ignore: valid decorator here
@external("lunatic", "spawn_with_context")
declare function spawn_with_context(fn: () => void, ptr: usize, size: usize): SpawnWithContextResult;

// @ts-ignore: valid decorator here
@external("lunatic", "cancel_process")
declare function cancel_process(pid: u32): void;


// a static heap location reserved just for receiving data from lunatic
const receive_length_pointer = memory.data(sizeof<u32>());

// mod stdlib {
//   #[link(wasm_import_module = "lunatic")]
//   extern "C" {
//       pub fn spawn_with_context(
//           function: unsafe extern "C" fn(),
//           buf_ptr: *const u8,
//           buf_len: usize,
//       ) -> u32;
// 
//       pub fn detach_process(pid: u32);
//       pub fn cancel_process(pid: u32);
//       pub fn join(pid: u32) -> u32;
//       pub fn sleep_ms(millis: u64);
//   }
// }

@unmanaged class BoxWithCallback<T> {
  value: T;
  callback: (value: T) => void;
}

const RECEIVE_INITIAL_PAYLOAD_CHANNEL = 0;

export namespace Process {
  export class Thread {
    // Make a thread sleep
    @external("lunatic", "sleep_ms")
    declare public static sleep(ms: u64): void;

    public static function start<T>(value: T, callback: (value: T) => void): Thread {
      if (isInteger<T>() || isFloat<T>()) {
        let box = new BoxWithCallback<T>();
        box.callback = callback;
        box.value = value;

        let funcRef = (): void => {
          let prepareResult = channel_receive_prepare(RECEIVE_INITIAL_PAYLOAD_CHANNEL, receive_length_pointer);
          let length = load<u32>(receive_length_pointer);
          if (prepareResult == ChannelReceivePrepareResult.Fail) return;
          // sanity check to make sure everything was boxed correctly
          assert(length == offsetof<BoxWithCallback<T>>());
          let ptr = __alloc(offsetof<BoxWithCallback<T>>());
          channel_receive(ptr, length);
          let ref = changetype<BoxWithCallback<T>>(ptr);
          ref.callback(ref.value);
          __free(ptr);
        };

        let pid = spawn_with_context(funcRef, changetype<usize>(box), offsetof<BoxWithCallback<T>>());
        __free(changetype<usize>(box));
        let t = changetype<Thread>(__new(offsetof<Thread>(), idof<Thread>()));
        t._pid = pid;
        return t;
      } else if (isArrayLike<T>()) {
        // depending on how the array works, maybe we can copy a slice of memory
        // If it extends ArrayBufferView, then it should be easily copied.

        // always need to assert isInteger<valueof<T>>() || isFloat<valueof<T>>(), because we can't process an array of references

      }
      // plain reference, do a memcopy
    }


    private _pid: u32;

    public get pid(): u32 { return this._pid; }

    public drop(): void {
      cancel_process(this.pid);
    }
  }


}

// The channel namespace
export namespace Channel {

  // A message channel object
  export class MessageChannel {
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
  export function create(bound: usize): MessageChannel {
    let result = new MessageChannel();
    result.sender = channel(bound, changetype<usize>(result) + offsetof<MessageChannel>("receiver"));
    return result;
  }
}
