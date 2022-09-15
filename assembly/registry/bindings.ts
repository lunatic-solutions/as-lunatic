import { ErrCode } from "../util";

export namespace registry {
  /**
   * Registers process with ID under `name`.
   *
   * Traps:
   * * If the process ID doesn't exist.
   * * If any memory outside the guest heap space is referenced.
   */
  // @ts-ignore: external
  @external("lunatic::registry", "put")
  export declare function put(name_str_ptr: usize, name_str_len: usize, node_id: u64, process_id: u64): void;

  /**
   * Looks up process under `name` and returns 0 if it was found or 1 if not found.
   *
   * Traps:
   * * If any memory outside the guest heap space is referenced.
   */
  // @ts-ignore: external
  @external("lunatic::registry", "get")
  export declare function get(name_str_ptr: usize, name_str_len: usize, node_id_ptr: usize, process_id_ptr: usize): ErrCode
  /**
   * Removes process under `name` if it exists.
   *
   * Traps:
   * * If any memory outside the guest heap space is referenced.
   */
  // @ts-ignore: external
  @external("lunatic::registry", "remove")
  export declare function remove(name_str_ptr: u32, name_str_len: u32): void;
}