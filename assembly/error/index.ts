import { error } from "../bindings";
import { add_finalize, LunaticManaged } from "../util";

export let err_str: string | null = "";

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
  error.drop_error(id);
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

  /** Used by as-lunatic's __lunatic_finalize() function to assert the resource is dropped. */
  dispose(): void {
    this.drop();
  }

  /** Dispose the error string if it was allocated. */
  drop(): void {
    if (!this.dropped && this.errId != u64.MAX_VALUE) {
      error.drop_error(this.errId);
      this.dropped = true;
    }
  }
}
