import { iovec } from "@assemblyscript/wasi-shim/assembly/bindings/wasi_snapshot_preview1";
import { ASManaged } from "as-disposable/assembly";
import { OBJECT, TOTAL_OVERHEAD } from "assemblyscript/std/assembly/rt/common";
import { getError, Result } from "../error";
import { error } from "../error/bindings";
import { message } from "../message/bindings";
import { ErrCode, TimeoutErrCode, opaquePtr } from "../util";
import { tcp } from "./bindings";
import { resolveDNSIterator } from "./dns";
import { IPAddress, IPType, NetworkResultType, TCPResult } from "./util";

const idPtr = memory.data(sizeof<u64>());

/**
 * A TCP Socket that can be written to or read from.
 */
export class TCPSocket extends ASManaged {
  /** The resulting read buffer. */
  public buffer: StaticArray<u8> | null = null;
  /** Written byte count after calling write. */
  public byteCount: usize = 0;

  /**
   * Create a TCP connection using the given IPAddress object as the connection server.
   *
   * @param {IPAddress} ip - The given IP Address.
   * @param {u32} timeout - A timeout.
   * @returns {Result<TCPSocket | null>} The socket if the connection was successful.
   */
  static connectIP(ip: IPAddress, timeout: u64 = u64.MAX_VALUE): Result<TCPSocket | null> {
    return TCPSocket.connectUnsafe(
      ip.type,
      changetype<usize>(ip),
      ip.port,
      ip.flowInfo,
      ip.scopeId,
      timeout,
    );
  }

  /**
   * Connect to the given IPV4 address with the given bytes and port.
   *
   * @param {StaticArray<u8>} ip - The IP address in bytes.
   * @param {u32} port - The port of the connection.
   * @param {u32} timeout - How long until a timeout will occur.
   * @returns {Result<TCPSocket | null>} The socket if the connection was successful.
   */
  static connectIPV4(ip: StaticArray<u8>, port: u16, timeout: u64 = u64.MAX_VALUE): Result<TCPSocket | null> {
    assert(ip.length >= 4);
    return TCPSocket.connectUnsafe(
      IPType.IPV4,
      changetype<usize>(ip),
      port,
      0,
      0,
      timeout,
    );
  }

  /**
   * Connect to the given IPV6 address with the given bytes and port.
   *
   * @param {StaticArray<u8>} ip - The IP address in bytes.
   * @param {u32} port - The port of the connection.
   * @param {u32} flow_info - The flow info of the ip address for the connection.
   * @param {u32} scope_id - The scope id of the ip address for the connection.
   * @param {u32} timeout - How long until a timeout will occur.
   * @returns {Result<TCPSocket | null>} The socket if the connection was successful.
   */
  static connectIPV6(ip: StaticArray<u8>, port: u16, flow_info: u32, scope_id: u32, timeout: u64 = u64.MAX_VALUE): Result<TCPSocket | null> {
    assert(ip.length >= 16);
    return TCPSocket.connectUnsafe(
      IPType.IPV6,
      changetype<usize>(ip),
      port,
      flow_info,
      scope_id,
      timeout,
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
   * @returns {Result<TCPSocket | null>} The resulting TCPSocket if the connection was successful.
   */
  @unsafe static connectUnsafe(addr_type: IPType, addr_ptr: usize, port: u16, flow_info: u32, scope_id: u32, timeout: u64 = u64.MAX_VALUE): Result<TCPSocket | null> {
    assert(addr_type == 4 || addr_type == 6);
    let result = tcp.tcp_connect(
      addr_type,
      addr_ptr,
      port,
      flow_info,
      scope_id,
      timeout,
      opaquePtr,
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

      return new Result<TCPSocket | null>(new TCPSocket(id, ip));
    }
    return new Result<TCPSocket | null>(null, id);
  }

  constructor(
    /** The tcp socket id on the host. */
    public id: u64,
    /** The IP Address of this socket. */
    public ip: IPAddress
  ) {
    super(id, tcp.drop_tcp_stream);
  }

  /** Unsafe read implementation that uses a raw pointer, and returns the number of bytes read. */
  @unsafe private unsafePeekImpl(ptr: usize, size: usize): TCPResult {
    let peekResult = tcp.tcp_peek(this.id, ptr, size, opaquePtr);
    let opaqueValue = load<u64>(opaquePtr);
    if (peekResult == TimeoutErrCode.Success) {
      if (opaqueValue == 0) return this.readClosed();
      return this.readSuccess(opaqueValue);
    }
    // timeouts are easy
    if (peekResult == TimeoutErrCode.Timeout) return this.readTimeoutResult();
    // must be an error
    return this.readError(opaqueValue);
  }

  /** Unsafe read implementation that uses a raw pointer, and returns the number of bytes read. */
  @unsafe private unsafeReadImpl(ptr: usize, size: usize): TCPResult {
    let readResult = tcp.tcp_read(this.id, ptr, size, opaquePtr);
    let opaqueValue = load<u64>(opaquePtr);
    if (readResult == TimeoutErrCode.Success) {
      if (opaqueValue == 0) return this.readClosed();
      return this.readSuccess(opaqueValue);
    }
    // timeouts are easy
    if (readResult == TimeoutErrCode.Timeout) return this.readTimeoutResult();
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
      if (isReference(item0)) ERROR("Cannot use array of references for TCPSocket#read()");

      return this.unsafeReadImpl(
        buffer.dataStart,
        // @ts-ignore: This is safe
        <usize>buffer.length << (alignof<valueof<TData>>()),
      )
    }
    ERROR("Invalid type for TCPSocket#read()");
  }
  /**
   * Read data from the TCP stream into a buffer, or an array.
   */
  peek<TData>(buffer: TData): TCPResult {
    if (buffer instanceof StaticArray) {
      let header = changetype<OBJECT>(changetype<usize>(buffer) - TOTAL_OVERHEAD);
      return this.unsafePeekImpl(
        changetype<usize>(buffer),
        <usize>header.rtSize,
      );
    } else if (buffer instanceof ArrayBuffer) {
      let header = changetype<OBJECT>(changetype<usize>(buffer) - TOTAL_OVERHEAD);
      return this.unsafePeekImpl(
        changetype<usize>(buffer),
        <usize>header.rtSize,
      );
      // @ts-ignore
    } else if (buffer instanceof ArrayBufferView) {
      // This branch doesn't account for the global ArrayBufferView class, this is safe
      return this.unsafePeekImpl(
        // @ts-ignore
        buffer.dataStart,
        // @ts-ignore
        <usize>buffer.byteLength,
      );
    } else if (buffer instanceof Array) {
      assert(buffer.length > 0);
      let item0 = unchecked(buffer[0]);
      if (isReference(item0)) ERROR("Cannot use array of references for TCPSocket#read()");

      return this.unsafePeekImpl(
        buffer.dataStart,
        // @ts-ignore: This is safe
        <usize>buffer.length << (alignof<valueof<TData>>()),
      )
    }
    ERROR("Invalid type for TCPSocket#peek()");
  }


  /**
   * Write a typedarray's data to a TCPStream.
   *
   * @param {T extends ArrayBufferView} array - A static array to write the TCPStream
   * @param {u32} timeout - The amount of time to wait and timeout in milliseconds.
   */
  writeTypedArray<T extends ArrayBufferView>(array: T): Result<NetworkResultType> {
    return this.writeUnsafe(array.dataStart, <usize>array.byteLength);
  }

  /**
   * Write a Array to the TCPStream.
   *
   * @param {T extends Array<U>} array - A static array to write the TCPStream
   * @param {u32} timeout - The amount of time to wait and timeout in milliseconds.
   * @returns {Result<NetworkResultType>} A wrapper to a TCPResultType. If an error occured, the
   * errorString property will return a string describing the error.
   */
  writeArray<T extends Array<U>, U>(array: T): Result<NetworkResultType> {
    if (isReference<U>()) ERROR("Cannot call writeArray if type of U is a reference.");
    let byteLength = (<usize>array.length) << alignof<U>();
    return this.writeUnsafe(array.dataStart, byteLength);
  }

  /**
   * Write a StaticArray to the TCPStream.
   *
   * @param {T extends StaticArray<U>} array - A static array to write the TCPStream
   * @param {u32} timeout - The amount of time to wait and timeout in milliseconds.
   * @returns {Result<NetworkResultType>} A wrapper to a TCPResultType. If an error occured, the
   * errorString property will return a string describing the error.
   */
  writeStaticArray<T extends StaticArray<U>, U>(array: T): Result<NetworkResultType> {
    if (isReference<U>()) ERROR("Cannot call writeStaticArray if type of U is a reference.");
    let byteLength = (<usize>array.length) << alignof<U>();
    return this.writeUnsafe(changetype<usize>(array), byteLength);
  }

  /**
   * Write the bytes of an ArrayBuffer to the TCPStream.
   *
   * @param {ArrayBuffer} buffer - The buffer to be written.
   * @param {u32} timeout - The amount of time to wait and timeout in milliseconds.
   * @returns {Result<NetworkResultType>} A wrapper to a TCPResultType. If an error occured, the
   * errorString property will return a string describing the error.
   */
  writeBuffer(buffer: ArrayBuffer): Result<NetworkResultType> {
    return this.writeUnsafe(changetype<usize>(buffer), <usize>buffer.byteLength);
  }

  /**
   * Write data to the socket using a raw pointer. Considdered unsafe.
   *
   * @param {usize} ptr - The pointer to the data being written.
   * @param {usize} len - The length of the data being written.
   * @param {u32} timeout - The amount of time to wait and timeout in milliseconds.
   * @returns {Result<NetworkResultType>} A wrapper to a TCPResultType. If an error occured, the
   * errorString property will return a string describing the error.
   */
  @unsafe writeUnsafe(ptr: usize, len: usize): Result<NetworkResultType> {
    // Statically allocate an iovec for writing data
    let vec = changetype<iovec>(memory.data(offsetof<iovec>()));
    vec.buf = ptr;
    vec.buf_len = len;

    // call tcp_write_vectored
    let result = tcp.tcp_write_vectored(this.id, vec, 1, opaquePtr);
    let opaqueValue = load<u64>(opaquePtr);

    if (result == TimeoutErrCode.Success) {
      if (opaqueValue == 0) {
        return new Result<NetworkResultType>(NetworkResultType.Closed);
      }
      this.byteCount = <u32>opaqueValue;
      return new Result<NetworkResultType>(NetworkResultType.Success);
    } else if (result == TimeoutErrCode.Fail) {
      // count is actually an index to an error
      return new Result<NetworkResultType>(NetworkResultType.Error, opaqueValue);
    } else {
      error.drop_error(opaqueValue);
      assert(result == TimeoutErrCode.Timeout);
      return new Result<NetworkResultType>(NetworkResultType.Timeout);
    }
  }

  /**
   * Clone the tcp stream and return a new reference to it.
   *
   * @returns A new tcp socket with the same stream id.
   */
  clone(): TCPSocket {
    return new TCPSocket(tcp.clone_tcp_stream(this.id), this.ip);
  }

  /** Get or set the read timeout for tcp reads in milliseconds. */
  get readTimeout(): u64 {
    return tcp.get_read_timeout(this.id);
  }

  set readTimeout(value: u64) {
    tcp.set_read_timeout(this.id, value);
  }

  /** Get or set the peek timeout for tcp peeks in milliseconds. */
  get peekTimeout(): u64 {
    return tcp.get_peek_timeout(this.id);
  }

  set peekTimeout(value: u64) {
    tcp.set_peek_timeout(this.id, value);
  }



  /** Utilized by ason to serialize a socket. */
  __asonSerialize(): StaticArray<u8> {
    let id = tcp.clone_tcp_stream(this.id);
    let messageId = message.push_tcp_stream(id);
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
    let id = message.take_tcp_stream(messageId);
    let ip = __new(offsetof<IPAddress>(), idof<IPAddress>());
    memory.copy(ip, ptr + sizeof<u64>(), offsetof<IPAddress>());
    this.id = id;
    this.ip = changetype<IPAddress>(ip);
  }
}

/**
 * Represents a TCPListener, waiting for incoming TCP connections at the bound
 * address.
 *
 * Construct one with the `TCPServer.bind()` method.
 */
export class TCPServer extends ASManaged {
  constructor(
    /** The id of this TCPServer. */
    public id: u64,
    public ip: IPAddress,
  ) {
    super(id, tcp.drop_tcp_listener);
  }

  /**
   * Bind a TCPServer to an IP address.
   *
   * @returns {Result<TCPServer | null>} The resulting TCPServer or an error.
   */
  static bind(ip: IPAddress): Result<TCPServer | null> {
    return TCPServer.bindUnsafe(changetype<usize>(ip), ip.type, ip.port, ip.flowInfo, ip.scopeId);
  }

  /**
   * Bind a TCPServer unsafely to a local address.
   *
   * @param {usize} addressPtr - A pointer to the address.
   * @param {IPType} addressType - The IP Address type.
   * @param {u16} port - The port to listen on.
   * @param {u32} flowInfo - The IP Address flow info.
   * @param {u32} scopeId - The IP Address scope id.
   * @returns {Result<TCPServer | null>} The resulting TCPServer or an error.
   */
  @unsafe static bindUnsafe(
    addressPtr: usize,
    addressType: IPType,
    port: u16,
    flowInfo: u32,
    scopeId: u32,
  ): Result<TCPServer | null> {
    let result = tcp.tcp_bind(addressType, addressPtr, port, flowInfo, scopeId, opaquePtr);
    let id = load<u64>(opaquePtr);
    if (result == ErrCode.Success) {
      let ipResult = tcp.tcp_local_addr(id, opaquePtr);
      let iteratorId = load<u64>(opaquePtr);
      if (ipResult == ErrCode.Success) {
        let ipAddress = resolveDNSIterator(iteratorId);
        assert(ipAddress.length == 1);
        let server = new TCPServer(id, ipAddress[0]);
        return new Result<TCPServer | null>(server);
      }
      tcp.drop_tcp_listener(id);
      return new Result<TCPServer | null>(null, iteratorId);
    }
    return new Result<TCPServer | null>(null, id);
  }

  /** Utilized by ason to serialize a process. */
  __asonSerialize(): StaticArray<u8> {
    ERROR("TCPServer cannot be serialized.");
  }

  /** Utilized by ason to deserialize a process. */
  __asonDeserialize(_buffer: StaticArray<u8>): void {
    ERROR("TCPServer cannot be deserialized.");
  }

  /**
   * Accept a TCP connection. This method blocks the current thread indefinitely, waiting for an
   * incoming TCP connection.
   */
  accept(): Result<TCPSocket | null> {
    let result = tcp.tcp_accept(this.id, idPtr, opaquePtr);
    let id = load<u64>(idPtr);
    if (result == ErrCode.Success) {
      let dns_iterator = load<u64>(opaquePtr);
      let ipResolutions = resolveDNSIterator(dns_iterator);
      assert(ipResolutions.length == 1);
      return new Result<TCPSocket | null>(new TCPSocket(id, unchecked(ipResolutions[0])))
    }
    return new Result<TCPSocket | null>(null, id);
  }
}
