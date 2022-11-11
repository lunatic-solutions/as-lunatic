import { ErrCode, TimeoutErrCode } from "../util";

export namespace distributed {
  /** List the number of nodes. */
  // @ts-ignore: external is valid here
  @external("lunatic::distributed", "nodes_count")
  export declare function nodes_count(): u32;

  /**
   * Get the list of nodes, writes at most `nodes_len` number of `u64` values
   * into linear memory at `nodes_ptr`.
   */
  // @ts-ignore: decorator
  @external("lunatic::distributed", "get_nodes")
  export declare function get_nodes(nodes_ptr: usize, nodes_len: u32): u32;

  /** Get the current process's node_id. */
  // @ts-ignore: decorator
  @external("lunatic::distributed", "node_id")
  export declare function node_id(): u64;

  /** Get the current process's module_id. */
  // @ts-ignore: decorator
  @external("lunatic::distributed", "module_id")
  export declare function module_id(): u64;

  /**
   * Send the current message to a process with the given node and process id.
   */
  // @ts-ignore: decorator
  @external("lunatic::distributed", "send")
  export declare function send(node_id: u64, process_id: u64): ErrCode;


  /**
   * Send a request with a timeout.
   */
  // @ts-ignore: decorator
  @external("lunatic::distributed", "send_receive_skip_search")
  export declare function send_receive_skip_search(node_id: u64, process_id: u64, timeout: u64): TimeoutErrCode;

 /**
  * Similar to a local spawn, it spawns a new process using the passed in function inside a module
  * as the entry point. The process is spawned on a node with id `node_id`.
  *
  * If `config_id` is 0, the same config is used as in the process calling this function.
  *
  * The function arguments are passed as an array with the following structure:
  * [0 byte = type ID; 1..17 bytes = value as u128, ...]
  * The type ID follows the WebAssembly binary convention:
  *  - 0x7F => i32
  *  - 0x7E => i64
  *  - 0x7B => v128
  * If any other value is used as type ID, this function will trap.
  *
  * Returns:
  * * 0 on success - The ID of the newly created process is written to `id_ptr`
  * * 1 on error   - The error ID is written to `id_ptr`
  *
  * Traps:
  * * If the module ID doesn't exist.
  * * If the function string is not a valid utf8 string.
  * * If the params array is in a wrong format.
  * * If any memory outside the guest heap space is referenced.
  */
 // @ts-ignore: external is valid here
  @external("lunatic::distributed", "spawn")
  export declare function spawn(
    link: i64,
    node_id: u64,
    config_id: u64,
    module_id: u64,
    func_str_ptr: usize,
    func_str_len: usize,
    params_ptr: usize,
    params_len: usize,
    id_ptr: usize,
  ): ErrCode;
}