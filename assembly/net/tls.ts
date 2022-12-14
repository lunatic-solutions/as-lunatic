import { ASManaged } from "as-disposable";
import { getError, idPtr, Result } from "../error";
import { error } from "../error/bindings";
import { ErrCode, opaquePtr, TimeoutErrCode } from "../util";
import { tls } from "./bindings";
import { resolveDNSIterator } from "./dns";
import { IPAddress, IPType, NetworkResultType, TCPResult } from "./util";
import { OBJECT, TOTAL_OVERHEAD } from "assemblyscript/std/assembly/rt/common";
import { message } from "../message/bindings";
import { Maybe, MaybeCallbackContext } from "../managed/maybe";
import { Box } from "../message";
import { Consumable, YieldableContext } from "../managed/yieldable";

export class ConsumableTLSSocketContext {
  constructor(
    public bufferSize: usize,
    public socket: TLSSocket,
  ) {}
}

export class TLSBindMaybeContext {
  constructor(
    public ip: IPAddress,
    public certs: StaticArray<u8>,
    public keys: StaticArray<u8>,
  ) {}
}

export class TLSServer extends ASManaged {
  constructor(
    /** The id of this TLSServer. */
    public id: u64,
    public ip: IPAddress,
  ) {
    super(id, tls.drop_tls_listener);
  }
    
  /**
   * Bind a TLSServer to an IP address.
   *
   * @returns {Result<TLSServer | null>} The resulting TLSServer or an error.
   */
  static bind(ip: IPAddress, certs: StaticArray<u8>, keys: StaticArray<u8>): Result<TLSServer | null> {
    return TLSServer.bindUnsafe(
      changetype<usize>(ip),
      ip.type,
      ip.port,
      ip.flowInfo,
      ip.scopeId,
      changetype<usize>(certs),
      <usize>certs.length,
      changetype<usize>(keys),
      <usize>keys.length,
    );
  }

  /**
   * Bind a TCPServer unsafely to a local address.
   *
   * @returns {Result<TCPServer | null>} The resulting TCPServer or an error.
   */
  @unsafe static bindUnsafe(
    addressPtr: usize,
    addressType: IPType,
    port: u16,
    flowInfo: u32,
    scopeId: u32,
    certsPtr: usize,
    certsSize: usize,
    keysPtr: usize,
    keysSize: usize,
  ): Result<TLSServer | null> {
    let result = tls.tls_bind(
      addressType,
      addressPtr,
      port,
      flowInfo,
      scopeId,
      opaquePtr,
      certsPtr,
      certsSize,
      keysPtr,
      keysSize,
    );
    let id = load<u64>(opaquePtr);
    if (result == ErrCode.Success) {
      let ipResult = tls.tls_local_addr(id, opaquePtr);
      let iteratorId = load<u64>(opaquePtr);
      if (ipResult == ErrCode.Success) {
        let ipAddress = resolveDNSIterator(iteratorId);
        assert(ipAddress.length == 1);
        let server = new TLSServer(id, ipAddress[0]);
        return new Result<TLSServer | null>(server);
      }
      tls.drop_tls_listener(id);
      return new Result<TLSServer | null>(null, iteratorId);
    }
    return new Result<TLSServer | null>(null, id);
  }

  static bindMaybe(ip: IPAddress, certs: StaticArray<u8>, keys: StaticArray<u8>): Consumable<i32, Maybe<TLSSocket, string>> {
    // @ts-ignore: __asonPut is implemented
    return new Yieldable<IPAddress, i32, Maybe<TCPSocket, string>>(
      new TLSBindMaybeContext(ip, certs, keys),
      (params: TLSBindMaybeContext, ctx: YieldableContext<IPAddress, i32, Maybe<TLSSocket, string>>) => {
        let serverResult = TLSServer.bind(params.ip, params.certs, params.keys);
        if (serverResult.isOk()) {
          let server = serverResult.expect();
          while (true) {
            let acceptResult = server.accept();
            if (acceptResult.isOk()) {
              let socket = acceptResult.expect();
              ctx.yield(Maybe.resolve<TLSSocket, string>(socket));
            } else {
              ctx.yield(Maybe.reject<TLSSocket, string>(acceptResult.errorString));
              return;
            }
          }
        } else {
          ctx.yield(Maybe.reject<TLSSocket, string>(serverResult.errorString));
          return;
        }
      }
    );
  }

  /** Utilized by ason to serialize a process. */
  __asonSerialize(): StaticArray<u8> {
    ERROR("TLSServer cannot be serialized.");
  }

  /** Utilized by ason to deserialize a process. */
  __asonDeserialize(_buffer: StaticArray<u8>): void {
    ERROR("TLSServer cannot be deserialized.");
  }

  
  /**
   * Accept a TCP connection. This method blocks the current thread indefinitely, waiting for an
   * incoming TCP connection.
   */
   accept(): Result<TLSSocket | null> {
    let result = tls.tls_accept(this.id, idPtr, opaquePtr);
    let id = load<u64>(idPtr);
    if (result == ErrCode.Success) {
      let dnsIterator = load<u64>(opaquePtr);
      let ipResolutions = resolveDNSIterator(dnsIterator);
      assert(ipResolutions.length == 1);
      return new Result<TLSSocket | null>(new TLSSocket(id, unchecked(ipResolutions[0])))
    }
    return new Result<TLSSocket | null>(null, id);
  }

  /** Drop the tcp listener resource. */
  drop(): void {
    tls.drop_tls_listener(this.id);
    this.preventFinalize();
  }
}

export class ConnectTLSMaybeContext {
  constructor(
    public ip: IPAddress,
    public certs: StaticArray<u8>,
    public timeout: u64,
  ) {}
}

export class TLSSocket extends ASManaged {

  /**
   * Create a TLS connection using the given IPAddress object as the connection server.
   *
   * @param {IPAddress} ip - The given IP Address.
   * @param {u32} timeout - A timeout.
   * @returns {Result<TLSSocket | null>} The socket if the connection was successful.
   */
   static connect(ip: IPAddress, certs: StaticArray<u8>, timeout: u64 = u64.MAX_VALUE): Result<TLSSocket | null> {
    return TLSSocket.connectUnsafe(
      ip.type,
      changetype<usize>(ip),
      ip.port,
      ip.flowInfo,
      ip.scopeId,
      timeout,
      changetype<usize>(certs),
      <usize>certs.length,
    );
  }

  /**
   * Connect to an IP Address. Considdered unsafe because of pointer usage.
   *
   * @param {IPType} addr_type - The IP Address type.
   * @param {usize} addr_ptr - A pointer to the IP Address.
   * @param {u16} port - The port.
   * @param {u32} flow_info - The flow info of a given ipv6 address.
   * @param {u32} scope_id - The scope id of a given ipv6 address.
   * @param {u32} timeout - How long to wait before the operation times out in milliseconds.
   * @returns {Result<TLSSocket | null>} The resulting TCPSocket if the connection was successful.
   */
  @unsafe static connectUnsafe(addr_type: IPType, addr_ptr: usize, port: u16, flow_info: u32, scope_id: u32, certs_array_ptr: u32, certs_array_len: usize, timeout: u64 = u64.MAX_VALUE): Result<TLSSocket | null> {
    assert(addr_type == 4 || addr_type == 6);
    let result = tls.tls_connect(
      addr_type,
      addr_ptr,
      port,
      flow_info,
      scope_id,
      timeout,
      opaquePtr,
      certs_array_ptr,
      certs_array_len,
    );
    let id = load<u64>(opaquePtr);
    if (result == ErrCode.Success) {
      let ip = new IPAddress();

      // copy the address
      memory.copy(changetype<usize>(ip), addr_ptr, select<usize>(4, 16, addr_type == IPType.IPV4));

      ip.type = addr_type;
      ip.port = port;
      ip.flowInfo = flow_info;
      ip.scopeId = scope_id;

      return new Result<TLSSocket | null>(new TLSSocket(id, ip));
    }
    return new Result<TLSSocket | null>(null, id);
  }

  /** Return a Maybe that connects to the given IP address. */
  static connectMaybe(ip: IPAddress, certs: StaticArray<u8>, timeout: u64 = u64.MAX_VALUE): Maybe<TLSSocket, string> {
    let ctx = new ConnectTLSMaybeContext(ip, certs, timeout);
    return Maybe.resolve<ConnectTLSMaybeContext, i32>(ctx)
      .then<TLSSocket, string>((box: Box<ConnectTLSMaybeContext> | null, ctx: MaybeCallbackContext<TLSSocket, string>) => {
        let connectCtx = box!.value;
        let result = TLSSocket.connect(connectCtx.ip, connectCtx.certs, connectCtx.timeout);
        if (result.value) {
          ctx.resolve(result.value!);
        } else {
          ctx.reject(result.errorString);
        }
      });
  }

  constructor(
    public id: u64,
    public ip: IPAddress,
  ) {
    super(id, tls.drop_tls_stream);
  }

  /** Drop the tcp listener resource. */
  drop(): void {
    tls.drop_tls_stream(this.id);
    this.preventFinalize();
  }

  
  /** Unsafe read implementation that uses a raw pointer, and returns the number of bytes read. */
  @unsafe private unsafeReadImpl(ptr: usize, size: usize): TCPResult {

    let readResult = tls.tls_read(this.id, ptr, size, opaquePtr);
    let opaqueValue = load<u64>(opaquePtr);
    if (readResult == TimeoutErrCode.Success) {
      if (opaqueValue == 0) return this.readClosed();
      return this.readSuccess(opaqueValue);
    }
    // timeouts are easy
    if (readResult == TimeoutErrCode.Timeout) return this.readTimeoutResult()
    // must be an error
    return this.readError(opaqueValue);
  }

  private readClosed(): TCPResult {
    return new TCPResult(
      NetworkResultType.Closed,
      null,
      0,
    );
  }

  private readSuccess(bytesRead: u64): TCPResult {
      return new TCPResult(
        NetworkResultType.Success,
        null,
        <usize>bytesRead,
      );
  }

  private readTimeoutResult(): TCPResult {
    return new TCPResult(
      NetworkResultType.Timeout,
      null,
      0,
    );
  }

  private readError(opaqueValue: u64): TCPResult {
    let errorString = getError(opaqueValue);
    error.drop_error(opaqueValue);
    return new TCPResult(
      NetworkResultType.Error,
      errorString,
      0,
    );
  }

  /**
   * Read data from the TCP stream into a buffer, or an array.
   */
  read<TData>(buffer: TData): TCPResult {
    if (buffer instanceof StaticArray) {
      let header = changetype<OBJECT>(changetype<usize>(buffer) - TOTAL_OVERHEAD);
      return this.unsafeReadImpl(
        changetype<usize>(buffer),
        <usize>header.rtSize,
      );
    } else if (buffer instanceof ArrayBuffer) {
      let header = changetype<OBJECT>(changetype<usize>(buffer) - TOTAL_OVERHEAD);
      return this.unsafeReadImpl(
        changetype<usize>(buffer),
        <usize>header.rtSize,
      );
      // @ts-ignore
    } else if (buffer instanceof ArrayBufferView) {
      // This branch doesn't account for the global ArrayBufferView class, this is safe
      return this.unsafeReadImpl(
        // @ts-ignore
        buffer.dataStart,
        // @ts-ignore
        <usize>buffer.byteLength,
      );
    } else if (buffer instanceof Array) {
      assert(buffer.length > 0);
      let item0 = unchecked(buffer[0]);
      if (isReference(item0)) ERROR("Cannot use array of references for TLSSocket#read()");

      return this.unsafeReadImpl(
        buffer.dataStart,
        // @ts-ignore: This is safe
        <usize>buffer.length << (alignof<valueof<TData>>()),
      );
    }
    ERROR("Invalid type for TLSSocket#read()");
  }

  /** Get or set the read timeout for tcp reads in milliseconds. */
  get readTimeout(): u64 {
    return tls.get_tls_read_timeout(this.id);
  }

  set readTimeout(value: u64) {
    tls.set_tls_read_timeout(this.id, value);
  }

  /** Get or set the write timeout for tcp reads in milliseconds. */
  get writeTimeout(): u64 {
    return tls.get_tls_write_timeout(this.id);
  }

  set writeTimeout(value: u64) {
    tls.set_tls_write_timeout(this.id, value);
  }

  /** Flush the bytes that are written, ensuring they are sent. */
  flush(): Result<i32> {
    let result = tls.tls_flush(this.id, idPtr);
    let id = load<u64>(idPtr);
    if (result == ErrCode.Fail) return new Result<i32>(0, id);
    return new Result<i32>(0);
  }

  /**
   * Clone the tcp stream and return a new reference to it.
   *
   * @returns A new tcp socket with the same stream id.
   */
  clone(): TLSSocket {
    return new TLSSocket(tls.clone_tls_stream(this.id), this.ip);
  }

  /** Cast the socket into a Consumable that consumes Maybes that resolve into static arrays. */
  intoConsumable(bufferSize: usize): Consumable<i32, Maybe<StaticArray<u8>, string>> {
    // create the yieldable start context closure
    let socketCtx = new ConsumableTLSSocketContext(bufferSize, this);
    // @ts-ignore: __asonPut is implemented
    return new Yieldable<ConsumableSocketContext, i32, Maybe<StaticArray<u8>, string>>(
      socketCtx,
      (
        socketCtx: ConsumableTLSSocketContext,
        ctx: YieldableContext<ConsumableTLSSocketContext, i32, Maybe<StaticArray<u8>, string>>
      ) => {
        let socket = socketCtx.socket;
        let bufferSize = socketCtx.bufferSize;
        let buffer = new StaticArray<u8>(bufferSize);

        while (true) {
          // read from the socket
          let readResult = socket.read(buffer);

          switch (readResult.type) {
            case NetworkResultType.Closed: {
              // resolve to nothing, the socket is closed, we are done
              ctx.yield(new Maybe<StaticArray<u8>, string>(() => {}));
              return;
            }
            case NetworkResultType.Error: {
              // an error occured, we need to finish and return the string
              ctx.yield(Maybe.reject<StaticArray<u8>, string>(readResult.error!));
              return;
            }
            case NetworkResultType.Timeout: {
              // if it's a timeout, we reject to a a string equal to "timeout", but continue
              ctx.yield(Maybe.reject<StaticArray<u8>, string>("timeout"));
              continue;
            }
            case NetworkResultType.Success: {
              // pass the data back
              ctx.yield(Maybe.resolve(buffer));
              continue;
            }
          }
        }
      }
    );
  }
  
  /** Utilized by ason to serialize a socket. */
  __asonSerialize(): StaticArray<u8> {
    let id = tls.clone_tls_stream(this.id);
    let messageId = message.push_tls_stream(id);
    let buff = new StaticArray<u8>(sizeof<u64>() + offsetof<IPAddress>());
    let ptr = changetype<usize>(buff);
    store<u64>(ptr, messageId);
    memory.copy(ptr + sizeof<u64>(), changetype<usize>(this.ip), offsetof<IPAddress>());
    return buff;
  }

  /** Utilized by ason to deserialize a socket. */
  __asonDeserialize(buff: StaticArray<u8>): void {
    let ptr = changetype<usize>(buff);
    let messageId = load<u64>(ptr);
    let id = message.take_tls_stream(messageId);
    let ip = __new(offsetof<IPAddress>(), idof<IPAddress>());
    memory.copy(ip, ptr + sizeof<u64>(), offsetof<IPAddress>());
    this.id = id;
    this.ip = changetype<IPAddress>(ip);
  }
}
