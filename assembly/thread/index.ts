import {
  channel_receive_prepare,
  channel_receive,
  receive_length_pointer,
  ChannelReceivePrepareResult,
} from "../channel/index";
import { OBJECT, TOTAL_OVERHEAD } from "rt/common";

const CHANNEL_INITIAL_PAYLOAD: u32 = 0;

const enum JoinResult {
  Success = 0,
  Fail = 1,
}

/** This unsafe method packs a callback and a payload of data into a single memory segment. The caller is required to free it manually. */
function packCallbackWithDataUnsafe(callback: i32, data: usize, length: usize): usize {
  let ptr = heap.alloc(length + sizeof<i32>());
  memory.copy(ptr + sizeof<i32>(), data, length);
  store<i32>(ptr, callback);
  return ptr;
}

// @ts-ignore: valid decorator
@external("lunatic", "detach_process")
declare function detach_process(pid: u32): void;

// @ts-ignore: valid decorator
@external("lunatic", "cancel_process")
declare function cancel_process(pid: u32): void;

// @ts-ignore: valid decorator
@external("lunatic", "join")
declare function join(pid: u32): JoinResult;

@unmanaged
class BoxWithCallback<T> {
  public callback: i32;
  // @ts-ignore: T will always be a number value
  public value: T = 0;
}

// @ts-ignore: valid external reference
@external("lunatic", "sleep_ms")
declare function sleep(ms: u64): void;

// @ts-ignore: valid decorator
@external("lunatic", "spawn_with_context")
declare function spawn_with_context(
  func: u32,
  buf_ptr: usize,
  buf_len: usize,
): u32;

export class Process {
  private _pid: u32 = 0;
  public get pid(): u32 { return this._pid; }

  public static sleep(ms: u64): void {
    sleep(ms);
  }

  /** This helper method spawns a Process with a simple boxed value of type T, must be integer or array. */
  private static spawnWithBox<T>(val: T, callback: (val: T) => void): Process {
    let box = changetype<BoxWithCallback<T>>(memory.data(offsetof<BoxWithCallback<T>>()));
    box.value = val;
    box.callback = callback.index;
    let threadCallback = (): void => {
      let box = memory.data(offsetof<BoxWithCallback<T>>());
      // Get the payload from channel 0
      let prepareResult = channel_receive_prepare(CHANNEL_INITIAL_PAYLOAD, receive_length_pointer);

      // get the payload length and assert it's the correct size
      let length = load<u32>(receive_length_pointer);
      if (prepareResult == ChannelReceivePrepareResult.Fail) return;
      assert(length == offsetof<BoxWithCallback<T>>());

      // obtain the static segment, callback, and val
      channel_receive(changetype<usize>(box), length);
      let index = load<i32>(box, offsetof<BoxWithCallback<T>>("callback"));
      let value = load<T>(box, offsetof<BoxWithCallback<T>>("value"));
      // start the thread
      call_indirect(index, value);
    };

    // send the box to the new thread
    let t = new Process();
    t._pid = spawn_with_context(
      threadCallback.index,
      changetype<usize>(box),
      // packed message is the size of T + usize
      offsetof<BoxWithCallback<T>>(),
    );
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
    let byteLength = load<i32>(changetype<usize>(val), offsetof<Array<T>>("length_")) << alignof<T>();

    let threadCallback = (): void => {
      // Get the payload and the length
      let prepareResult = channel_receive_prepare(CHANNEL_INITIAL_PAYLOAD, receive_length_pointer);
      if (prepareResult == ChannelReceivePrepareResult.Fail) return;
      let length = load<u32>(receive_length_pointer);

      // allocate space to receive the message, and receive it
      let messagePointer = heap.alloc(length);
      channel_receive(messagePointer, length);

      // obtain the payload
      let callback = load<i32>(messagePointer);
      let byteLength = length - sizeof<i32>();
      let arrayLength = byteLength >>> alignof<T>();

      // __newArray creates an array, memcopies the segment, and links it
      let array = __newArray(arrayLength, alignof<T>(), idof<Array<T>>(), changetype<usize>(messagePointer + sizeof<i32>()));
      // because the array can be garbage collected, we should pin it during execution,
      // @ts-ignore: treat it like a global to be safe
      __pin(array);

      // we've unpacked the data into the correct format
      heap.free(messagePointer);

      // start the thread
      call_indirect(callback, array);
      // @ts-ignore: finally unpin it
      __unpin(array);
    };

    // we need to pack the callback with the data
    let ptr = packCallbackWithDataUnsafe(
      callback.index,
      dataStart,
      <usize>byteLength,
    );

    // spawn a new process
    let t = new Process();
    t._pid = spawn_with_context(
      threadCallback.index,
      ptr,
      // packed message is the size of i32 (table index) + byteLength
      sizeof<i32>() + byteLength,
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
      callback.index,
      dataStart,
      byteLength,
    );

    let threadCallback = (): void => {
      // Get the payload from channel 0
      let prepareResult = channel_receive_prepare(CHANNEL_INITIAL_PAYLOAD, receive_length_pointer);
      if (prepareResult == ChannelReceivePrepareResult.Fail) return;

      // get the length, and allocate a location on the heap, and receive the message
      let length = load<u32>(receive_length_pointer);
      let messagePointer = heap.alloc(length);
      channel_receive(messagePointer, length);

      // obtain the callback, bytelength, and memcopy the data
      let callback = load<i32>(messagePointer);
      let byteLength = length - sizeof<i32>();
      let buffer = __newBuffer(byteLength, idof<ArrayBuffer>(), messagePointer + sizeof<i32>());
      // @ts-ignore: make sure buffer isn't collected
      __pin(buffer);
      // create the resulting typed array
      let result = __new(offsetof<T>(), idof<T>());
      // @ts-ignore: treat result like a global
      __pin(result);

      // readonly buffer: ArrayBuffer;
      store<usize>(result, buffer, offsetof<ArrayBufferView>("buffer"));
      __link(result, buffer, false); // references must be linked
      // @ts-ignore: now the buffer is linked, no longer a global
      __unpin(buffer);

      // @unsafe readonly dataStart: usize;
      store<usize>(result, buffer, offsetof<ArrayBufferView>("dataStart"));

      // readonly byteLength: i32;
      store<i32>(result, <i32>byteLength, offsetof<ArrayBufferView>("byteLength"));

      // we've unpacked the data into the correct format, free the allocation
      heap.free(messagePointer);
      // start the thread
      call_indirect(callback, result);
      // @ts-ignore: we treated the array like it's a global, so we need to unpin it
      __unpin(result);
    };

    // spawn the thread
    let t = new Process();
    t._pid = spawn_with_context(
      threadCallback.index,
      messagePtr,
      byteLength + sizeof<i32>(),
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
        // best guess
        size = offsetof<T>();
      }
    }

    // Pack the data into a buffer
    let messagePtr = packCallbackWithDataUnsafe(
      callback.index,
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
      let callback = load<i32>(messagePointer);
      let size = length - sizeof<i32>();

      let result: usize;

      if (isManaged<T>()) {
        // @ts-ignore: If the object is managed, we need to use __new() and pin it
        result = __pin(__new(size, idof<T>()));
      } else {
        result = heap.alloc(size);
      }

      // should heap.alloc() references be pinned too?

      // copy the remaining bytes into a reference
      memory.copy(result, messagePointer + sizeof<i32>(), size);

      // we've unpacked the data into the correct format
      heap.free(messagePointer);

      // start the thread
      call_indirect(callback, result);

      if (isManaged<T>()) {
        // @ts-ignore: no longer a global
        __unpin(result);
      }
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
      ERROR("Not Implemented: Thread spawn with ArrayLike value."); // for now, compile time error
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
