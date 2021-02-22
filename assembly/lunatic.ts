
import { BLOCK, BLOCK_OVERHEAD, OBJECT, TOTAL_OVERHEAD } from "rt/common";
import {
  proc_exit,
  fd_write,
  iovec,
  random_get
} from "bindings/wasi";

import {
  MAX_DOUBLE_LENGTH,
  decimalCount32,
  dtoa_buffered
} from "util/number";

// All of the following wasi implementations for abort, trace and seed are
// copied from:
// https://github.com/AssemblyScript/assemblyscript/blob/master/std/assembly/wasi/index.ts
// Apache License

// @ts-ignore: decorator
@global
export function __lunatic_abort(
  message: string | null = null,
  fileName: string | null = null,
  lineNumber: u32 = 0,
  columnNumber: u32 = 0
): void {
  // 0: iov.buf
  // 4: iov.buf_len
  // 8: len
  // 12: buf...
  const iovPtr: usize = 0;
  const lenPtr: usize = iovPtr + offsetof<iovec>();
  const bufPtr: usize = lenPtr + sizeof<usize>();
  changetype<iovec>(iovPtr).buf = bufPtr;
  var ptr = bufPtr;
  store<u64>(ptr, 0x203A74726F6261); ptr += 7; // 'abort: '
  if (message !== null) {
    ptr += String.UTF8.encodeUnsafe(changetype<usize>(message), message.length, ptr);
  }
  store<u32>(ptr, 0x206E6920); ptr += 4; // ' in '
  if (fileName !== null) {
    ptr += String.UTF8.encodeUnsafe(changetype<usize>(fileName), fileName.length, ptr);
  }
  store<u8>(ptr++, 0x28); // (
  var len = decimalCount32(lineNumber); ptr += len;
  do {
    let t = lineNumber / 10;
    store<u8>(--ptr, 0x30 + lineNumber % 10);
    lineNumber = t;
  } while (lineNumber); ptr += len;
  store<u8>(ptr++, 0x3A); // :
  len = decimalCount32(columnNumber); ptr += len;
  do {
    let t = columnNumber / 10;
    store<u8>(--ptr, 0x30 + columnNumber % 10);
    columnNumber = t;
  } while (columnNumber); ptr += len;
  store<u16>(ptr, 0x0A29); ptr += 2; // )\n
  changetype<iovec>(iovPtr).buf_len = ptr - bufPtr;
  fd_write(2, iovPtr, 1, lenPtr);
  proc_exit(255);
}

// @ts-ignore: decorator
@global
function __lunatic_trace( // eslint-disable-line @typescript-eslint/no-unused-vars
  message: string,
  n: i32 = 0,
  a0: f64 = 0,
  a1: f64 = 0,
  a2: f64 = 0,
  a3: f64 = 0,
  a4: f64 = 0
): void {
  // 0: iov.buf
  // 4: iov.buf_len
  // 8: len
  // 12: buf...
  var iovPtr = __alloc(offsetof<iovec>() + sizeof<usize>() + 1 + <usize>(max(String.UTF8.byteLength(message), MAX_DOUBLE_LENGTH << 1)));
  var lenPtr = iovPtr + offsetof<iovec>();
  var bufPtr = lenPtr + sizeof<usize>();
  changetype<iovec>(iovPtr).buf = bufPtr;
  store<u64>(bufPtr, 0x203A6563617274); // 'trace: '
  changetype<iovec>(iovPtr).buf_len = 7;
  fd_write(2, iovPtr, 1, lenPtr);
  changetype<iovec>(iovPtr).buf_len = String.UTF8.encodeUnsafe(changetype<usize>(message), message.length, bufPtr);
  fd_write(2, iovPtr, 1, lenPtr);
  if (n) {
    store<u8>(bufPtr++, 0x20); // space
    changetype<iovec>(iovPtr).buf_len = 1 + String.UTF8.encodeUnsafe(bufPtr, dtoa_buffered(bufPtr, a0), bufPtr);
    fd_write(2, iovPtr, 1, lenPtr);
    if (n > 1) {
      changetype<iovec>(iovPtr).buf_len = 1 + String.UTF8.encodeUnsafe(bufPtr, dtoa_buffered(bufPtr, a1), bufPtr);
      fd_write(2, iovPtr, 1, lenPtr);
      if (n > 2) {
        changetype<iovec>(iovPtr).buf_len = 1 + String.UTF8.encodeUnsafe(bufPtr, dtoa_buffered(bufPtr, a2), bufPtr);
        fd_write(2, iovPtr, 1, lenPtr);
        if (n > 3) {
          changetype<iovec>(iovPtr).buf_len = 1 + String.UTF8.encodeUnsafe(bufPtr, dtoa_buffered(bufPtr, a3), bufPtr);
          fd_write(2, iovPtr, 1, lenPtr);
          if (n > 4) {
            changetype<iovec>(iovPtr).buf_len = 1 + String.UTF8.encodeUnsafe(bufPtr, dtoa_buffered(bufPtr, a4), bufPtr);
            fd_write(2, iovPtr, 1, lenPtr);
          }
        }
      }
    }
    --bufPtr;
  }
  store<u8>(bufPtr, 0x0A); // \n
  changetype<iovec>(iovPtr).buf_len = 1;
  fd_write(2, iovPtr, 1, lenPtr);
  __free(iovPtr);
}

// @ts-ignore
@global
function __lunatic_seed(): f64 { // eslint-disable-line @typescript-eslint/no-unused-vars
  var temp = load<u64>(0);
  var rand: u64;
  do {
    random_get(0, 8); // to be sure
    rand = load<u64>(0);
  } while (!rand);
  store<u64>(0, temp);
  return reinterpret<f64>(rand);
}

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
function packCallbackWithDataUnsafe(callback: i32, data: usize, length: usize): usize {
  let ptr = heap.alloc(length + sizeof<i32>());
  memory.copy(ptr + sizeof<i32>(), data, length);
  store<i32>(ptr, callback);
  return ptr;
}

const CHANNEL_INITIAL_PAYLOAD: u32 = 0;

// @ts-ignore: valid external reference
@external("lunatic", "sleep_ms")
declare function sleep(ms: u64): void;

@unmanaged
export class BoxWithCallback<T> {
  public callback: i32;
  // T will always be a number value
  public value: T = 0;
}

@final export class Process {
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

      let messagePointer = heap.alloc(length);
      // __pin(messagePointer);
      channel_receive(messagePointer, length);

      // obtain the payload
      let callback = load<i32>(messagePointer);
      let byteLength = length - sizeof<i32>();
      let arrayLength = byteLength >>> alignof<T>();

      // __newArray creates an array, memcopies the segment, and links it
      let array = __newArray(arrayLength, alignof<T>(), idof<Array<T>>(), changetype<usize>(messagePointer + sizeof<i32>()));
      // because the array can be garbage collected, we should pin it during execution,
      // treat it like a global to be safe
      __pin(array);

      // we've unpacked the data into the correct format
      heap.free(messagePointer);

      // start the thread
      call_indirect(callback, array);
      // finally unpin it
      __unpin(array);
    };

    // we need to pack the callback with the data
    let ptr = packCallbackWithDataUnsafe(
      callback.index,
      dataStart,
      <usize>byteLength,
    );
    // we may want to pin it, todo: check with dcode
    // __pin(ptr);

    // spawn a new process
    let t = new Process();
    t._pid = spawn_with_context(
      threadCallback.index,
      ptr,
      // packed message is the size of i32 (table index) + byteLength
      sizeof<i32>() + byteLength,
    );

    // memory is sent, free heap memory, potentially unpin first
    // __unpin(ptr);
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
    // __pin(messagePtr)

    let threadCallback = (): void => {
      // Get the payload from channel 0
      let prepareResult = channel_receive_prepare(CHANNEL_INITIAL_PAYLOAD, receive_length_pointer);
      if (prepareResult == ChannelReceivePrepareResult.Fail) return;

      // get the length, and allocate a location on the heap
      let length = load<u32>(receive_length_pointer);
      let messagePointer = heap.alloc(length);
      // __pin(messagePointer)
      channel_receive(messagePointer, length);

      // obtain the callback, bytelength, and memcopy the data
      let callback = load<i32>(messagePointer);
      let byteLength = length - sizeof<i32>();
      let buffer = __newBuffer(byteLength, idof<ArrayBuffer>(), messagePointer + sizeof<i32>());
      __pin(buffer);
      // create the resulting typed array
      let result = __new(offsetof<T>(), idof<T>());
      __pin(result);

      // readonly buffer: ArrayBuffer;
      store<usize>(result, buffer, offsetof<ArrayBufferView>("buffer"));
      __link(result, buffer, false); // references must be linked
      __unpin(buffer);

      // @unsafe readonly dataStart: usize;
      store<usize>(result, buffer, offsetof<ArrayBufferView>("dataStart"));

      // readonly byteLength: i32;
      store<i32>(result, <i32>byteLength, offsetof<ArrayBufferView>("byteLength"));

      // we've unpacked the data into the correct format
      // __unpin(messagePointer)
      heap.free(messagePointer);
      // start the thread
      call_indirect(callback, result);
      // we treated the array like it's a global, so we need to unpin it
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
    // __unpin(messagePtr);
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
    // __pin(messagePtr)

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
        // If the object is managed, we need to use __new() and pin it
        result = __pin(__new(size, idof<T>()));
      } else {
        result = heap.alloc(size);
      }

      // should heap.alloc() references be pinned too?

      // copy the remaining bytes into a reference
      memory.copy(result, messagePointer + sizeof<i32>(), size);

      // we've unpacked the data into the correct format
      heap.free(messagePointer);
      // __unpin(messagePointer)

      // start the thread
      call_indirect(callback, result);

      if (isManaged<T>()) {
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
