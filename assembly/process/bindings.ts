import { CompileModuleErrCode, ErrCode } from "../util";

export namespace process {
  /**
   * Compile a module if the current module has permission to compile them.
   *
   *  0 on success - The ID of the newly created module is written to **id_ptr**
   *  1 on error   - The error ID is written to **id_ptr**
   * -1 in case the process doesn't have permission to compile modules.
   */
  // @ts-ignore: external is valid here
  @external("lunatic::process", "compile_module")
  export declare function compile_module(module_data_ptr: usize, module_data_len: usize, id_ptr: usize): CompileModuleErrCode;


  /**
   * Drops the module from resources.
   * Traps:
   * If the module ID doesn't exist.
   */
  // @ts-ignore: external is valid here
  @external("lunatic::process", "drop_module")
  export declare function drop_module(module_id: u64): void;

  /**
   * Create a config if the current process is allowed to create configs
   */
  // @ts-ignore: external is valid here
  @external("lunatic::process", "create_config")
  export declare function create_config(): i64;


  /**
   * Drop an existing config. Traps if the config doesn't exist in the resources.
   */
  // @ts-ignore: external is valid here
  @external("lunatic::process", "drop_config")
  export declare function drop_config(config_id: u64): void;

  /**
   * Set a configuration's maximum memory.
   */
  // @ts-ignore: external is valid here
  @external("lunatic::process", "config_set_max_memory")
  export declare function config_set_max_memory(config_id: u64, max_memory: u64): void;

  /**
   * Get a given configuration's maximum memory.
   */
  // @ts-ignore: external is valid here
  @external("lunatic::process", "config_get_max_memory")
  export declare function config_get_max_memory(config_id: u64): u64;

  /**
   * Set a configuration's maximum fuel.
   */
  // @ts-ignore: external is valid here
  @external("lunatic::process", "config_set_max_fuel")
  export declare function config_set_max_fuel(config_id: u64, max_fuel: u64): void;

  /**
   * Get a given configuration's maximum fuel.
   */
  // @ts-ignore: external is valid here
  @external("lunatic::process", "config_get_max_fuel")
  export declare function config_get_max_fuel(config_id: u64): u64;

  /**
   * Return wether a config can compile modules.
   */
  // @ts-ignore: external is valid here
  @external("lunatic::process", "config_can_compile_modules")
  export declare function config_can_compile_modules(config: u64): bool;

  /**
   * Sets wether a config can compile modules.
   */
  // @ts-ignore: external is valid here
  @external("lunatic::process", "config_set_can_compile_modules",)
  export declare function config_set_can_compile_modules(config: u64, can: bool): void;

  /**
   * Returns wether a config allows creation of configs.
   */
  // @ts-ignore: external is valid here
  @external("lunatic::process", "config_can_create_configs")
  export declare function config_can_create_configs(config: u64): bool;

  /**
   * Sets wether a config allows the creation of configs.
   */
  // @ts-ignore: external is valid here
  @external("lunatic::process", "config_set_can_create_configs")
  export declare function config_set_can_create_configs(config: u64, can: bool): void;

  /**
   * Gets wether a config allows the spawning of processes.
   */
  // @ts-ignore: external is valid here
  @external("lunatic::process", "config_can_spawn_processes")
  export declare function config_can_spawn_processes(config: u64): bool;

  /**
   * Sets wether a config allows the spawning of processes.
   */
  // @ts-ignore: external is valid here
  @external("lunatic::process", "config_set_can_spawn_processes")
  export declare function config_set_can_spawn_processes(config: u64, can: bool): void;


  /**
   * Spawns a new process using the passed in function inside a module as the entry point.
   *
   * If **link** is not 0, it will link the child and parent processes. The value of the **link**
   * argument will be used as the link-tag for the child. This means, if the child traps the parent
   * is going to get a signal back with the value used as the tag.
   *
   * If *config_id* or *module_id* have the value -1, the same module/config is used as in the
   * process calling this function.
   *
   * The function arguments are passed as an array with the following structure:
   * [0 byte = type ID; 1..17 bytes = value as u128, ...]
   * The type ID follows the WebAssembly binary convention:
   * - 0x7F => i32
   * - 0x7E => i64
   * - 0x7B => v128
   * If any other value is used as type ID, this function will trap.
   *
   * Returns:
   * 0 on success - The ID of the newly created process is written to **id_ptr**
   * 1 on error   - The error ID is written to **id_ptr**
   *
   * Traps:
   * If the module ID doesn't exist.
   * If the function string is not a valid utf8 string.
   * If the params array is in a wrong format.
   * If any memory outside the guest heap space is referenced.
   */
  // @ts-ignore: external is valid here
  @external("lunatic::process", "spawn")
  export declare function spawn(
    link: i64,
    config_id: u64,
    module_id: u64,
    func_str_ptr: usize,
    func_str_len: usize,
    params_ptr: usize,
    params_len: usize,
    id_ptr: usize,
  ): ErrCode;

  /**
   * Sleep the current process for a given number of milliseconds.
   */
  // @ts-ignore: external is valid here
  @external("lunatic::process", "sleep_ms")
  export declare function sleep_ms(ms: u64): void;

  /**
   *
   * Defines what happens to this process if one of the linked processes notifies us that it died.
   *
   * There are 2 options:
   * 1. `trap == 0` the received signal will be turned into a signal message and put into the mailbox.
   * 2. `trap != 0` the process will die and notify all linked processes of its death.
   *
   * The default behaviour for a newly spawned process is 2.
   */
  // @ts-ignore: external is valid here
  @external("lunatic::process", "die_when_link_dies")
  export declare function die_when_link_dies(trap: bool): void;

  /**
   * Returns the current process id for this process.
   */
  // @ts-ignore: external is valid here
  @external("lunatic::process", "process_id")
  export declare function process_id(): u64;

  /**
   * Returns the current environment id for this process.
   */
  // @ts-ignore: external is valid here
  @external("lunatic::process", "environment_id")
  export declare function environment_id(): u64;

  /**
   * Link current process to **process_id**. This is not an atomic operation, any of the 2 processes
   * could fail before processing the `Link` signal and may not notify the other.
   *
   * Traps:
   * If the process ID doesn't exist.
   */
  // @ts-ignore: external is valid here
  @external("lunatic::process", "link")
  export declare function link(tag: u64, process_id: u64): void;

  /**
   * Unlink current process from **process_id**. This is not an atomic operation.
   *
   * Traps:
   * If the process ID doesn't exist.
   */
  // @ts-ignore: external is valid here
  @external("lunatic::process", "unlink")
  export declare function unlink(process_id: u64): void;
 /**
  * Send a Kill signal to **process_id**.
  *
  * Traps:
  * If the process ID doesn't exist.
  */
  // @ts-ignore: external is valid here
  @external("lunatic::process", "kill")
  export declare function kill(process_id: u64): void;

  /**
   * Obtain a trace and retrieve the id.
   */
  // @ts-ignore
  @external("lunatic::process", "trace_get")
  export declare function trace_get(ptr: usize): void;

  /**
   * Obtain the size of a given trace.
   */
  // @ts-ignore
  @external("lunatic::process", "trace_get_size")
  export declare function trace_get_size(id: u64): usize;

  /**
   * Obtain the trace itself by its id and write it to the given pointer with the given length.
   */
  // @ts-ignore
  @external("lunatic::process", "trace_read")
  export declare function trace_read(id: u64, data_ptr: usize, data_len: usize): usize;

  /**
   * Drop a trace by its id.
   */
  // @ts-ignore
  @external("lunatic::process", "drop_trace")
  export declare function drop_trace(id: u64): void;

}