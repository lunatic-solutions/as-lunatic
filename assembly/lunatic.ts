
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
declare function channel_send(channel: u32, buffer: usize, length: usize): ChannelSendResult;

// @ts-ignore: valid decorator ehre
@external("lunatic", "sender_serialize")
declare function sender_serialize(channel_id: u32): u32;
// @ts-ignore: valid decorator ehre
@external("lunatic", "sender_deserialize")
declare function sender_deserialize(channel_id: u32): u32;

// @ts-ignore: valid decorator ehre
@external("lunatic", "receiver_serialize")
declare function receiver_serialize(channel_id: u32): u32;

// @ts-ignore: valid decorator ehre
@external("lunatic", "receiver_deserialize")
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

  public sendUnsafe(ptr: usize, length: usize): bool {
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

/** This unsafe method packs a callback and a payload of data into a single memory segment. The caller is required to free it manually. */
function packCallbackWithDataUnsafe(callback: usize, data: usize, length: usize): usize {
  let ptr = heap.alloc(length + sizeof<usize>());
  memory.copy(ptr + sizeof<usize>(), data, length);
  store<usize>(ptr, callback);
  return ptr;
}

function packCallbackWithValue<T>(callback: usize, value: T): usize {
  if (!isInteger(value) || !isFloat(value)) ERROR("Cannot pack value of Type T. Must be an integer or float.");
  let ptr = heap.alloc(sizeof<usize>() + sizeof<T>());
  store<usize>(ptr, callback);
  store<T>(ptr, value, sizeof<usize>());
  return ptr;
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
    let ptr = packCallbackWithValue(changetype<usize>(callback), val);

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
      // packed message is the size of T + usize
      sizeof<usize>() + sizeof<T>(),
    );

    // must be freed manually
    heap.free(ptr);
    return t;
  }

  /** This method spawns a process that receives an array. T is the value type, to aid in type detection. */
  public static spawnWithArray<T>(val: Array<T>, callback: (val: T) => void): Process {
    // private buffer: ArrayBuffer;
    // private dataStart: usize;
    // private byteLength: i32;
    // private _length: i32;

    // we can obtain the dataStart and byteLength value doing a manual load here
    let dataStart = load<usize>(changetype<usize>(val), offsetof<Array<T>>("dataStart"));
    let byteLength = load<i32>(changetype<usize>(val), offsetof<Array<T>>("byteLength"));

    let threadCallback = (): void => {
      // Get the payload from channel 0
      let prepareResult = channel_receive_prepare(CHANNEL_INITIAL_PAYLOAD, receive_length_pointer);
      if (prepareResult == ChannelReceivePrepareResult.Fail) return;
      // get the payload length and assert it's the correct size
      let length = load<u32>(receive_length_pointer);

      let messagePointer = heap.alloc(length);

      channel_receive(messagePointer, length);

      let callback = changetype<(val: Array<T>) => void>(load<usize>(messagePointer));
      let byteLength = length - sizeof<usize>();
      let arrayLength = byteLength >>> alignof<T>();
      // __newArray creates an memcopied buffer and links it to an Array<T> with the given memory segment
      let array = __newArray(arrayLength, alignof<T>(), idof<Array<T>>(), changetype<usize>(messagePointer + sizeof<usize>()));

      // we've unpacked the data into the correct format
      heap.free(messagePointer);

      // start the thread
      callback(changetype<Array<T>>(array));
    };

    let ptr = packCallbackWithDataUnsafe(
      changetype<usize>(callback),
      dataStart,
      <usize>byteLength,
    );

    let t = new Process();
    t._pid = spawn_with_context(
      threadCallback.index,
      ptr,
      // packed message is the size of usize + byteLength
      sizeof<usize>() + byteLength,
    );
    heap.free(ptr);
    return t;
  }

  public static spawn<T>(val: T, callback: (val: T) => void): Process {
    // All of the following are inlined compile time checks, no performance loss
    if (isInteger<T>() || isFloat<T>()) {
      return Process.spawnWithBox(val, callback);
      // if T is an array, and the values are numbers
      // @ts-ignore: valueof<T> returns the propert type
    } else if (isArray(val) && (isInteger<valueof<T>>() || isFloat<valueof<T>>())) {
      // @ts-ignore: valueof<T> returns the propert type
      Process.spawnWithArray<valueof<T>>(val, callback);

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
