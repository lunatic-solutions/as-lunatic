import { error } from "../error";
import { add_finalize, LunaticManaged } from "../util";

// @ts-ignore
@external("lunatic::process", "create_config")
export declare function create_config(max_memory: u64, max_fuel: u64): u64;
// @ts-ignore
@external("lunatic::process", "drop_config")
export declare function drop_config(config_id: u64): void;
// @ts-ignore
@external("lunatic::process", "allow_namespace")
export declare function allow_namespace(config_id: u64, namespace_str_ptr: usize, namespace_str_len: u32): error.err_code;
// @ts-ignore
@external("lunatic::process", "preopen_dir")
export declare function preopen_dir(config_id: u64, dir_str_ptr: usize, dir_str_len: usize, id_ptr: usize): error.err_code;
// @ts-ignore
@external("lunatic::process", "create_environment")
export declare function create_environment(config_id: u64, id_ptr: usize): error.err_code;
// @ts-ignore
@external("lunatic::process", "drop_environment")
export declare function drop_environment(env_id: u64): void;
// @ts-ignore
@external("lunatic::process", "add_plugin")
export declare function add_plugin(config_id: u64, plugin_data_ptr: usize, plugin_data_len: u32, id_ptr: usize): error.err_code;
    // @ts-ignore
@external("lunatic::process", "add_module")
export declare function add_module(env_id: u64, module_data_ptr: usize, module_data_len: u32, id_ptr: usize): error.err_code;
    // @ts-ignore
@external("lunatic::process", "add_this_module")
export declare function add_this_module(env_id: u64, id_ptr: usize): error.err_code;
    // @ts-ignore
@external("lunatic::process", "drop_module")
export declare function drop_module(mod_id: u64): void;
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

export class Module extends LunaticManaged {
    constructor(
        public id: u64,
    ) {
        super();
        add_finalize(this);
    }

    /** Drop the module. */
    drop(): void {
        if (!this.dropped) {
            drop_module(this.id);
            this.dropped = true;
        }
    }
    
    /** Used by as-lunatic's __lunatic_finalize() function to assert the resource is dropped. */
    dispose(): void {
        this.drop();
    }
}

export class Environment extends LunaticManaged {
    constructor(
        public id: u64,
    ) {
        super();
        add_finalize(this);
    }

    /** Used by as-lunatic's __lunatic_finalize() function to assert the resource is dropped. */
    dispose(): void {
        this.drop();
    } 

    /**
     * Drop an environment.
     */
    drop(): void {
        if (!this.dropped) {
            drop_environment(this.id);
            this.dropped = true;
        }
    }

    /**
     * Add a module from an ArrayBuffer that represents a wasm module. If adding the module
     * fails, the `error.err_str` global will contain the error string.
     *
     * @param {Uint8Array} array The web assembly module.
     * @returns {error.Result<Module | null>} the module if it was successful.
     */
    addModuleBuffer(array: ArrayBuffer): error.Result<Module | null> {
        return this.addModuleUnsafe(changetype<usize>(array), <usize>array.byteLength);
    }

    /**
     * Add a module from a Uint8Array that represents a wasm module. If adding the module fails,
     * the `error.err_str` global will contain the error string.
     *
     * @param {Uint8Array} array The web assembly module.
     * @returns {error.Result<Module | null>} the module if it was successful.
     */
    addModuleArray(array: Uint8Array): error.Result<Module | null> {
        return this.addModuleUnsafe(array.dataStart, <usize>array.byteLength);
    }

    /**
     * Add a module from a StaticArray<u8> that represents a wasm module. If adding the module fails,
     * the `error.err_str` global will contain the error string.
     *
     * @param {StaticArray<u8>} array The web assembly module.
     * @returns {error.Result<Module | null>} the module if it was successful.
     */
    addModuleStaticArray(array: StaticArray<u8>): error.Result<Module | null> {
        return this.addModuleUnsafe(changetype<usize>(array), <usize>array.length);
    }

    /**
     * Add a plugin from a pointer and a length that represents a wasm module. If adding the Module
     * fails, the `error.err_str` global will contain the error string.
     *
     * @param {StaticArray<u8>} array The web assembly plugin.
     * @returns {error.Result<Module | null>} the module if it was successful.
     */
    addModuleUnsafe(bytes: usize, len: usize): error.Result<Module | null> {
        let result = add_module(this.id, bytes, len, id_ptr);
        let moduleId = load<u64>(id_ptr);
        if (result == error.err_code.Success) {
            return new error.Result<Module | null>(new Module(moduleId));
        }
        return new error.Result<Module | null>(null, moduleId);
    }

    /**
     * Add a module of the current kind to the environment.
     * 
     * @returns {error.Result<Module | null>} The module if it was successful.
     */
    addThisModule(): error.Result<Module | null> {
        let result = add_this_module(this.id, id_ptr);
        let moduleId = load<u64>(id_ptr);
        if (result == error.err_code.Success) {
            return new error.Result<Module | null>(new Module(moduleId));
        }
        return new error.Result<Module | null>(null, moduleId);
    }
}


// Configurations help create environments
export class Config extends LunaticManaged {
    private id: u64 = 0;
    private directories = new Map<string, u64>();

    constructor(max_memory: u64, max_fuel: u64) {
        super();
        this.id = create_config(max_memory, max_fuel);
        add_finalize(this);
    }

    /** Used by as-lunatic's __lunatic_finalize() function to assert the resource is dropped. */
    dispose(): void {
        this.drop();
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
        if (!this.dropped) {
            drop_config(this.id);
            this.dropped = true;
        }
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

    /**
     * Create an environment from the given configuration. If an environment cannot be created,
     * it will return `null` and write the error description to `error.err_str`.
     * 
     * @returns {error.Result<Environment | null>} The environment if it was successful.
     */
    createEnvironment(): error.Result<Environment | null> {
        let result = create_environment(this.id, id_ptr);
        let id = load<u64>(id_ptr);
        if (result == error.err_code.Success) {
            return new error.Result<Environment | null>(new Environment(id));
        }
        return new error.Result<Environment | null>(null, id);
    }

    /**
     * Add a plugin from an ArrayBuffer that represents a wasm module. If adding the plugin
     * fails, the `error.err_str` global will contain the error string.
     *
     * @param {Uint8Array} array The web assembly plugin.
     * @returns {error.Result<bool>} true if it was successful.
     */
    addPluginBuffer(array: ArrayBuffer): error.Result<bool> {
        return this.addPluginUnsafe(changetype<usize>(array), <usize>array.byteLength);
    }

    /**
     * Add a plugin from a Uint8Array that represents a wasm module. If adding the plugin fails,
     * the `error.err_str` global will contain the error string.
     *
     * @param {Uint8Array} array The web assembly plugin.
     * @returns {error.Result<bool>} true if it was successful.
     */
    addPluginArray(array: Uint8Array): error.Result<bool> {
        return this.addPluginUnsafe(array.dataStart, <usize>array.byteLength);
    }

    /**
     * Add a plugin from a StaticArray<u8> that represents a wasm module. If adding the plugin fails,
     * the `error.err_str` global will contain the error string.
     *
     * @param {StaticArray<u8>} array The web assembly plugin.
     * @returns {error.Result<bool>} true if it was successful.
     */
    addPluginStaticArray(array: StaticArray<u8>): error.Result<bool> {
        return this.addPluginUnsafe(changetype<usize>(array), <usize>array.length);
    }

    /**
     * Add a plugin from a pointer and a length that represents a wasm module. If adding the plugin
     * fails, the `error.err_str` global will contain the error string.
     *
     * @param {StaticArray<u8>} array The web assembly plugin.
     * @returns {error.Result<bool>} true if it was successful.
     */
    addPluginUnsafe(bytes: usize, len: usize): error.Result<bool> {
        let result = add_plugin(this.id, bytes, len, id_ptr);
        let pluginId = load<u64>(id_ptr);
        if (result == error.err_code.Success) {
            return new error.Result<bool>(true);
        }
        return new error.Result<bool>(false, pluginId);
    }
}
