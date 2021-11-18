
/**
 * Obtain the length of an error string.
 *
 * @param {u64} id - The id of the error.
 * @returns {usize} The length of the string.
 */

import { add_finalize, LunaticManaged } from "../util";

// @ts-ignore: external is valid here
@external("lunatic::error", "string_size")
export declare function string_size(id: u64): usize;


/**
 * Write the utf8 string into memory.
 *
 * @param {u64} id - The error id.
 * @param {usize} ptr [*mut u8] The pointer to memory where it will be written.
 */
// @ts-ignore
@external("lunatic::error", "to_string")
export declare function to_string(id: u64, ptr: usize): void;

/**
 * Drop the error
 *
 * @param {u64} id - The error id.
 */
// @ts-ignore
@external("lunatic::error", "drop")
export declare function drop_error(id: u64): void;

export namespace error {
  export const enum err_code {
    Success,
    Fail,
  }

  export let err_str: string | null = "";

  /**
   * Obtain an error string from an error id. This function will trap if the
   * error id is not found. Then it drops the error on the host side.
   *
   * @param {u64} id - The error id.
   * @returns The error string.
   */
  export function getError(id: u64): string {
    let len = string_size(id);
    let ptr = heap.alloc(len);
    to_string(id, ptr);
    drop_error(id);
    let value = String.UTF8.decodeUnsafe(ptr, len, false);
    heap.free(ptr);
    return value;
  }

  /** Represents the result of a lunatic call, that could have possibly errored. */
  export class Result<T> extends LunaticManaged {
    private errStr: string | null = null;
    constructor(
      /** The resulting value of the lunatic call. */
      public value: T,
      /** Used by the underlying lunatic call to identify an error if it exists. */
      private errId: u64 = u64.MAX_VALUE,
    ) {
      super();
      add_finalize(this);
    }

    /** Obtain the error string */
    get errorString(): string {
      let errId = this.errId;
      if (errId === u64.MAX_VALUE) return "";

      let errStr = this.errStr; 

      if (errStr == null) {
        this.dropped = true;
        return this.errStr = getError(errId);
      }

      return errStr!;
    }

    /** Dispose the error string if it was allocated. */
    dispose(): void {
      if (!this.dropped && this.errId != u64.MAX_VALUE) {
        drop_error(this.errId);
        this.dropped = true;
      }
    }
  }
}
