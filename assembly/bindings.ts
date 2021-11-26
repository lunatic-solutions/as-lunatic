import { ReceiveType, err_code } from "./util";

export namespace process {
    // @ts-ignore
    @external("lunatic::process", "create_config")
    export declare function create_config(max_memory: u64, max_fuel: u64): u64;
    // @ts-ignore
    @external("lunatic::process", "drop_config")
    export declare function drop_config(config_id: u64): void;
    // @ts-ignore
    @external("lunatic::process", "allow_namespace")
    export declare function allow_namespace(config_id: u64, namespace_str_ptr: usize, namespace_str_len: u32): err_code;
    // @ts-ignore
    @external("lunatic::process", "preopen_dir")
    export declare function preopen_dir(config_id: u64, dir_str_ptr: usize, dir_str_len: usize, id_ptr: usize): err_code;
    // @ts-ignore
    @external("lunatic::process", "create_environment")
    export declare function create_environment(config_id: u64, id_ptr: usize): err_code;
    // @ts-ignore
    @external("lunatic::process", "drop_environment")
    export declare function drop_environment(env_id: u64): void;
    // @ts-ignore
    @external("lunatic::process", "add_plugin")
    export declare function add_plugin(config_id: u64, plugin_data_ptr: usize, plugin_data_len: u32, id_ptr: usize): err_code;
    // @ts-ignore
    @external("lunatic::process", "add_module")
    export declare function add_module(env_id: u64, module_data_ptr: usize, module_data_len: u32, id_ptr: usize): err_code;
    // @ts-ignore
    @external("lunatic::process", "add_this_module")
    export declare function add_this_module(env_id: u64, id_ptr: usize): err_code;
    // @ts-ignore
    @external("lunatic::process", "drop_module")
    export declare function drop_module(mod_id: u64): void;
    // @ts-ignore
    @external("lunatic::process", "spawn")
    export declare function spawn(link: u64, module_id: u64, func_str_ptr: usize, func_str_len: usize, params_ptr: usize, params_len: u32, id_ptr: usize): err_code;
    // @ts-ignore
    @external("lunatic::process", "inherit_spawn")
    export declare function inherit_spawn(link: u64, func_str_ptr: usize, func_str_len: u32, params_ptr: usize, params_len: u32, id_ptr: usize): err_code;
    // @ts-ignore
    @external("lunatic::process", "drop_process")
    export declare function drop_process(process_id: u64): void;
    // @ts-ignore
    @external("lunatic::process", "clone_process")
    export declare function clone_process(process_id: u64): u64;
    // @ts-ignore
    @external("lunatic::process", "sleep_ms")
    export declare function sleep_ms(ms: u64): void;
    // @ts-ignore
    @external("lunatic::process", "die_when_link_dies")
    export declare function die_when_link_dies(trap: u32): void
    // @ts-ignore
    @external("lunatic::process", "this")
    export declare function this_handle(): u64;
    // @ts-ignore
    @external("lunatic::process", "id")
    export declare function id(): usize
    // @ts-ignore
    @external("lunatic::process", "this_env")
    export declare function this_env(): u64;

    // @ts-ignore
    @external("lunatic::process", "link")
    export declare function link(tag: i64, process_id: u64): usize
    // @ts-ignore
    @external("lunatic::process", "unlink")
    export declare function unlink(process_id: u64): usize

    // @ts-ignore
    @external("lunatic::process", "register")
    export declare function register(name_ptr: usize, name_len: usize, version_ptr: usize, version_len: usize, env_id: u64, process_id: u64): err_code;
    // @ts-ignore
    @external("lunatic::process", "unregister")
    export declare function unregister(name_ptr: usize, name_len: usize, version_ptr: usize, version_len: usize, env_id: u64): err_code;

    // @ts-ignore
    @external("lunatic::process", "lookup")
    export declare function lookup(name_ptr: usize, name_len: u32, query_ptr: usize, query_len: u32, id_u64_ptr: usize): usize
}

export namespace message {
    // @ts-ignore: decorator
    @external("lunatic::message", "create_data")
    export declare function create_data(tag: i64, capacity: u64): void;
    // @ts-ignore: decorator
    @external("lunatic::message", "write_data")
    export declare function write_data(data: usize /* *const u8 */, data_len: usize): usize;
    // @ts-ignore: decorator
    @external("lunatic::message", "read_data")
    export declare function read_data(data: usize /* *mut u8 */, data_len: usize): usize;
    // @ts-ignore: decorator
    @external("lunatic::message", "seek_data")
    export declare function seek_data(position: u64): void;
    // @ts-ignore: decorator
    @external("lunatic::message", "get_tag")
    export declare function get_tag(): i64;
    // @ts-ignore: decorator
    @external("lunatic::message", "data_size")
    export declare function data_size(): u64;
    // @ts-ignore: decorator
    @external("lunatic::message", "push_process")
    export declare function push_process(process_id: u64): u64;
    // @ts-ignore: decorator
    @external("lunatic::message", "take_process")
    export declare function take_process(index: u64): u64;
    // @ts-ignore: decorator
    @external("lunatic::message", "push_tcp_stream")
    export declare function push_tcp_stream(tcp_stream_id: u64): u64;
    // @ts-ignore: decorator
    @external("lunatic::message", "take_tcp_stream")
    export declare function take_tcp_stream(index: u64): u64;
    // @ts-ignore: decorator
    @external("lunatic::message", "send")
    export declare function send(process_id: u64): void;
    // @ts-ignore: decorator
    @external("lunatic::message", "send_receive_skip_search")
    export declare function send_receive_skip_search(process_id: u64, timeout: u32): u32;
    // @ts-ignore: decorator
    @external("lunatic::message", "receive")
    export declare function receive(tag: usize /* *const i64 */, tag_len: usize, timeout: u32): ReceiveType;
}

export namespace error {

    /**
     * Obtain the length of an error string.
     *
     * @param {u64} id - The id of the error.
     * @returns {usize} The length of the string.
     */
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
}
