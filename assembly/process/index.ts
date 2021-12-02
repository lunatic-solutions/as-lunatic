import { Result, id_ptr } from "../error";
import { set_finalize, LunaticManaged, err_code } from "../util";
import { Mailbox } from "../messaging";
import { ASON } from "@ason/assembly";
import { message, process } from "../bindings";
import { TCPServer } from "../net";

//%  - 0x7F => i32
//%  - 0x7E => i64
//%  - 0x7B => v128
/** Predefined location to store tags for function parameters. */
const params = memory.data(51); // ( 16(v128) + 1(type) ) * 3(count)
let param_count = 0;
let param_offset = 0;

/** Unmanaged Tag class used for tagging parameters for remote function calls when starting a process. */
@unmanaged export class Parameters {
  static reset() {
    param_count = 0;
    param_offset = 0;
    // Yes. This is a fake null reference
    return changetype<Parameters>(params);
  }

  /** Tag an i32 parameter. */
  i32(val: i32): Parameters {
    assert(param_count < 3);
    param_count++;
    store<u8>(params + param_offset, <u8>0x7F);
    store<i32>(params + param_offset, val, 1);
    param_offset += sizeof<i32>() + 1;
    return this;
  }

  /** Tag an i64 parameter. */
  i64(val: i64): Parameters {
    assert(param_count < 3);
    param_count++;
    store<u8>(params + param_offset, <u8>0x7E);
    store<i64>(params + param_offset, val, 1);
    param_offset += sizeof<i64>() + 1;
    return this;
  }

  /** Tag a v128 parameter. */
  v128(val: v128): Parameters {
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


let pid = process.id();

export class Process<TMessage> extends LunaticManaged {

  /**
   * Sleep the current process for ms number of milliseconds.
   *
   * @param {u64} ms - The number of milliseconds to sleep for.
   */
  static sleep(ms: u64): void {
    process.sleep_ms(ms);
  }

  /**
   * Spawn a process from a module, and provide up to three function parameters with a tag.
   *
   * @param {Module} module - The module being spawned
   * @param {string} func - The exported function name being called
   * @param {Parameters} params - The function parameters
   * @returns {Result<Process<StaticArray<u8>> | null>} the result of creating a process, or an error string.
   */
  static spawn(module: Module, func: string, params: Parameters): Result<Process<StaticArray<u8>> | null> {
    // utf8 string is required
    let buff = String.UTF8.encode(func);

    let result = process.spawn(
      // parent is this process
      pid,

      // load the module id, because it's private
      load<u64>(changetype<usize>(module), offsetof<Module>("id")),

      // function name
      changetype<usize>(buff),
      <usize>buff.byteLength,

      // process tag, function parameters
      changetype<usize>(params),
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
  static inherit_spawn<TMessage>(func: (mb: Mailbox<TMessage>) => void): Result<Process<TMessage> | null> {
    // store the function pointer bytes little endian (lower bytes in front)
    let params = Parameters.reset()
      .i32(func.index);

    let result = process.inherit_spawn(
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
    super(id, process.drop_process);
  }

  /**
   * Return a handle to this process.
   */
  static self<TMessage>(): Process<TMessage> {
    return new Process(process.this_handle());
  }

  /**
   * Return a handle to this environment.
   */
  static env(): Environment {
    return new Environment(process.this_env());
  }

  /**
   * Send a message with an optional tag.
   *
   * @param {TMessage} msg - The message being sent.
   * @param {i64} tag - The message tag.
   */
  send(msg: TMessage, tag: i64 = 0): void {
    let buffer = ASON.serialize<TMessage>(msg);
    let bufferLength = <usize>buffer.length;
    message.create_data(tag, bufferLength);
    message.write_data(changetype<usize>(buffer), bufferLength);
    message.send(this.id);
  }

  /**
   * Send a message with a request acknowledgement.
   *
   * @param {TMessage} message - The message being sent.
   * @param {u32} timeout - The timeout in milliseconds.
   */
  request(msg: TMessage, timeout: u32 = 0): void {
    let buffer = ASON.serialize<TMessage>(msg);
    let bufferLength = <usize>buffer.length;
    message.create_data(0, bufferLength);
    message.write_data(changetype<usize>(buffer), bufferLength);
    message.send_receive_skip_search(this.id, timeout);
  }

  /** Drop a process. */
  drop(): void {
    if (!this.dropped) {
      this.dispose();
    }
  }

  /** Used by as-lunatic's __lunatic_finalize() function to assert the resource is dropped. */
  dispose(): void {
    this.drop();
  }

  /** Clone a process, returns null if the process has already been dropped. */
  clone(): TCPServer | null {
    if (this.dropped) return null;
    return new TCPServer(process.clone_tcp_listener(this.id));
  }

  /** Utilized by ason to serialize a process. */
  __asonSerialize(): StaticArray<u8> {
    let result = new StaticArray<u8>(sizeof<u64>());
    let cloned = this.clone()!;
    store<u64>(changetype<usize>(result), message.push_tcp_listener(cloned.id));
    // we prevent finalization here because the process will transfer ownership
    cloned.preventFinalize();
    return result;
  }

  /** Utilized by ason to deserialize a process. */
  __asonDeserialize(buffer: StaticArray<u8>): void {
      assert(buffer.length == sizeof<u64>());
      this.id = message.take_process(load<u64>(changetype<usize>(buffer)));
  }
}

/**
 * This class represents a WebAssembly module.
 */
export class Module extends LunaticManaged {
  constructor(
      public id: u64,
  ) {
      super(id, process.drop_module);
  }
}

export class Environment extends LunaticManaged {
  constructor(
      public id: u64,
  ) {
      super(id, process.drop_environment);
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
      let result = process.add_module(this.id, bytes, len, id_ptr);
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
      let result = process.add_this_module(this.id, id_ptr);
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
      let result = process.register(
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
      let result = process.unregister(
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
      let result = process.register(
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
  public id: u64 = 0;
  private directories = new Map<string, u64>();

  constructor(max_memory: u64, max_fuel: u64) {
      let id = process.create_config(max_memory, max_fuel);
      super(id, process.drop_config);
      this.id = id;
  }

  /**
   * Allow a host namespace to be used.
   *
   * @param {string} namespace - The lunatic namespace being allowed.
   * @returns {bool} true if the namespace was allowed.
   */
  allowNamespace(namespace: string): bool {
      let buff = String.UTF8.encode(namespace);
      return process.allow_namespace(this.id, changetype<usize>(buff), buff.byteLength) == err_code.Success;
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
    let result = process.preopen_dir(this.id, changetype<usize>(dirStr), dirStr.byteLength, id_ptr);
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
    let result = process.create_environment(this.id, id_ptr);
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
    let result = process.add_plugin(this.id, bytes, len, id_ptr);
    let pluginId = load<u64>(id_ptr);
    if (result == err_code.Success) {
      return new Result<bool>(true);
    }
    return new Result<bool>(false, pluginId);
  }
}
