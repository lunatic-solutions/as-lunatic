import { Result, idPtr } from "../error";
import { Parameters, ErrCode, MessageType } from "../util";
import { Mailbox } from "../messaging";
import { ASON } from "@ason/assembly";
import { message, process } from "../bindings";
import { ASManaged } from "as-disposable";

/**
 * A wrapper reference to be serialized that contains a start message and a callback for a
 * new process.
 */
export class StartWrapper<T> {
  constructor(
    /** The start message. */
    public start: T,
    /** The callback index. */
    public index: i32,
  ) {}
}

/** This utf-8 string is the name of the export that gets called when a process bootstraps. */
const bootstrapUTF8 = [0x5f, 0x5f, // "__"
  0x6c, 0x75, 0x6e, 0x61, 0x74, 0x69, 0x63, // "lunatic"
  0x5f, // "_"
  0x70, 0x72, 0x6f, 0x63, 0x65, 0x73, 0x73, // "process"
  0x5f, // "_"
  0x62, 0x6f, 0x6f, 0x74, 0x73, 0x74, 0x72, 0x61, 0x70, // "bootstrap"
] as StaticArray<u8>;


let pid = process.this_handle();
let tagid: u64 = 0;

/** This class represents a lunatic process, and is managed by the lunatic runtime. */
export class Process<TMessage> extends ASManaged {

  /**
   * Sleep the current process for ms number of milliseconds.
   *
   * @param {u64} ms - The number of milliseconds to sleep for.
   */
  static sleep(ms: u64): void {
    process.sleep_ms(ms);
  }

  /** Get the unique identifier for this process. */
  static id(): StaticArray<u8> {
    let id = new StaticArray<u8>(16);
    process.id(pid, changetype<usize>(id));
    return id;
  }

  /**
   * Spawn a process from a module, and provide up to three function parameters with a tag.
   *
   * @param {Module} module - The module for the spawned process.
   * @param {string} func - The name of the exported function being called. Must be exported.
   * @param {Parameters} params - The function parameters.
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
      params.ptr,
      params.byteLength,

      // output id
      idPtr,
    );

    // obtain the id, error, or process id
    let id = load<u64>(idPtr);
    if (result == ErrCode.Success) {
      return new Result<Process<StaticArray<u8>> | null>(new Process(id));
    }
    return new Result<Process<StaticArray<u8>> | null>(null, id);
  }

  /**
   * Spawn a process in the current environment with a start value and a given function as a callback.
   *
   * @param {TStart} start - The start value of the thread.
   * @param {(start: TStart, mb: Mailbox<TMessage>) => void} func - The callback that accepts the start value and the mailbox.
   * @returns {Result<Process<TMessage> | null>} The created process.
   */
  static inheritSpawnWith<TStart, TMessage>(start: TStart, func: (start: TStart, mb: Mailbox<TMessage>) => void): Result<Process<TMessage> | null> {
    // we need to wrap up the callback and the start value into the message
    let wrapped = new StartWrapper<TStart>(start, func.index);

    // create a regular process
    let p = Process.inheritSpawn((mb: Mailbox<TMessage>): void => {

      // create a fake mailbox that receives the first message of the process
      let startMb = changetype<Mailbox<StartWrapper<TStart>>>(0);
      let startMessage = startMb.receive();

      // we know it must be a Data message
      assert(startMessage.type == MessageType.Data);
      let unpacked = startMessage.value;
      assert(unpacked);

      // call the start message callback with the start value
      call_indirect(unpacked!.value.index, unpacked!.value.start, mb);
    });

    // if process creation was successful, send the first message which should be a TStart wrapper
    if (p.value) {
      p.value!.sendUnsafe<StartWrapper<TStart>>(wrapped);
    }

    // finally return the process wrapper
    return p;
  }

  /**
   * Create a process from the same module as the currently running one, with a single callback.
   *
   * @param {() => void} func - The callback for the process.
   * @returns {Result<Process | null>} the process if the creation was successful.
   */
  static inheritSpawn<TMessage>(func: (mb: Mailbox<TMessage>) => void): Result<Process<TMessage> | null> {
    let paramsPtr = Parameters.reset()
      .i32(func.index)
      .ptr;

    // store the function pointer bytes little endian (lower bytes in front)
    let result = process.inherit_spawn(
      pid,
      changetype<usize>(bootstrapUTF8),
      <usize>bootstrapUTF8.length,
      paramsPtr,
      17, // 17 * 1
      idPtr,
    );

    let spawnID = load<u64>(idPtr);

    if (result == ErrCode.Success) {
      return new Result<Process<TMessage> | null>(new Process(spawnID));
    }
    return new Result<Process<TMessage> | null>(null, spawnID);
  }

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
  static dieWhenLinkDies(trap: bool = true): void {
    process.die_when_link_dies(trap);
  }

  constructor(
    /** The id of the process. */
    public id: u64,
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
  send<UMessage extends TMessage>(msg: UMessage, tag: i64 = 0): void {
    message.create_data(tag, MESSAGE_BUFFER_PREALLOC_SIZE);
    let buffer = ASON.serialize(msg);
    let bufferLength = <usize>buffer.length;
    message.write_data(changetype<usize>(buffer), bufferLength);
    message.send(this.id);
  }

  /**
   * Send a message with an optional tag.
   *
   * @param {TMessage} msg - The message being sent.
   * @param {i64} tag - The message tag.
   */
  @unsafe sendUnsafe<UMessage>(msg: UMessage, tag: i64 = 0): void {
    message.create_data(tag, MESSAGE_BUFFER_PREALLOC_SIZE);
    let buffer = ASON.serialize<UMessage>(msg);
    let bufferLength = <usize>buffer.length;
    message.write_data(changetype<usize>(buffer), bufferLength);
    message.send(this.id);
  }


  /**
   * Send a raw buffer unsafely to the process. This is unsafe, because mailboxes
   * are typically strongly typed.
   *
   * @param {StaticArray<u8>} msg - The buffer to be sent.
   * @param {i64} tag - The tag of the message.
   */
  @unsafe sendBufferUnsafe(msg: StaticArray<u8>, tag: i64 = 0): void {
    message.create_data(tag, <usize>msg.length);
    message.write_data(changetype<usize>(msg), <usize>msg.length);
    message.send(this.id);
  }

  /**
   * Send a message with a request acknowledgement.
   *
   * @param {TMessage} message - The message being sent.
   * @param {u32} timeout - The timeout in milliseconds.
   */
  request<UMessage extends TMessage>(msg: UMessage, timeout: u32 = 0): void {
    message.create_data(0, MESSAGE_BUFFER_PREALLOC_SIZE);
    let buffer = ASON.serialize(msg);
    let bufferLength = <usize>buffer.length;
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

  /** Link the current process to this child process, returing the process tag. */
  link(): u64 {
    let tag = tagid++;
    process.link(tag, this.id);
    return tag;
  }

  /** Unlink this child process from the current process. */
  unlink(): void {
    process.unlink(this.id);
  }

  /** Clone a process, returns null if the process has already been dropped. */
  clone(): Process<TMessage> | null {
    if (this.dropped) return null;
    return new Process(process.clone_process(this.id));
  }

  /** Utilized by ason to serialize a process. */
  __asonSerialize(): StaticArray<u8> {
    let result = new StaticArray<u8>(sizeof<u64>());
    let cloned = this.clone()!;
    store<u64>(changetype<usize>(result), message.push_process(cloned.id));
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
export class Module extends ASManaged {
  constructor(
    /** The id of the module */
    public id: u64,
  ) {
      super(id, process.drop_module);
  }
}

/** Represents an environment in which modules are allowed to be instantiated and run. */
export class Environment extends ASManaged {
  constructor(
    /** The id of this Environment. */
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
  @unsafe addModuleUnsafe(bytes: usize, len: usize): Result<Module | null> {
      let result = process.add_module(this.id, bytes, len, idPtr);
      let moduleId = load<u64>(idPtr);
      if (result == ErrCode.Success) {
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
      let result = process.add_this_module(this.id, idPtr);
      let moduleId = load<u64>(idPtr);
      if (result == ErrCode.Success) {
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
      return result == ErrCode.Success;
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
      return result == ErrCode.Success;
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
      return result == ErrCode.Success;
  }
}


/** Represents an environment configuration, managed by lunatic. */
export class Config extends ASManaged {
  /** The configuration id. */
  public id: u64 = 0;
  /** A map of directories that were successfully preopened. */
  private directories: Map<string, u64> = new Map<string, u64>();

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
      return process.allow_namespace(this.id, changetype<usize>(buff), buff.byteLength) == ErrCode.Success;
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
    let result = process.preopen_dir(this.id, changetype<usize>(dirStr), dirStr.byteLength, idPtr);
    let dirId  = load<u64>(idPtr);
    if (result == ErrCode.Success) {
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
    let result = process.create_environment(this.id, idPtr);
    let id = load<u64>(idPtr);
    if (result == ErrCode.Success) {
      return new Result<Environment | null>(new Environment(id));
    }
    return new Result<Environment | null>(null, id);
  }

  /**
   * Create a remote environment from the given configuration with the given name. If an environment
   * cannot be created, it will return `null` and write the error description to `err_str`.
   *
   * @returns {Result<Environment | null>} The environment if it was successful.
   */
  createRemoveEnvironment(name: string): Result<Environment | null> {
    let buff = String.UTF8.encode(name);
    let result = process.create_remote_environment(this.id, changetype<usize>(name), buff.byteLength, idPtr);
    let id = load<u64>(idPtr);
    if (result == ErrCode.Success) {
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
  @unsafe addPluginUnsafe(bytes: usize, len: usize): Result<bool> {
    let result = process.add_plugin(this.id, bytes, len, idPtr);
    let pluginId = load<u64>(idPtr);
    if (result == ErrCode.Success) {
      return new Result<bool>(true);
    }
    return new Result<bool>(false, pluginId);
  }
}

export * from "./EventListener";
export * from "./Task";
