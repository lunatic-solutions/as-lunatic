import { ASON } from "@ason/assembly";
import { ASManaged } from "as-disposable/assembly";
import { distributed } from "../distributed/bindings";
import { Result } from "../error";
import { Mailbox } from "../message";
import { message } from "../message/bindings";
import { MessageType } from "../message/util";
import { CompileModuleErrCode, ErrCode, opaquePtr, TimeoutErrCode } from "../util";
import { process } from "./bindings";
import { Parameters, StartWrapper } from "./util";

const MESSAGE_BUFFER_SIZE =
  isDefined(MESSAGE_BUFFER_PREALLOC_SIZE)
    ? MESSAGE_BUFFER_PREALLOC_SIZE
    : 0;

/** This utf-8 string is the name of the export that gets called when a process bootstraps. */
const bootstrapUTF8 = [0x5f, 0x5f, // "__"
  0x6c, 0x75, 0x6e, 0x61, 0x74, 0x69, 0x63, // "lunatic"
  0x5f, // "_"
  0x70, 0x72, 0x6f, 0x63, 0x65, 0x73, 0x73, // "process"
  0x5f, // "_"
  0x62, 0x6f, 0x6f, 0x74, 0x73, 0x74, 0x72, 0x61, 0x70, // "bootstrap"
] as StaticArray<u8>;

/**
 * Represents a lunatic configuration for processes to run. It handles permissions related
 * to processes and configurations generated in the associated module.
 */
export class Config extends ASManaged {

  /** Create a configuration, returns null if the operation is not allowed. */
  static create(): Config | null {
    let result = process.create_config();
    if (result == -1) {
      return null;
    }
    return new Config(result);
  }

  // @ts-ignore: unsafe allowed here
  @unsafe constructor(public id: u64) {
    super(id, process.drop_config);
  }

  /** Get and set wether this configuration allows compiling modules. */
  get canCompileModules(): bool {
    return process.config_can_compile_modules(this.id);
  }

  set canCompileModules(value: bool) {
    process.config_set_can_compile_modules(this.id, value);
  }

  /** Get and set wether this configuration allows creation of configs. */
  get canCreateConfigs(): bool {
    return process.config_can_create_configs(this.id);
  }

  set canCreateConfigs(value: bool) {
    process.config_set_can_create_configs(this.id, value);
  }

  /** Get and set wether this configuration allows spawning of processes. */
  get canSpawnProcesses(): bool {
    return process.config_can_spawn_processes(this.id);
  }

  set canSpawnProcesses(value: bool) {
    process.config_set_can_spawn_processes(this.id, value);
  }

  /** Get or set the maximum fuel for each process that uses this config. */
  get maxFuel(): u64 {
    return process.config_get_max_fuel(this.id);
  }

  set maxFuel(value: u64) {
    process.config_set_max_fuel(this.id, value);
  }

  /** Get or set the maximum amount of memory that can be used by a process that uses this config. */
  get maxMemory(): u64 {
    return process.config_get_max_memory(this.id);
  }

  set maxMemory(value: u64) {
    process.config_set_max_memory(this.id, value);
  }
}

/**
 * Represents a web assembly module to instantiate lunatic processes in.
 */
export class Module extends ASManaged {
  // @ts-ignore: unsafe valid here
  @unsafe constructor(public id: u64) {
    super(id, process.drop_module);
  }

  static get moduleID(): u64 {
    return distributed.module_id();
  }

  @unsafe static compileModuleUnsafe(bufferPtr: usize, bufferLen: usize): Result<Module | null> {
    let result = process.compile_module(bufferPtr, bufferLen, opaquePtr);
    let opaqueValue = load<u64>(opaquePtr);
    if (result == CompileModuleErrCode.Success) {
      let mod = new Module(opaqueValue);
      return new Result<Module | null>(mod);
    }
    return new Result<Module | null>(null, opaqueValue);
  }

  /** Compile a module using an ArrayBuffer. */
  static compileModuleArrayBuffer(buffer: ArrayBuffer): Result<Module | null> {
    return Module.compileModuleUnsafe(changetype<usize>(buffer), <usize>buffer.byteLength);
  }

  /** Compile a module using a static array. */
  static compileModuleStaticArray(buffer: StaticArray<u8>): Result<Module | null> {
    return Module.compileModuleUnsafe(changetype<usize>(buffer), <usize>buffer.length);
  }

  /** Compile a module using a typed array. */
  static compileModuleTypedArray(buffer: Uint8Array): Result<Module | null> {
    return Module.compileModuleUnsafe(buffer.dataStart, <usize>buffer.byteLength);
  }

  /** Compile a module using a regular array of bytes. */
  static compileModuleArray(buffer: u8[]): Result<Module | null> {
    return Module.compileModuleUnsafe(buffer.dataStart, <usize>buffer.length);
  }
}

/** Represents a lunatic process. */
export class Process<TMessage> {

  /** Return a reference to the current process. */
  static self<T>(): Process<T> {
    return new Process<T>(Process.processID, Process.tag++);
  }

  /** Get the current node id for this running process. */
  static get node(): u64 {
    return distributed.node_id();
  }

  /** Get the current module for this running process. */
  static get module(): Module {
    return new Module(distributed.module_id());
  }

  /** Get all the distributed nodes. */
  static getNodes(): StaticArray<u64> {
    let count = distributed.nodes_count();
    let result = new StaticArray<u64>(<i32>count);
    distributed.get_nodes(changetype<usize>(result), <u32>count);
    return result;
  }

  /** Unlink a process. */
  static unlink<T>(proc: Process<T>): void {
    process.unlink(proc.id);
  }

  /** Pause the current process and force it to sleep for a given amount of milliseconds. */
  static sleep(ms: u64): void {
    process.sleep_ms(ms);
  }

  /** Get the current running process id. */
  static get processID(): u64 {
    return process.process_id();
  }

  /**
   * Private tag reference, used to generate unique tag identifiers for
   * process linking and request sending.
   */
  static tag: u64 = 0;

  /**
   * Link a process and tag it with a unique identifier. When the process dies, it
   * notifies this process in the Mailbox with the tag.
   *
   * @param proc - The process to be linked.
   * @returns {u64} The tag for the linked process.
   */
  static link<T>(proc: Process<T>): u64 {
    let tag = Process.tag++;
    process.link(proc.id, tag);
    return tag;
  }

  /**
   * Get the environment_id of this current running process.
   */
  static get environmentID(): u64 {
    return process.environment_id();
  }

  /**
   * Set wether the process should trap, or if sub-processes should notify the module
   * via mailbox that they were closed.
   */
  static set dieWhenLinkDies(value: bool) {
    process.die_when_link_dies(value);
  }

  // @ts-ignore: unsafe valid here
  @unsafe constructor(public id: u64, public tag: u64, public nodeID: u64 = u64.MAX_VALUE) {}

  /** Kill the referenced process. */
  kill(): void {
    process.kill(this.id);
  }

  /**
   * Spawn a process from a module, and provide up to three function parameters with a tag on the
   * given node.
   *
   * @param {u64} nodeID - The node id for the spawned process.
   * @param {Module} module - The module for the spawned process.
   * @param {string} func - The name of the exported function being called. Must be exported.
   * @param {Parameters} params - The function parameters.
   * @returns {Result<Process<StaticArray<u8>> | null>} the result of creating a process, or an error string.
   */
  static spawnDistributed(nodeID: u64, module: Module, config: Config, func: string, params: Parameters): Result<Process<StaticArray<u8>> | null> {
    // utf8 string is required
    let buff = String.UTF8.encode(func);
    let tag = Process.tag++;

    let result = distributed.spawn(
      // parent is this process
      tag,

      // the node to run on
      nodeID,

      // use the provided config
      config.id,
      // load the module id, because it's private
      module.id,

      // function name
      changetype<usize>(buff),
      <usize>buff.byteLength,

      // process tag, function parameters
      params.ptr,
      params.byteLength,

      // output id
      opaquePtr,
    );

    // obtain the id, error, or process id
    let id = load<u64>(opaquePtr);
    if (result == ErrCode.Success) {
      return new Result<Process<StaticArray<u8>> | null>(new Process(id, tag, nodeID));
    }
    return new Result<Process<StaticArray<u8>> | null>(null, id);
  }

  /**
   * Spawn a process from a module, and provide up to three function parameters with
   * a tag on the same node.
   *
   * @param {Module} module - The module for the spawned process.
   * @param {string} func - The name of the exported function being called. Must be exported.
   * @param {Parameters} params - The function parameters.
   * @returns {Result<Process<StaticArray<u8>> | null>} the result of creating a process, or an error string.
   */
  static spawn(module: Module, config: Config, func: string, params: Parameters): Result<Process<StaticArray<u8>> | null> {
    // utf8 string is required
    let buff = String.UTF8.encode(func);
    let tag = Process.tag++;

    let result = process.spawn(
      // parent is this process
      tag,

      // use the provided config
      config.id,
      // load the module id, because it's private
      module.id,

      // function name
      changetype<usize>(buff),
      <usize>buff.byteLength,

      // process tag, function parameters
      params.ptr,
      params.byteLength,

      // output id
      opaquePtr,
    );

    // obtain the id, error, or process id
    let id = load<u64>(opaquePtr);
    if (result == ErrCode.Success) {
      return new Result<Process<StaticArray<u8>> | null>(new Process(id, tag));
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
      let startMessage = startMb.receive([], u64.MAX_VALUE);

      // we know it must be a Data message
      assert(startMessage.type == MessageType.Data);
      let unpacked = startMessage.value;
      assert(unpacked);

      // call the start message callback with the start value
      call_indirect(<u32>unpacked!.value.index, unpacked!.value.start, mb);
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

    let tag = Process.tag++;

    // store the function pointer bytes little endian (lower bytes in front)
    let result = process.spawn(
      tag,
      -1, // use the same config
      -1,
      changetype<usize>(bootstrapUTF8),
      <usize>bootstrapUTF8.length,
      paramsPtr,
      17, // 17 * 1
      opaquePtr,
    );

    let spawnID = load<u64>(opaquePtr);

    if (result == ErrCode.Success) {
      return new Result<Process<TMessage> | null>(new Process(spawnID, tag));
    }
    return new Result<Process<TMessage> | null>(null, spawnID);
  }

  /**
   * Send a message with an optional tag.
   *
   * @param {TMessage} msg - The message being sent.
   * @param {i64} tag - The message tag.
   */
  send<UMessage extends TMessage>(msg: UMessage, tag: i64 = 0): void {
    message.create_data(tag, MESSAGE_BUFFER_SIZE);
    let buffer = ASON.serialize<UMessage>(msg);
    let bufferLength = <usize>buffer.length;
    message.write_data(changetype<usize>(buffer), bufferLength);
    if (this.nodeID == u64.MAX_VALUE) message.send(this.id);
    else distributed.send(this.nodeID, this.id);
  }

  /**
   * Send a message with an optional tag.
   *
   * @param {TMessage} msg - The message being sent.
   * @param {i64} tag - The message tag.
   */
  @unsafe sendUnsafe<UMessage>(msg: UMessage, tag: i64 = 0): void {
    message.create_data(tag, MESSAGE_BUFFER_SIZE);
    let buffer = ASON.serialize<UMessage>(msg);
    let bufferLength = <usize>buffer.length;
    message.write_data(changetype<usize>(buffer), bufferLength);
    if (this.nodeID != u64.MAX_VALUE) distributed.send(this.nodeID, this.id);
    else message.send(this.id);
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
    if (this.nodeID != u64.MAX_VALUE) distributed.send(this.nodeID, this.id);
    else message.send(this.id);
  }

  /**
   * Send a message and skip search.
   *
   * @param {TMessage} message - The message being sent.
   * @param {u32} timeout - The timeout in milliseconds.
   */
  sendReceiveSkipSearch<UMessage extends TMessage>(msg: UMessage, timeout: u32 = 0): TimeoutErrCode {
    message.create_data(0, MESSAGE_BUFFER_PREALLOC_SIZE);
    let buffer = ASON.serialize(msg);
    let bufferLength = <usize>buffer.length;
    message.write_data(changetype<usize>(buffer), bufferLength);
    if (this.nodeID != u64.MAX_VALUE) return distributed.send_receive_skip_search(this.nodeID, this.id, timeout);
    else return message.send_receive_skip_search(this.id, timeout);
  }
}
