import { iovec } from "bindings/wasi";
import { push, remove, has } from "./unmanagedLinkedList";


//%  - 0x7F => i32
//%  - 0x7E => i64
//%  - 0x7B => v128
/** Predefined location to store tags for function parameters. */
// @ts-ignore: lazy decorator
@lazy const params = memory.data(51); // ( 16(v128) + 1(type) ) * 3(count)
// @ts-ignore: lazy decorator
@lazy let param_count = 0;
// @ts-ignore: lazy decorator
@lazy let param_offset = 0;

/** Unmanaged Tag class used for tagging parameters for remote function calls when starting a process. */
@unmanaged export class Parameters {
  static reset(): Parameters {
    param_count = 0;
    param_offset = 0;
    // Yes. This is a fake null reference
    return changetype<Parameters>(params);
  }

  /** Tag an i32 parameter. */
  i32(val: i32): Parameters {
    assert(param_count < 3);
    param_count++;
    store<u8>(params + param_offset, <u8>0x7F);
    store<i32>(params + param_offset, val, 1);
    param_offset += 17;
    return this;
  }

  /** Tag an i64 parameter. */
  i64(val: i64): Parameters {
    assert(param_count < 3);
    param_count++;
    store<u8>(params + param_offset, <u8>0x7E);
    store<i64>(params + param_offset, val, 1);
    param_offset += 17;
    return this;
  }

  /** Tag a v128 parameter. */
  v128(val: v128): Parameters {
    assert(param_count < 3);
    param_count++;
    store<u8>(params + param_offset, <u8>0x7B);
    v128.store(params + param_offset, val, 1);
    param_offset += 17; // 16(v128) + 1
    return this;
  }

  get ptr(): usize {
    return params;
  }

  get byteLength(): usize {
    return param_count * 17;
  }
}

export const enum IPType {
  None = 0,
  IPV4 = 4,
  IPV6 = 6,
}

// @ts-ignore: global decorator
@global export function __lunatic_finalize(ptr: usize): void {
  let val = remove(ptr)
  if (val != null) {
    call_indirect(val.cb, val.held);
    heap.free(changetype<usize>(val));
  }
}

/** Set the finalization record for this reference. */
export function set_finalize(ptr: usize, held: u64, cb: u32): void {
  push(ptr, cb, held);
}

/** Check to see if a reference has a finalization record still. */
export function has_finalize(ptr: usize): bool {
  return has(ptr);
}

export const enum MessageType {
  Data = 0,
  Signal = 1,
  Timeout = 9027,
}

/** Success enum to describe the results of syscalls. The value `0` is successful. */
export const enum err_code {
  Success,
  Fail,
}

export abstract class LunaticManaged {

  constructor(
    held: u64,
    finalize: (val: u64) => void,
  ) {
    set_finalize(changetype<usize>(this), held, finalize.index);
  }

  get dropped(): bool {
    return has_finalize(changetype<usize>(this));
  }

  dispose(): void {
    if (has_finalize(changetype<usize>(this))) {
      __lunatic_finalize(changetype<usize>(this));
    }
  }

  preventFinalize(): void {
    remove(changetype<usize>(this));
  }
}

/** A helper class for collecting iovecs. */
@unmanaged export class iovec_vector {
  private index: i32 = 0;
  private capacity: i32 = TCP_READ_VECTOR_INITIAL_COUNT;
  public vec: usize = heap.alloc(TCP_READ_VECTOR_INITIAL_COUNT * offsetof<iovec>());

  constructor() {}

  push(ptr: usize, len: usize): void {
    assert(this.index < this.capacity);
    let vec = changetype<iovec>(this.vec + <usize>(this.index++) * offsetof<iovec>());
    vec.buf = ptr;
    vec.buf_len = len;
  }

  conditionally_increase_capacity(): void {
    let capacity = this.capacity;
    if (this.index == this.capacity) {
      capacity = capacity << 1;
      this.vec = heap.realloc(this.vec, (<usize>capacity) * offsetof<iovec>());
      this.capacity = capacity;
    }
  }

  to_static_array(): StaticArray<u8> {

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

  free_children(): void {
    // free each child
    let vec = this.vec;
    let count = this.index;
    for (let i = 0; i < count; i++) {
      heap.free(changetype<iovec>(vec + i * offsetof<iovec>()).buf);
    }
    this.index = 0;
  }
}
