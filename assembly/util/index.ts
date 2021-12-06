import { iovec } from "bindings/wasi";

export const enum IPType {
  None = 0,
  IPV4 = 4,
  IPV6 = 6,
}

/**
 * An internal finalization record for object disposal.
 */
export class FinalizationRecord {
  constructor(
    public held: u64,
    public cb: u32,
  ) {}
}

/**
 * A map of pointer to FinalizationRecord
 */
let finalizeMap = new Map<usize, FinalizationRecord>();

// @ts-ignore: global decorator
@global export function __lunatic_finalize(ptr: usize): void {
  if (finalizeMap.has(ptr)) {
    let record = finalizeMap.get(ptr);
    call_indirect(record.cb, record.held);
    finalizeMap.delete(ptr);
  }
}

/** Set the finalization record for this reference. */
export function set_finalize(ptr: usize, held: u64, cb: u32): void {
  finalizeMap.set(ptr, new FinalizationRecord(held, cb));
}

/** Check to see if a reference has a finalization record still. */
export function has_finalize(ptr: usize): bool {
  return finalizeMap.has(ptr);
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
    finalizeMap.delete(changetype<usize>(this));
  }
}

@unmanaged export class iovec_vector {
  private index: i32 = 0;
  private capacity: i32 = TCP_READ_VECTOR_INITIAL_COUNT;
  public vec = heap.alloc(TCP_READ_VECTOR_INITIAL_COUNT * offsetof<iovec>());

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