export namespace wasi {
    /**
     * Add an environment variable by it's key and value.
     * 
     * @param config_id - The configuration id.
     * @param key_ptr - The key pointer.
     * @param key_len - The length of the key.
     * @param value_ptr - The value pointer.
     * @param value_len - The length of the value.
     */
    @external("lunatic::wasi", "config_add_environment_variable")
    export declare function config_add_environment_variable(
      config_id: u64,
      key_ptr: usize,
      key_len: usize,
      value_ptr: usize,
      value_len: usize,
    ): void;

    /**
     * Add a command line argument.
     *
     * @param config_id 
     * @param argument_ptr 
     * @param argument_len 
     */
    @external("lunatic::wasi", "config_add_command_line_argument")
    export declare function config_add_command_line_argument(
      config_id: u64,
      argument_ptr: usize,
      argument_len: usize,
    ): void;

    /**
     * Preopen a directory for this configuration.
     *
     * @param config_id 
     * @param dir_ptr 
     * @param dir_len 
     */
    @external("lunatic::wasi", "config_preopen_dir")
    export declare function config_preopen_dir(
      config_id: u64,
      dir_ptr: u32,
      dir_len: u32,
    ): void;
}