import { error } from "../error";

// @ts-ignore
@external("lunatic::process", "create_config")
export declare function create_config(max_memory: u64, max_fuel: u64): u64;
// @ts-ignore
@external("lunatic::process", "drop_config")
export declare function drop_config(config_id: u64): usize;
// @ts-ignore
@external("lunatic::process", "allow_namespace")
export declare function allow_namespace(config_id: u64, namespace_str_ptr: usize, namespace_str_len: u32): usize;
// @ts-ignore
@external("lunatic::process", "preopen_dir")
export declare function preopen_dir(config_id: u64, dir_str_ptr: usize, dir_str_len: usize, id_ptr: usize): error.err_code;
// @ts-ignore
@external("lunatic::process", "create_environment")
export declare function create_environment(config_id: u64, id_ptr: usize): usize
// @ts-ignore
@external("lunatic::process", "drop_environment")
export declare function drop_environment(env_id: u64): usize
// @ts-ignore
@external("lunatic::process", "add_plugin")
export declare function add_plugin(config_id: u64, plugin_data_ptr: usize, plugin_data_len: u32, id_ptr: usize): usize
    // @ts-ignore
@external("lunatic::process", "add_module")
export declare function add_module(env_id: u64, module_data_ptr: usize, module_data_len: u32, id_ptr: usize): usize
    // @ts-ignore
@external("lunatic::process", "add_this_module")
export declare function add_this_module(env_id: u64, id_ptr: usize): usize
    // @ts-ignore
@external("lunatic::process", "drop_module")
export declare function drop_module(mod_id: u64): usize
    // @ts-ignore
@external("lunatic::process", "spawn")
export declare function spawn(link: i64, module_id: u64, func_str_ptr: usize, func_str_len: u32, params_ptr: usize, params_len: u32, id_ptr: usize): usize
    // @ts-ignore
@external("lunatic::process", "inherit_spawn")
export declare function inherit_spawn(link: i64, func_str_ptr: usize, func_str_len: u32, params_ptr: usize, params_len: u32, id_ptr: usize): usize
    // @ts-ignore
@external("lunatic::process", "drop_process")
export declare function drop_process(process_id: u64): usize
    // @ts-ignore
@external("lunatic::process", "clone_process")
export declare function clone_process(process_id: u64): usize
    // @ts-ignore
@external("lunatic::process", "sleep_ms")
export declare function sleep_ms(ms: u64): usize // I'm not so sure about the return type of this one
    // @ts-ignore
@external("lunatic::process", "die_when_link_dies")
export declare function die_when_link_dies(trap: u32): void
    // @ts-ignore
@external("lunatic::process", "this")
export declare function _this(): u64
    // @ts-ignore
@external("lunatic::process", "id")
export declare function id(): usize
    // @ts-ignore
@external("lunatic::process", "this_env")
export declare function this_env(): u64
    // @ts-ignore
@external("lunatic::process", "link")
export declare function link(tag: i64, process_id: u64): usize
    // @ts-ignore
@external("lunatic::process", "unlink")
export declare function unlink(process_id: u64): usize
    // @ts-ignore
@external("lunatic::process", "register")
export declare function register(name_ptr: usize, name_len: u32, version_ptr: usize, version_len: u32, env_id: u64, process_id: u64): usize
    // @ts-ignore
@external("lunatic::process", "unregister")
export declare function unregister(name_ptr: usize, name_len: u32, version_ptr: usize, version_len: u32): usize
    // @ts-ignore
@external("lunatic::process", "lookup")
export declare function lookup(name_ptr: usize, name_len: u32, query_ptr: usize, query_len: u32, id_u64_ptr: usize): usize

/** A predefined location to store id output. */
const id_ptr = memory.data(sizeof<u64>());

// Configurations help create environments
export class Config {
    private id: u64
    private directories = new Map<string, u64>();

    constructor(max_memory: u64, max_fuel: u64) {
        this.id = create_config(max_memory, max_fuel)
    }

    /**
     * Allow a host namespace to be used.
     * 
     * @param {string} namespace - The lunatic namespace being allowed.
     * @returns {bool} true if the namespace was allowed.
     */
    allowNamespace(namespace: string): bool {
        let buff = String.UTF8.encode(namespace);
        return allow_namespace(this.id, changetype<usize>(buff), buff.byteLength) == error.err_code.Success;
    }

    /**
     * Drop a configuration
     */
    drop(): void {
        drop_config(this.id)
    }

    /**
     * Preopen a directory for filesystem use.
     * 
     * @param {string} directory
     * @returns {bool} true if the directory was preopened, otherwise it sets the error.err_str variable with the reason for failure.
     */
    preopenDir(directory: string): bool {
        // strings need to be encoded every time we pass them up to the host
        let dirStr = String.UTF8.encode(directory);
        // call preopen
        let result = preopen_dir(this.id, changetype<usize>(dirStr), dirStr.byteLength, id_ptr);
        let dirId  = load<u64>(id_ptr);
        if (result == error.err_code.Success) {
            this.directories.set(directory, dirId);
            error.err_str = null;
        }
        error.err_str = error.getError(dirId);
        return false;
    }
}