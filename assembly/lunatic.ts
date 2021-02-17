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

const enum JoinResult {
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
declare function channel_receive(buffer: usize, length: usize): ChannelReceiveResult;

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

// @ts-ignore: valid decorator
@external("lunatic", "detach_process")
declare function detach_process(pid: u32): void;

// @ts-ignore: valid decorator
@external("lunatic", "cancel_process")
declare function cancel_process(pid: u32): void;

// @ts-ignore: valid decorator
@external("lunatic", "join")
declare function join(pid: u32): JoinResult;

// a static heap location reserved just for receiving data from lunatic
const receive_length_pointer = memory.data(sizeof<u32>());

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
    channel_receive(changetype<usize>(result), length);
    return result;
  }
}

// @ts-ignore: valid decorator
@external("lunatic", "spawn_with_context")
declare function spawn_with_context(
  func: u32,
  buf_ptr: usize,
  buf_len: usize,
): u32;

// Special class used for boxing number values to be sent across threads
@unmanaged class BoxWithCallback<T> {
  val: T;
  callback: (val: T) => void;
}

const CHANNEL_INITIAL_PAYLOAD: u32 = 0;

// @ts-ignore: valid external reference
@external("lunatic", "sleep_ms")
declare function sleep(ms: u64): void;


@final export class Process {
  private _pid: u32 = 0;
  public get pid(): u32 { return this._pid; }

  public static sleep(ms: u64): void {
    sleep(ms);
  }

  private static spawnWithBox<T>(val: T, callback: (val: T) => void): Process {
    // static memory location beneath __heap_base. no heap allocations necessary
    let ptr = memory.data(offsetof<BoxWithCallback<T>>());
    // we need to put the value on the heap, so box the value and the callback together
    let box = changetype<BoxWithCallback<T>>(ptr);
    box.val = val;
    box.callback = callback;
    let t = new Process();
    let threadCallback = (): void => {
      // Get the payload from channel 0
      let prepareResult = channel_receive_prepare(CHANNEL_INITIAL_PAYLOAD, receive_length_pointer);
      // get the payload length and assert it's the correct size
      let length = load<u32>(receive_length_pointer);
      if (prepareResult == ChannelReceivePrepareResult.Fail) return;
      assert(length == offsetof<BoxWithCallback<T>>());
      // obtain the static segment just for this box, store the result
      let result = changetype<BoxWithCallback<T>>(memory.data(offsetof<BoxWithCallback<T>>()));
      channel_receive(changetype<usize>(result), length);

      // start the thread
      result.callback(result.val);
    };
    // send the box to the new thread
    t._pid = spawn_with_context(
      threadCallback.index,
      ptr,
      offsetof<BoxWithCallback<T>>()
    );
    return t;
  }

  public static spawn<T>(val: T, callback: (val: T) => void): Process {
    // All of the following are inlined compile time checks, no performance loss
    if (isInteger<T>() || isFloat<T>()) {
      return Process.spawnWithBox<T>(val, callback);
      // if T is an array, and the values are numbers
      // @ts-ignore: valueof<T> returns the propert type
    } else if (isArray(val) && (isInteger<valueof<T>>() || isFloat<valueof<T>>())) {
      ERROR("NOT IMPLEMENTED"); // for now, compile time error
      // if the value is a typed array
      // @ts-ignore: ArrayBufferView is a global concrete class
    } else if (val instanceof ArrayBufferView) {
      // obtain buffer data properties
      // @ts-ignore: byteLength is a valid property on ArrayBufferView
      let byteLength = <usize>val.byteLength;
      // @ts-ignore: unsafe, undocumented, but fastest way to obtain the data pointer
      let dataStart = val.dataStart;
      // allocate a new message, plus callback usize
      let messageLength = byteLength + sizeof<usize>();
      let messagePtr = __alloc(messageLength);
      // store the callback pointer and message contents
      store<usize>(messagePtr, changetype<usize>(callback));
      memory.copy(messagePtr + sizeof<usize>(), dataStart, byteLength);

      let threadCallback = (): void => {
        // Get the payload from channel 0
        let prepareResult = channel_receive_prepare(CHANNEL_INITIAL_PAYLOAD, receive_length_pointer);

        // get the payload length
        let length = load<u32>(receive_length_pointer);
        if (prepareResult == ChannelReceivePrepareResult.Fail) return;

        // simple unmanaged heap allocation of the given length, and receive the message
        let messagePtr = __alloc(length);
        channel_receive(messagePtr, length);

        let callback = changetype<(val: T) => void>(load<usize>(messagePtr));
        let byteLength = length - sizeof<usize>();
        // @ts-ignore: __pin is global but hidden
        let buffPtr = __new(byteLength, idof<ArrayBuffer>());
        // @ts-ignore: __pin is global but hidden
        let resultPtr = __new(offsetof<T>(), idof<T>());
        __link(resultPtr, buffPtr, false);
        // set the dataview properties
        store<usize>(resultPtr, buffPtr, offsetof<T>("dataStart"));
        store<i32>(resultPtr, <i32>byteLength, offsetof<T>("byteLength"));
        store<usize>(resultPtr, buffPtr, offsetof<T>("buffer"));

        // copy the data to the buffer
        memory.copy(buffPtr, messagePtr + sizeof<usize>(), byteLength);

        // start the thread
        callback(changetype<T>(resultPtr));

      };
      // spawn the thread
      let t = new Process();
      t._pid = spawn_with_context(
        threadCallback.index,
        messagePtr,
        messageLength,
      );

      // free the message
      __free(messagePtr);
      return t;
    } else if (isArrayLike(val)) {
      ERROR("NOT IMPLEMENTED"); // for now, compile time error
      // flat reference, perform a memcopy
    } else {
      ERROR("NOT IMPLEMENTED"); // for now, compile time error
    }
    ERROR("NOT IMPLEMENTED");
    return new Process();
  }

  public drop(): void {
    cancel_process(this._pid);
  }
  public detatch(): void {
    detach_process(this._pid);
  }
  public join(): bool {
    return join(this._pid) == JoinResult.Success;
  }
}
