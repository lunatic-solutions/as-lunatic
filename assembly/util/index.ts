import { iovec } from "bindings/wasi";

//%  - 0x7F => i32
//%  - 0x7E => i64
//%  - 0x7B => v128
/** Predefined location to store tags for function parameters. */
// @ts-ignore: lazy decorator
@lazy const params = memory.data(51); // ( 16(v128) + 1(type) ) * 3(count)
// @ts-ignore: lazy decorator
@lazy let paramCount = 0;
// @ts-ignore: lazy decorator
@lazy let paramOffset = 0;

/** Unmanaged Tag class used for tagging parameters for remote function calls when starting a process. */
@unmanaged export class Parameters {
  static reset(): Parameters {
    paramCount = 0;
    paramOffset = 0;
    // Yes. This is a fake null reference
    return changetype<Parameters>(params);
  }

  /** Tag an i32 parameter. */
  i32(val: i32): Parameters {
    assert(paramCount < 3);
    paramCount++;
    store<u8>(params + paramOffset, <u8>0x7F);
    store<i32>(params + paramOffset, val, 1);
    paramOffset += 17;
    return this;
  }

  /** Tag an i64 parameter. */
  i64(val: i64): Parameters {
    assert(paramCount < 3);
    paramCount++;
    store<u8>(params + paramOffset, <u8>0x7E);
    store<i64>(params + paramOffset, val, 1);
    paramOffset += 17;
    return this;
  }

  /** Tag a v128 parameter. */
  v128(val: v128): Parameters {
    assert(paramCount < 3);
    paramCount++;
    store<u8>(params + paramOffset, <u8>0x7B);
    v128.store(params + paramOffset, val, 1);
    paramOffset += 17; // 16(v128) + 1
    return this;
  }

  get ptr(): usize {
    return params;
  }

  get byteLength(): usize {
    return paramCount * 17;
  }
}

/** IPAddress types defined by the lunatic runtime. */
export const enum IPType {
  None = 0,
  IPV4 = 4,
  IPV6 = 6,
}


/** The message type when calling `mailbox.receive()`. */
export const enum MessageType {
  /** Represents a data message, the value must be unpacked. */
  Data = 0,
  /** Represents a signal message, a process has been affected. */
  Signal = 1,
  /** A receive timeout means that no message was received. */
  Timeout = 9027,
}

/** Success enum to describe the results of syscalls. The value `0` is successful. */
export const enum ErrCode {
  Success,
  Fail,
}

/** A helper class for collecting iovecs. */
@unmanaged export class iovec_vector {
  private index: i32 = 0;
  private capacity: i32 = TCP_READ_VECTOR_INITIAL_COUNT;
  public vec: usize = heap.alloc(TCP_READ_VECTOR_INITIAL_COUNT * offsetof<iovec>());

  constructor() {}

  /** Push a buffer to be concatenated. */
  push(ptr: usize, len: usize): void {
    assert(this.index < this.capacity);
    let vec = changetype<iovec>(this.vec + <usize>(this.index++) * offsetof<iovec>());
    vec.buf = ptr;
    vec.buf_len = len;
  }

  /** Potentially increase the capacity to store buffers on this vector. */
  conditionallyIncreaseCapacity(): void {
    let capacity = this.capacity;
    if (this.index == this.capacity) {
      capacity = capacity << 1;
      this.vec = heap.realloc(this.vec, (<usize>capacity) * offsetof<iovec>());
      this.capacity = capacity;
    }
  }

  /** Finally concatenate the buffers into a managed static array, freeing the underlying pointers. */
  toStaticArray(): StaticArray<u8> {

    // sum up the buffer lengths
    let sum = 0;
    let count = this.index;
    let vec = this.vec;
    for (let i: usize = 0; i < count; i++) {
      sum += changetype<iovec>(vec + i * offsetof<iovec>()).buf_len;
    }

    // get the return value
    let reset = new StaticArray<u8>(<i32>sum);
    let running_ptr = changetype<usize>(reset);

    // copy each buffer
    for (let i: usize = 0; i < count; i++) {
      let buff = changetype<iovec>(vec + i * offsetof<iovec>()).buf;
      let len = changetype<iovec>(vec + i * offsetof<iovec>()).buf_len;
      memory.copy(running_ptr, buff, len);
      running_ptr += len;
      heap.free(buff); // free the buffer
    }

    this.index = 0;
    return reset;
  }

  /** Free the stored internal buffers without concatenating them. */
  freeChildren(): void {
    // free each child
    let vec = this.vec;
    let count = this.index;
    for (let i = 0; i < count; i++) {
      heap.free(changetype<iovec>(vec + i * offsetof<iovec>()).buf);
    }
    this.index = 0;
  }
}
