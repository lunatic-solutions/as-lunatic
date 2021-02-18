import { Console } from "as-wasi";
import { BLOCK, BLOCK_OVERHEAD, OBJECT, TOTAL_OVERHEAD } from "rt/common";

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

/** This unsafe method packs a callback and a payload of data into a single memory segment. The caller is required to free it manually. */
function packCallbackWithDataUnsafe(callback: usize, data: usize, length: usize): usize {
  let ptr = heap.alloc(length + sizeof<usize>());
  memory.copy(ptr + sizeof<usize>(), data, length);
  store<usize>(ptr, callback);
  return ptr;
}

function packCallbackWithValue<T>(callback: usize, value: T): usize {
  // sanity compiler time check
  if (!isInteger(value) && !isFloat(value)) ERROR("Cannot pack value of Type T. Must be an integer or float.");
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

  /** This helper method spawns a Process with a simple boxed value of type T, must be integer or array. */
  private static spawnWithBox<T>(val: T, callback: (val: T) => void): Process {

    // box the callback and the value
    let ptr = packCallbackWithValue(changetype<usize>(callback), val);

    let threadCallback = (): void => {
      // Get the payload from channel 0
      let prepareResult = channel_receive_prepare(CHANNEL_INITIAL_PAYLOAD, receive_length_pointer);

      // get the payload length and assert it's the correct size
      let length = load<u32>(receive_length_pointer);
      if (prepareResult == ChannelReceivePrepareResult.Fail) return;
      assert(length == (sizeof<usize>() + sizeof<T>()));

      // this is a static memory segment, allocated below __heap_base
      let result = memory.data(sizeof<usize>() + sizeof<T>());

      // obtain the static segment, callback, and val
      channel_receive(result, length);
      let callback = changetype<(val: T) => void>(load<usize>(result));
      let val = load<T>(result, sizeof<usize>());

      // start the thread
      callback(val);
    };

    // send the box to the new thread
    let t = new Process();
    t._pid = spawn_with_context(
      threadCallback.index,
      ptr,
      // packed message is the size of T + usize
      sizeof<usize>() + sizeof<T>(),
    );

    // free the message pointer
    heap.free(ptr);
    return t;
  }

  /** This method spawns a process that receives an array. T is the value type, to aid in type detection. */
  private static spawnWithArray<T>(val: Array<T>, callback: (val: Array<T>) => void): Process {
    // private buffer: ArrayBuffer;
    // private dataStart: usize;
    // private byteLength: i32;
    // private _length: i32;

    // we can obtain the dataStart and byteLength value doing a manual load here
    let dataStart = load<usize>(changetype<usize>(val), offsetof<Array<T>>("dataStart"));
    let byteLength = load<i32>(changetype<usize>(val), offsetof<Array<T>>("byteLength"));

    let threadCallback = (): void => {
      // Get the payload and the length
      let prepareResult = channel_receive_prepare(CHANNEL_INITIAL_PAYLOAD, receive_length_pointer);
      if (prepareResult == ChannelReceivePrepareResult.Fail) return;
      let length = load<u32>(receive_length_pointer);

      let messagePointer = heap.alloc(length);

      channel_receive(messagePointer, length);

      let callback = changetype<(val: Array<T>) => void>(load<usize>(messagePointer));
      let byteLength = length - sizeof<usize>();
      let arrayLength = byteLength >>> alignof<T>();

      // __newArray creates an array, memcopies the segment, and links it
      let array = __newArray(arrayLength, alignof<T>(), idof<Array<T>>(), changetype<usize>(messagePointer + sizeof<usize>()));

      // we've unpacked the data into the correct format
      heap.free(messagePointer);

      // start the thread
      callback(changetype<Array<T>>(array));
    };

    // we need to pack the callback with the data
    let ptr = packCallbackWithDataUnsafe(
      changetype<usize>(callback),
      dataStart,
      <usize>byteLength,
    );

    // spawn a new process
    let t = new Process();
    t._pid = spawn_with_context(
      threadCallback.index,
      ptr,
      // packed message is the size of usize + byteLength
      sizeof<usize>() + byteLength,
    );

    // memory is sent, free heap memory
    heap.free(ptr);
    return t;
  }

  /** This method is a simple helper wrapper to spawn a child process that uses a typed array for work */
  private static spawnWithTypedArray<T>(val: T, callback: (val: T) => void): Process {
    // @ts-ignore: ArrayBufferView usage
    if (!(val instanceof ArrayBufferView)) ERROR("Cannot pack data of type T. Must be ArrayBufferView.");
    // @ts-ignore: ArrayBufferView usage
    let dataStart = val.dataStart;
    // @ts-ignore: ArrayBufferView usage
    let byteLength = <usize>val.byteLength;

    // Pack the data into a buffer
    let messagePtr = packCallbackWithDataUnsafe(
      changetype<usize>(callback),
      dataStart,
      byteLength,
    );

    let threadCallback = (): void => {
      // Get the payload from channel 0
      let prepareResult = channel_receive_prepare(CHANNEL_INITIAL_PAYLOAD, receive_length_pointer);
      if (prepareResult == ChannelReceivePrepareResult.Fail) return;

      // get the length, and allocate a location on the heap
      let length = load<u32>(receive_length_pointer);
      let messagePointer = heap.alloc(length);
      channel_receive(messagePointer, length);

      // obtain the callback, bytelength, and memcopy the data
      let callback = changetype<(val: T) => void>(load<usize>(messagePointer));
      let byteLength = length - sizeof<usize>();
      let buffer = __newBuffer(byteLength, idof<ArrayBuffer>(), messagePointer + sizeof<usize>());

      // create the resulting typed array
      let result = __new(offsetof<T>(), idof<T>());

      // readonly buffer: ArrayBuffer;
      store<usize>(result, buffer, offsetof<ArrayBufferView>("buffer"));
      __link(result, buffer, false); // references must be linked

      // @unsafe readonly dataStart: usize;
      store<usize>(result, buffer, offsetof<ArrayBufferView>("dataStart"));

      // readonly byteLength: i32;
      store<i32>(result, <i32>byteLength, offsetof<ArrayBufferView>("byteLength"));

      // we've unpacked the data into the correct format
      heap.free(messagePointer);

      // start the thread
      callback(changetype<T>(result));
    };

    // spawn the thread
    let t = new Process();
    t._pid = spawn_with_context(
      threadCallback.index,
      messagePtr,
      byteLength + sizeof<usize>(),
    );

    // free the message
    heap.free(messagePtr);
    return t;
  }

  /** Spawn a process with reference data. */
  private static spawnWithReference<T>(val: T, callback: (val: T) => void): Process {
    if (!isReference(val)) ERROR("Cannot spawn Process with type T, because T is not a reference.");
    // Even though we can confirm the offset of `T` at compile time, it's best to inspect the runtime size
    let valPtr = changetype<usize>(val);
    let size: usize;
    /**
     * If the reference is a static reference, best we can do perform a runtime check
     * and assume the size of T which can be obtained with offsetof<T>().
     */
    if (!(val instanceof StaticArray) && valPtr < __heap_base) {
      size = offsetof<T>();
    } else {
      // If the reference is managed, we can actually obtain the rtSize
      if (isManaged(val) || val instanceof StaticArray) {
        let obj = changetype<OBJECT>(valPtr - TOTAL_OVERHEAD);
        size = <usize>obj.rtSize;
        // unmanaged, no rt information, use offsetof<T>(), unsafe depending on T
      } else {
        size = offsetof<T>();
      }
    }

    // Pack the data into a buffer
    let messagePtr = packCallbackWithDataUnsafe(
      changetype<usize>(callback),
      valPtr,
      size,
    );

    let threadCallback = (): void => {
      // Get the payload from channel 0
      let prepareResult = channel_receive_prepare(CHANNEL_INITIAL_PAYLOAD, receive_length_pointer);
      if (prepareResult == ChannelReceivePrepareResult.Fail) return;

      // get the length, and allocate a location on the heap
      let length = load<u32>(receive_length_pointer);
      let messagePointer = heap.alloc(length);
      channel_receive(messagePointer, length);

      // obtain the callback, bytelength, and memcopy the data
      let callback = changetype<(val: T) => void>(load<usize>(messagePointer));
      let size = length - sizeof<usize>();

      // If the object is managed, we need to use __new()
      let result = isManaged<T>()
        ? __new(size, idof<T>())
        : heap.alloc(size);

      // copy the remaining bytes into a reference
      memory.copy(result, messagePointer + sizeof<usize>(), size);

      // we've unpacked the data into the correct format
      heap.free(messagePointer);

      // start the thread
      callback(changetype<T>(result));
    };

    // spawn the thread
    let t = new Process();
    t._pid = spawn_with_context(
      threadCallback.index,
      messagePtr,
      size + sizeof<usize>(),
    );

    // free the message
    heap.free(messagePtr);
    return t;
  }

  public static spawn<T>(val: T, callback: (val: T) => void): Process {
    // All of the following are inlined compile time checks, no performance loss
    if (isInteger(val) || isFloat(val)) {
      return Process.spawnWithBox(val, callback);
      // if T is an array, and the values are numbers
      // @ts-ignore: ArrayBufferView is a concrete global
    } else if (val instanceof ArrayBufferView) {
      return Process.spawnWithTypedArray<T>(val, callback);
      // @ts-ignore: valueof<T> returns the property type
    } else if (val instanceof Array) {
      // @ts-ignore: valueof<T> returns the property type
      return Process.spawnWithArray<valueof<T>>(val, callback);
    } else if (val instanceof StaticArray) {
      return Process.spawnWithReference(val, callback);
    } else if (isArrayLike(val)) {
      ERROR("Not Implement: Thread spawn with ArrayLike value."); // for now, compile time error
      // flat reference, perform a memcopy
      return new Process();
    } else {
      return Process.spawnWithReference(val, callback);
    }
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
