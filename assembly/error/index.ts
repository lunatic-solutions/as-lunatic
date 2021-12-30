import { error } from "../bindings";
import { htSet } from "as-disposable";


/** A predefined location to store id and error output. */
export const idPtr = memory.data(sizeof<u64>());

/**
 * Obtain an error string from an error id. This function will trap if the
 * error id is not found. Then it drops the error on the host side.
 *
 * @param {u64} id - The error id.
 * @returns The error string.
 */
export function getError(id: u64): string {
  let len = error.string_size(id);
  let ptr = heap.alloc(len);
  error.to_string(id, ptr);

  // Errors are always droped by `Result<T>` now, so we shouldn't drop the error resource until it falls
  // out of scope.
  // error.drop_error(id);

  let value = String.UTF8.decodeUnsafe(ptr, len, false);
  heap.free(ptr);
  return value;
}

/** Represents the result of a lunatic call, that could have possibly errored. */
export class Result<T> {
  private errStr: string | null = null;

  constructor(
    /** The resulting value of the lunatic call. */
    public value: T,
    /** Used by the underlying lunatic call to identify an error if it exists. */
    private errId: u64 = u64.MAX_VALUE,
  ) {
    if (errId != u64.MAX_VALUE) htSet(changetype<usize>(this), errId, error.drop_error.index);
  }

  /**
   * Obtain the error string. Retreives the error string lazily, and caches it, dropping the error
   * resource.
   */
  get errorString(): string {
    let errId = this.errId;
    if (errId === u64.MAX_VALUE) return "";

    let errStr = this.errStr;

    if (errStr == null) {
      return (this.errStr = getError(errId))!;
    }

    return errStr!;
  }

  /** Panic if the value isn't truthy, using the message as the runtime error message. */
  assertUnwrap(message: string | null = null): T {
    if (this.errId != u64.MAX_VALUE) {
      assert(false, message ? message! : this.errStr!);
    }
    return this.value;
  }
}
