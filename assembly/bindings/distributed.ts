import { ErrCode, TimeoutErrCode } from "../util";
export namespace distributed {
  /** Returns the number of registered nodes */
  // @ts-ignore: decorator is valid here
  @external("lunatic::distributed", "nodes_count")
  export declare function nodes_count(): u32;
  
  /** Copy node ids into guest memory. Returns the number of nodes copied. */
  // @ts-ignore: decorator is valid here
  @external("lunatic::distributed", "get_nodes")
  export declare function get_nodes(ptr: usize, nodes_len: usize): u32;

  /**
   * Similar to a local spawn, it spawns a new process using the passed in function inside a module
   as the entry point. The process is spawned on a node with id `node_id`.
  
   If `config_id` is 0, the same config is used as in the process calling this function.
  
   The function arguments are passed as an array with the following structure:
   [0 byte = type ID; 1..17 bytes = value as u128, ...]
   The type ID follows the WebAssembly binary convention:
    - 0x7F => i32
    - 0x7E => i64
    - 0x7B => v128
   If any other value is used as type ID, this function will trap.
  
   Returns:
   * 0 on success - The ID of the newly created process is written to `id_ptr`
   * 1 on error   - The error ID is written to `id_ptr`
  
   Traps:
   * If the module ID doesn't exist.
   * If the function string is not a valid utf8 string.
   * If the params array is in a wrong format.
   * If any memory outside the guest heap space is referenced.
   * @param {u64} node_id- The node to spawn the function on
   * @param {i64} config_id - The configuration used to spawn the module.
   * @param {u64} module_id - The module to be spawned.
   * @param {usize} func_str_ptr - A pointer to a utf8 string that contains the exported function to call.
   * @param {usize} func_str_len - The size of the function string.
   * @param {usize} params_ptr - A pointer to the parameters used for the function.
   * @param {usize} params_len - The byte length of the parameters.
   * @param {usize} id_ptr - A pointer to write a 64 bit id, either the error code, or the distributed process id.
   */
  // @ts-ignore: decorator is valid here
  @external("lunatic::distributed", "spawn")
  export declare function spawn(
    node_id: u64,
    config_id: i64,
    module_id: u64,
    func_str_ptr: u32,
    func_str_len: u32,
    params_ptr: u32,
    params_len: u32,
    id_ptr: u32,
  ): ErrCode;

  /**
   * Sends the message in scratch area to a process running on a node with id `node_id`.
   *
   * There are no guarantees that the message will be received.
   * 
   * @param {u64} node_id - The node to send the message to.
   * @param {u64} process_id - The process to send the message to.
   */
  // @ts-ignore: external is valid here
  @external("lunatic::distributed", "send")
  export declare function send(node_id: u64, process_id: u64): void;

  /**
   * Sends the message to a process on a node with id `node_id` and waits for a reply,
   * but doesn't look through existing messages in the mailbox queue while waiting.
   * This is an optimization that only makes sense with tagged messages.
   * In a request/reply scenario we can tag the request message with an
   * unique tag and just wait on it specifically.
   *
   * This operation needs to be an atomic host function, if we jumped back into the guest we could
   * miss out on the incoming message before `receive` is called.
   *
   * If timeout is specified (value different from u64::MAX), the function will return on timeout
   * expiration with value 9027.
   *
   * Returns:
   * * 0    if message arrived.
   * * 9027 if call timed out.
   *
   * Traps:
   * * If it's called with wrong data in the scratch area.
   * * If the message contains resources
   *
   * @param {u64} node_id - The node to send the message to.
   * @param {u64} process_id - The process to send the message to.
   * @param {u64} timeout_duration - The timeout duration, or how long the current process should wait for a response.
   */
  // @ts-ignore
  @external("lunatic::distributed", "send_receive_skip_search")
  export declare function send_receive_skip_search(
    node_id: u64,
    process_id: u64,
    timeout_duration: u64,
  ): TimeoutErrCode;

  /**
   * Returns the id of the node that the current process is running on.
   */
  // @ts-ignore
  @external("lunatic::distributed", "node_id")
  export declare function node_id(): u64;

  /**
   * Returns id of the module that the current process is spawned from
   */
  // @ts-ignore
  @external("lunatic::distributed", "module_id")
  export declare function module_id(): u64;
}
