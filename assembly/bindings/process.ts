import { ErrCode, LookupErrCode } from "../util";


export namespace process {
  /**
   * Create a configuration for an environment.
   *
   * @param {u64} max_memory - How much memory should be allocated to this config.
   * @param {u64} max_fuel - How much fuel can be used by this configuration.
   * @returns The configuration id.
   */
  // @ts-ignore
  @external("lunatic::process", "create_config")
  export declare function create_config(max_memory: u64, max_fuel: u64): u64;

  /**
   * Drop a configuration.
   *
   * @param {u64} config_id - The id of the configuration.
   */
  // @ts-ignore
  @external("lunatic::process", "drop_config")
  export declare function drop_config(config_id: u64): void;

  /**
   * Allow a set of function namespaces to be usable by the environments using
   * this configuration.
   *
   * @param {u64} config_id - The configuration.
   * @param {usize} namespace_str_ptr - A pointer to the namespace string.
   * @param {usize} namespace_str_len - How long the namespace string is in bytes.
   * @return {ErrCode} If the call was successful.
   */
  // @ts-ignore
  @external("lunatic::process", "allow_namespace")
  export declare function allow_namespace(config_id: u64, namespace_str_ptr: usize, namespace_str_len: u32): ErrCode;
  /**
   * Preopen a directory. Returns an error if the directory cannot be preopened.
   *
   * @param {u64} config_id - The configuration id.
   * @param {usize} dir_str_ptr - The directory to be preopened. (utf8)
   * @param {usize} dir_str_len - The length of `dir_str_ptr`.
   * @param {usuze} id_ptr - A pointer to a u64 to write an error if the directory cannot be preopened.
   * @returns Success if the directory was preopened.
   */
  // @ts-ignore
  @external("lunatic::process", "preopen_dir")
  export declare function preopen_dir(config_id: u64, dir_str_ptr: usize, dir_str_len: usize, id_ptr: usize): ErrCode;
  /**
   * Create an environment from the current configuration.
   *
   * @param {u64} config_id - The configuration id.
   * @param {usize} id_ptr - A pointer to a u64 that will either contain the error id,
   *                         or the environment id.
   * @returns Success if the environment was created.
   */
  // @ts-ignore
  @external("lunatic::process", "create_environment")
  export declare function create_environment(config_id: u64, id_ptr: usize): ErrCode;
  /**
   * Create a remote environment node.
   *
   * @param {u6} config_id - The configuration for the remote environment.
   * @param {usize} name_ptr - The name of the environment.
   * @param {usize} name_len - The size of the utf8 name string.
   * @param {usize} id_ptr - A pointer to a u64 that will contain the Environment id, or
   *                         the error id if the environment could not be created.
   * @returns {ErrCode} Success if the remote environment was created.
   */
  // @ts-ignore
  @external("lunatic::process", "create_remote_environment")
  export declare function create_remote_environment(config_id: u64, name_ptr: usize, name_len: usize, id_ptr: usize): ErrCode;
  /**
   * Drop an environment.
   *
   * @param {u64} env_id - The environment id.
   */
  // @ts-ignore
  @external("lunatic::process", "drop_environment")
  export declare function drop_environment(env_id: u64): void;
  /**
   * Add a plugin to a given configuration.
   *
   * @param {u64} config_id - The configuration id.
   * @param {usize} plugin_data_ptr - The wasm data pointer.
   * @param {usize} plugin_data_len - The size of the wasm buffer.
   * @param {usize} id_ptr - A pointer to write the plugin id, or an error.
   * @returns {ErrCode} Success if the plugin was added.
   */
  // @ts-ignore
  @external("lunatic::process", "add_plugin")
  export declare function add_plugin(config_id: u64, plugin_data_ptr: usize, plugin_data_len: u32, id_ptr: usize): ErrCode;
  /**
   * Create a module that will always be instantiated in the given environment.
   *
   * @param {usize} env_id - The environment the module runs in.
   * @param {usize} module_data_ptr - The module buffer.
   * @param {usize} module_data_len - The length of the module buffer.
   * @param {usize} id_ptr - A pointer to a u64 that will contain the id of the module, or an error id.
   * @returns {ErrCode} Success if the module was created.
   */
  // @ts-ignore
  @external("lunatic::process", "add_module")
  export declare function add_module(env_id: u64, module_data_ptr: usize, module_data_len: u32, id_ptr: usize): ErrCode;
  /**
   * Create a module that is the current module for the given environment.
   *
   * @param {u64} env_id - The environment to add this module to.
   * @param {usize} id_ptr - A pointer to a u64 that will contain either the module id, or the error id.
   * @returns {ErrCodee} - Success if the module was addedd successfully.
   */
  // @ts-ignore
  @external("lunatic::process", "add_this_module")
  export declare function add_this_module(env_id: u64, id_ptr: usize): ErrCode;
  /** Drop a module */
  // @ts-ignore
  @external("lunatic::process", "drop_module")
  export declare function drop_module(mod_id: u64): void;
  /**
   * Spawn a process, with a given link tag (if applicable,) a module, the name of the
   * function to run, and the given parameters in rust enum format.
   *
   * @param {u64} link - A tag for the process if applicable, if provided will automatically link the process.
   * @param {u64} module_id - The module id.
   * @param {usize} func_str_ptr - The name of the function.
   * @param {usize} func_str_len - The length of the name of the function.
   * @param {usize} params_ptr - A pointer to the parameters for this function written in memory.
   * @param {usize} params_len - The byteLength of the parameters.
   * @param {usize} id_ptr - A pointer to a u64 that will contain the process id, or the error it caused.
   * @returns {ErrCode} Success if the Process was created.
   */
  // @ts-ignore
  @external("lunatic::process", "spawn")
  export declare function spawn(link: u64, module_id: u64, func_str_ptr: usize, func_str_len: usize, params_ptr: usize, params_len: u32, id_ptr: usize): ErrCode;
  /**
   * Spawn a new Process from this module in this current environment.
   *
   * @param {u64} link - A tag to link this process to, if provided.
   * @param {usize} func_str_ptr - The name of the function to run.
   * @param {usize} func_str_len - The function name length.
   * @param {usize} params_ptr - The parameters struct.
   * @param {usize} params_len - The bytelength of the parameters.
   * @param {usize} id_ptr - A pointer to write the process id to, or the error if there is an error.
   * @returns {ErrCode} Success if the process was created.
   */
  // @ts-ignore
  @external("lunatic::process", "inherit_spawn")
  export declare function inherit_spawn(link: u64, func_str_ptr: usize, func_str_len: usize, params_ptr: usize, params_len: u32, id_ptr: usize): ErrCode;
  /** Drop a process by it's id. */
  // @ts-ignore
  @external("lunatic::process", "drop_process")
  export declare function drop_process(process_id: u64): void;
  /** Clone a process by it's id. */
  // @ts-ignore
  @external("lunatic::process", "clone_process")
  export declare function clone_process(process_id: u64): u64;
  /** Cause the current process to sleep for a given number of milliseconds. */
  // @ts-ignore
  @external("lunatic::process", "sleep_ms")
  export declare function sleep_ms(ms: u64): void;

  /**
   * Defines what happens to this process if one of the linked processes notifies us that it died.
   *
   * There are 2 options:
   * 1. `trap == false` the received signal will be turned into a signal message and put into the mailbox.
   * 2. `trap == true` the process will die and notify all linked processes of its death.
   *
   * Default option is `false`.
   *
   * @param {bool} trap - Defines how this current process should behave when a child process fails.
   */
  // @ts-ignore
  @external("lunatic::process", "die_when_link_dies")
  export declare function die_when_link_dies(trap: bool): void;
  /** Get this current process id. */
  // @ts-ignore
  @external("lunatic::process", "this")
  export declare function this_handle(): u64;
  /** Get this process's guid. */
  // @ts-ignore
  @external("lunatic::process", "id")
  export declare function id(pid: u64, ptr: usize): usize;
  /** Get this current process's environment. */
  // @ts-ignore
  @external("lunatic::process", "this_env")
  export declare function this_env(): u64;

  /** Link the given process to the current one with a given tag. */
  // @ts-ignore
  @external("lunatic::process", "link")
  export declare function link(tag: i64, process_id: u64): void;
  /** Unlink the given process. */
  // @ts-ignore
  @external("lunatic::process", "unlink")
  export declare function unlink(process_id: u64): void;
  /**
   * Register the given process with a name and version, for the given environment.
   *
   * @param {usize} name_ptr - The name to register the process.
   * @param {usize} name_len - The length of the name string in utf8.
   * @param {usize} version_ptr - The version string.
   * @param {usize} version_len - The length of the version string in utf8.
   * @param {u64} env_id - The environment to register the given process in.
   * @param {u64} process_id - The process to register.
   * @returns {ErrCode} Success if the process registration was successful.
   */
  // @ts-ignore
  @external("lunatic::process", "register")
  export declare function register(name_ptr: usize, name_len: usize, version_ptr: usize, version_len: usize, env_id: u64, process_id: u64): ErrCode;
  /**
   * Unregister a process in the given environment.
   *
   * @param {usize} name_ptr - The registration name.
   * @param {usize} name_len - The length of the registration name.
   * @param {usize} version_ptr - The process version.
   * @param {usize} version_len - The length of the process version.
   * @param {u64} env_id - The environment the registration currently exists in.
   */
  // @ts-ignore
  @external("lunatic::process", "unregister")
  export declare function unregister(name_ptr: usize, name_len: usize, version_ptr: usize, version_len: usize, env_id: u64): ErrCode;

  /**
   * Lookup a process id by name and by version.
   *
   * @param name_ptr - The name of the process.
   * @param name_len - The length of the name of the process.
   * @param query_ptr - The process version query using semver.
   * @param query_len - The length of the process version query.
   * @param id_u64_ptr - A pointer to write the process id to, or an error id.
   */
  // @ts-ignore
  @external("lunatic::process", "lookup")
  export declare function lookup(name_ptr: usize, name_len: u32, query_ptr: usize, query_len: u32, id_u64_ptr: usize): LookupErrCode;
}
