export const enum err_code {
  Success,
  Fail,
}

/**
 * Obtain the length of an error string.
 *
 * @param {u64} id - The id of the error.
 * @returns {usize} The length of the string.
 */
// @ts-ignore: external is valid here
@external("lunatic", "string_size")
export declare function string_size(id: u64): usize;


/**
 * Write the utf8 string into memory.
 *
 * @param {u64} id - The error id.
 * @param {usize} ptr [*mut u8] The pointer to memory where it will be written.
 */
// @ts-ignore
@external("lunatic", "to_string")
export declare function to_string(id: u64, ptr: usize): void;

/**
 * Drop the error
 *
 * @param {u64} id - The error id.
 */
// @ts-ignore
@external("lunatic", "drop")
export declare function drop(id: u64): void;

/**
 * Obtain an error string from an error id.
 *
 * @param {u64} id - The error id.
 * @returns The error string.
 */
export function getError(id: u64): string {
  let len = string_size(id);
  let ptr = heap.alloc(len);
  to_string(id, ptr);
  drop(id);
  let value = String.UTF8.decodeUnsafe(ptr, len, false);
  heap.free(ptr);
  return value;
}
