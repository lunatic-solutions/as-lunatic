import { Result, err_code } from "../error";
import { add_finalize, LunaticManaged } from "../util";
import {
    create_data,
    push_process,
    send,
    send_receive_skip_search,
    take_process,
    write_data,
} from "../messaging";
import { ASON } from "@ason/assembly";

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

/** A predefined location to store id output. */
const id_ptr = memory.data(sizeof<u64>());

//%  - 0x7F => i32
//%  - 0x7E => i64
//%  - 0x7B => v128
/** Predefined location to store tags for function parameters. */
const params = memory.data(51); // ( 16(v128) + 1(type) ) * 3(count)
let param_count = 0;
let param_offset = 0;

/** Unmanaged Tag class used for tagging parameters for remote function calls when starting a process. */
@unmanaged export class Tag {
    static reset() {
        param_count = 0;
        param_offset = 0;
        // Yes. This is a fake null reference
        return changetype<Tag>(params);
    }

    /** Tag an i32 parameter. */
    i32(val: i32): Tag {
        assert(param_count < 3);
        param_count++;
        store<u8>(params + param_offset, <u8>0x7F);
        store<i32>(params + param_offset, val, 1);
        param_offset += sizeof<i32>() + 1;
        return this;
    }

    /** Tag an i64 parameter. */
    i64(val: i64): Tag {
        assert(param_count < 3);
        param_count++;
        store<u8>(params + param_offset, <u8>0x7E);
        store<i64>(params + param_offset, val, 1);
        param_offset += sizeof<i64>() + 1;
        return this;
    }

    /** Tag a v128 parameter. */
    v128(val: v128): Tag {
        assert(param_count < 3);
        param_count++;
        store<u8>(params + param_offset, <u8>0x7B);
        v128.store(params + param_offset, val, 1);
        param_offset += 17; // 16(v128) + 1
        return this;
    }
}


const bootstrap_utf8 = [0x5f, 0x5f, // "__"
    0x6c, 0x75, 0x6e, 0x61, 0x74, 0x69, 0x63, // "lunatic"
    0x5f, // "_"
    0x70, 0x72, 0x6f, 0x63, 0x65, 0x73, 0x73, // "process"
    0x5f, // "_"
    0x62, 0x6f, 0x6f, 0x74, 0x73, 0x74, 0x72, 0x61, 0x70, // "bootstrap"
] as StaticArray<u8>;


let pid = id();

export class Process<TMessage> extends LunaticManaged {

    /**
     * Sleep the current process for ms number of milliseconds.
     * 
     * @param {u64} ms - The number of milliseconds to sleep for.
     */
    static sleep(ms: u64): void {
        sleep_ms(ms);
    }

    /**
     * Spawn a process from a module, and provide up to three function parameters with a tag.
     * 
     * @param {Module} module - The module being spawned
     * @param {string} func - The exported function name being called
     * @param {Tag} tag - The function parameters
     * @returns {Result<Process<StaticArray<u8>> | null>} the result of creating a process, or an error string.
     */
    static spawn(module: Module, func: string, tag: Tag): Result<Process<StaticArray<u8>> | null> {
        // utf8 string is required
        let buff = String.UTF8.encode(func);

        let result = spawn(
            // parent is this process
            pid,

            // load the module id, because it's private
            load<u64>(changetype<usize>(module), offsetof<Module>("id")),

            // function name
            changetype<usize>(buff),
            <usize>buff.byteLength,

            // process tag, function parameters
            changetype<usize>(tag),
            param_count,

            // output id
            id_ptr,
        );
        
        // obtain the id, error, or process id
        let id = load<u64>(id_ptr);
        if (result == err_code.Success) {
            return new Result<Process<StaticArray<u8>> | null>(new Process(id));
        }
        return new Result<Process<StaticArray<u8>> | null>(null, id);
    }

    /**
     * Create a process from the same module as the currently running one, with a single callback.
     * 
     * @param {() => void} func - The callback for the process. 
     * @returns {Result<Process | null>} the process if the creation was successful.
     */
    static inherit_spawn<TMessage>(func: () => void): Result<Process<TMessage> | null> {
        // store the function pointer bytes little endian (lower bytes in front)
        let params = Tag.reset()
            .i32(func.index);

        let result = inherit_spawn(
            pid,
            changetype<usize>(bootstrap_utf8),
            <usize>bootstrap_utf8.length,
            changetype<usize>(params),
            1, // we know it's 1
            id_ptr,
        );
        let spawnID = load<u64>(id_ptr);

        if (result == err_code.Success) {
            return new Result<Process<TMessage> | null>(new Process(spawnID));
        }
        return new Result<Process<TMessage> | null>(null, spawnID);
    }

    constructor(
        private id: u64,
    ) {
        super();
        add_finalize(this);
    }

    /**
     * Send a message with an optional tag.
     * 
     * @param {TMessage} message - The message being sent.
     * @param {i64} tag - The message tag.
     */
    send(message: TMessage, tag: i64 = 0): void {
        let buffer = ASON.serialize<TMessage>(message);
        let bufferLength = <usize>buffer.length;
        create_data(tag, bufferLength);
        write_data(changetype<usize>(buffer), bufferLength);
        send(this.id);
    }

    /**
     * Send a message with a request acknowledgement.
     * 
     * @param {TMessage} message - The message being sent.
     * @param {u32} timeout - The timeout in milliseconds.
     */
    request(message: TMessage, timeout: u32 = 0): void {
        let buffer = ASON.serialize<TMessage>(message);
        let bufferLength = <usize>buffer.length;
        create_data(0, bufferLength);
        write_data(changetype<usize>(buffer), bufferLength);
        send_receive_skip_search(this.id, timeout);
    }

    /** Drop a process. */
    drop(): void {
        if (!this.dropped) {
            this.dropped = true;
            drop_process(this.id);
        }
    }

    /** Used by as-lunatic's __lunatic_finalize() function to assert the resource is dropped. */
    dispose(): void {
        this.drop();
    }

    /** Clone a process, returns null if the process has already been dropped. */
    clone(): Process<TMessage> | null {
        if (this.dropped) return null;
        return new Process(clone_process(this.id));
    }

    /** Utilized by ason to serialize a process. */
    __asonSerialize(): StaticArray<u8> {
        let result = new StaticArray<u8>(sizeof<u64>());
        let cloned = this.clone()!;
        store<u64>(changetype<usize>(result), push_process(cloned.id));
        cloned.dropped = true;
        return result;
    }

    /** Utilized by ason to deserialize a process. */
    __asonDeserialize(buffer: StaticArray<u8>): void {
        assert(buffer.length == sizeof<u64>());
        this.id = take_process(load<u64>(changetype<usize>(buffer)));
    }
}

export class Module extends LunaticManaged {
    constructor(
        private id: u64,
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
        private id: u64,
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
     * fails, the `err_str` global will contain the error string.
     *
     * @param {Uint8Array} array The web assembly module.
     * @returns {Result<Module | null>} the module if it was successful.
     */
    addModuleBuffer(array: ArrayBuffer): Result<Module | null> {
        return this.addModuleUnsafe(changetype<usize>(array), <usize>array.byteLength);
    }

    /**
     * Add a module from a Uint8Array that represents a wasm module. If adding the module fails,
     * the `err_str` global will contain the error string.
     *
     * @param {Uint8Array} array The web assembly module.
     * @returns {Result<Module | null>} the module if it was successful.
     */
    addModuleArray(array: Uint8Array): Result<Module | null> {
        return this.addModuleUnsafe(array.dataStart, <usize>array.byteLength);
    }

    /**
     * Add a module from a StaticArray<u8> that represents a wasm module. If adding the module fails,
     * the `err_str` global will contain the error string.
     *
     * @param {StaticArray<u8>} array The web assembly module.
     * @returns {Result<Module | null>} the module if it was successful.
     */
    addModuleStaticArray(array: StaticArray<u8>): Result<Module | null> {
        return this.addModuleUnsafe(changetype<usize>(array), <usize>array.length);
    }

    /**
     * Add a plugin from a pointer and a length that represents a wasm module. If adding the Module
     * fails, the `err_str` global will contain the error string.
     *
     * @param {StaticArray<u8>} array The web assembly plugin.
     * @returns {Result<Module | null>} the module if it was successful.
     */
    addModuleUnsafe(bytes: usize, len: usize): Result<Module | null> {
        let result = add_module(this.id, bytes, len, id_ptr);
        let moduleId = load<u64>(id_ptr);
        if (result == err_code.Success) {
            return new Result<Module | null>(new Module(moduleId));
        }
        return new Result<Module | null>(null, moduleId);
    }

    /**
     * Add a module of the current kind to the environment.
     * 
     * @returns {Result<Module | null>} The module if it was successful.
     */
    addThisModule(): Result<Module | null> {
        let result = add_this_module(this.id, id_ptr);
        let moduleId = load<u64>(id_ptr);
        if (result == err_code.Success) {
            return new Result<Module | null>(new Module(moduleId));
        }
        return new Result<Module | null>(null, moduleId);
    }

    /**
     * Register a given process with a name and a version.
     * 
     * @param {Process} proc - The process being registered
     * @param {string} name - The name of the process.
     * @param {string} version - The version of the process.
     * @returns {bool} true if the process was registered.
     */
     register<TMessage>(proc: Process<TMessage>, name: string, version: string): bool {
        let pid = load<u64>(changetype<usize>(proc), offsetof<Process<TMessage>>("id"));
        let eid = this.id;
        let procName = String.UTF8.encode(name);
        let procVersion = String.UTF8.encode(version);
        let result = register(
            changetype<usize>(procName),
            <usize>procName.byteLength,
            changetype<usize>(procVersion),
            <usize>procVersion.byteLength,
            eid,
            pid,
        );
        return result == err_code.Success;
    }

    /**
     * Unregister a process by it's name and version.
     * 
     * @param {string} name - The name of the process.
     * @param {string} version - The version of the process.
     * @returns {bool} true if the operation was successful.
     */
    unregister(name: string, version: string): bool {
        let procName = String.UTF8.encode(name);
        let procVersion = String.UTF8.encode(version);
        let result = unregister(
            changetype<usize>(procName),
            <usize>procName.byteLength,
            changetype<usize>(procVersion),
            <usize>procVersion.byteLength,
            this.id,
        );
        return result == err_code.Success;
    }

    /**
     * Register this current process with a name and a version.
     * 
     * @param {string} name - The name of the process.
     * @param {string} version - The version of the process.
     * @returns {bool} true if the process was registered.
     */
    registerThisProcess(name: string, version: string): bool {
        let eid = this.id;
        let procName = String.UTF8.encode(name);
        let procVersion = String.UTF8.encode(version);
        let result = register(
            changetype<usize>(procName),
            <usize>procName.byteLength,
            changetype<usize>(procVersion),
            <usize>procVersion.byteLength,
            eid,
            pid,
        );
        return result == err_code.Success;
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
        return allow_namespace(this.id, changetype<usize>(buff), buff.byteLength) == err_code.Success;
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
     * @returns {Result<bool>} true if the directory was preopened, otherwise it sets the err_str variable with the reason for failure.
     */
    preopenDir(directory: string): Result<bool> {
        // strings need to be encoded every time we pass them up to the host
        let dirStr = String.UTF8.encode(directory);
        // call preopen
        let result = preopen_dir(this.id, changetype<usize>(dirStr), dirStr.byteLength, id_ptr);
        let dirId  = load<u64>(id_ptr);
        if (result == err_code.Success) {
            this.directories.set(directory, dirId);
            return new Result<bool>(true);
        }
        return new Result<bool>(false, dirId);
    }

    /**
     * Create an environment from the given configuration. If an environment cannot be created,
     * it will return `null` and write the error description to `err_str`.
     * 
     * @returns {Result<Environment | null>} The environment if it was successful.
     */
    createEnvironment(): Result<Environment | null> {
        let result = create_environment(this.id, id_ptr);
        let id = load<u64>(id_ptr);
        if (result == err_code.Success) {
            return new Result<Environment | null>(new Environment(id));
        }
        return new Result<Environment | null>(null, id);
    }

    /**
     * Add a plugin from an ArrayBuffer that represents a wasm module. If adding the plugin
     * fails, the `err_str` global will contain the error string.
     *
     * @param {Uint8Array} array The web assembly plugin.
     * @returns {Result<bool>} true if it was successful.
     */
    addPluginBuffer(array: ArrayBuffer): Result<bool> {
        return this.addPluginUnsafe(changetype<usize>(array), <usize>array.byteLength);
    }

    /**
     * Add a plugin from a Uint8Array that represents a wasm module. If adding the plugin fails,
     * the `err_str` global will contain the error string.
     *
     * @param {Uint8Array} array The web assembly plugin.
     * @returns {Result<bool>} true if it was successful.
     */
    addPluginArray(array: Uint8Array): Result<bool> {
        return this.addPluginUnsafe(array.dataStart, <usize>array.byteLength);
    }

    /**
     * Add a plugin from a StaticArray<u8> that represents a wasm module. If adding the plugin fails,
     * the `err_str` global will contain the error string.
     *
     * @param {StaticArray<u8>} array The web assembly plugin.
     * @returns {Result<bool>} true if it was successful.
     */
    addPluginStaticArray(array: StaticArray<u8>): Result<bool> {
        return this.addPluginUnsafe(changetype<usize>(array), <usize>array.length);
    }

    /**
     * Add a plugin from a pointer and a length that represents a wasm module. If adding the plugin
     * fails, the `err_str` global will contain the error string.
     *
     * @param {StaticArray<u8>} array The web assembly plugin.
     * @returns {Result<bool>} true if it was successful.
     */
    addPluginUnsafe(bytes: usize, len: usize): Result<bool> {
        let result = add_plugin(this.id, bytes, len, id_ptr);
        let pluginId = load<u64>(id_ptr);
        if (result == err_code.Success) {
            return new Result<bool>(true);
        }
        return new Result<bool>(false, pluginId);
    }
}
