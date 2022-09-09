import { iovec } from "@assemblyscript/wasi-shim/assembly/bindings/wasi_snapshot_preview1";
import { ASManaged } from "as-disposable";
import { getError, Result } from "../error";
import { error } from "../error/bindings";
import { message } from "../message/bindings";
import { ErrCode, TimeoutErrCode } from "../util";
import { tcp } from "./bindings";
import { IPAddress, IPType, NetworkResultType, opaquePtr, TCPResult } from "./util";

// @ts-ignore: @lazy is valid here
@lazy const tcpReadPointer = memory.data(TCP_READ_VECTOR_SIZE);
// @ts-ignore: @lazy is valid here
@lazy let opaqueValue: u64 = 0;
// @ts-ignore: @lazy is valid here
@lazy let readResult: TimeoutErrCode = TimeoutErrCode.Success;


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
  static connectIP(ip: IPAddress, timeout: u32 = 0): Result<TCPSocket | null> {
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
  static connectIPV4(ip: StaticArray<u8>, port: u16, timeout: u32 = 0): Result<TCPSocket | null> {
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
  static connectIPV6(ip: StaticArray<u8>, port: u16, flow_info: u32, scope_id: u32, timeout: u32 = 0): Result<TCPSocket | null> {
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
  @unsafe static connectUnsafe(addr_type: IPType, addr_ptr: usize, port: u16, flow_info: u32, scope_id: u32, timeout: u32): Result<TCPSocket | null> {
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

      return new Result<TCPSocket | null>(new TCPSocket(id, ip), 0);
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

  /**
   * Perform the syscall to make a tcp read. The readResult global will be populated
   * with the result of the syscall, while the opaqueValue will be populated with 64 bytes
   * representing the error id, or the number of bytes read from the stream.
   */
  private readImpl(): void {
    readResult = tcp.tcp_read(this.id, tcpReadPointer, TCP_READ_VECTOR_SIZE, opaquePtr);
    opaqueValue = load<u64>(opaquePtr);
  }

  /**
   * Perform the syscall to make a tcp peek. The readResult global will be populated
   * with the result of the syscall, while the opaqueValue will be populated with 64 bytes
   * representing the error id, or the number of bytes read from the stream.
   */
  private peekImpl(): void {
    readResult = tcp.tcp_peek(this.id, tcpReadPointer, TCP_READ_VECTOR_SIZE, opaquePtr);
    opaqueValue = load<u64>(opaquePtr);
  }

  private readClosed<TData>(): TCPResult<TData> {
    return new TCPResult<TData>(
      NetworkResultType.Closed,
      null,
      null,
    );
  }

  private readSuccess<TData>(data: TData, writePtr: usize): TCPResult<TData> {
    memory.copy(
      writePtr,
      tcpReadPointer,
      <usize>opaqueValue,
    );
    return new TCPResult<TData>(
      NetworkResultType.Success,
      null,
      data,
    );
  }

  private readTimeoutResult<TData>(): TCPResult<TData> {
    return new TCPResult<TData>(
      NetworkResultType.Timeout,
      null,
      null,
    );
  }

  private readError<TData>(): TCPResult<TData> {
    let errorString = getError(opaqueValue);
    error.drop_error(opaqueValue);
    return new TCPResult<TData>(
      NetworkResultType.Error,
      errorString,
      null,
    );
  }

  readStaticArray<UData extends number>(): TCPResult<StaticArray<UData>> {
    this.readImpl();
    if (readResult == TimeoutErrCode.Success) {
      if (opaqueValue == 0) return this.readClosed<StaticArray<UData>>();
      let result = new StaticArray<UData>(<i32>opaqueValue);
      return this.readSuccess<StaticArray<UData>>(
        result,
        changetype<usize>(result),
      );
    }
    // timeouts are easy
    if (readResult == TimeoutErrCode.Timeout) return this.readTimeoutResult<StaticArray<UData>>();
    // must be an error
    return this.readError<StaticArray<UData>>();
  }

  /**
   * Read a buffer from the TCP Stream with a timeout.
   *
   * @returns {ArrayBuffer} The resulting buffer.
   */
  readBuffer(): TCPResult<ArrayBuffer> {
    this.readImpl();
    if (readResult == TimeoutErrCode.Success) {
      if (opaqueValue == 0) return this.readClosed<ArrayBuffer>();
      let result = new ArrayBuffer(<i32>opaqueValue);
      return this.readSuccess<ArrayBuffer>(
        result,
        changetype<usize>(result),
      );
    }
    // timeouts are easy
    if (readResult == TimeoutErrCode.Timeout) return this.readTimeoutResult<ArrayBuffer>();
    // must be an error
    return this.readError<ArrayBuffer>();
  }

  readTypedArray<TData extends ArrayBufferView>(): TCPResult<TData> {
    this.readImpl();
    if (readResult == TimeoutErrCode.Success) {
      if (opaqueValue == 0) return this.readClosed<TData>();
      let result = instantiate<TData>(<i32>opaqueValue);
      return this.readSuccess<TData>(
        result,
        result.dataStart,
      );
    }
    // timeouts are easy
    if (readResult == TimeoutErrCode.Timeout) return this.readTimeoutResult<TData>();
    // must be an error
    return this.readError<TData>();
  }

  readArray<TData extends number>(): TCPResult<Array<TData>> {
    this.readImpl();
    if (readResult == TimeoutErrCode.Success) {
      if (opaqueValue == 0) return this.readClosed<Array<TData>>();
      let result = instantiate<Array<TData>>(<i32>opaqueValue);
      return this.readSuccess<Array<TData>>(
        result,
        result.dataStart,
      );
    }
    // timeouts are easy
    if (readResult == TimeoutErrCode.Timeout) return this.readTimeoutResult<Array<TData>>();
    // must be an error
    return this.readError<Array<TData>>();
  }

  peekStaticArray<UData extends number>(): TCPResult<StaticArray<UData>> {
    this.peekImpl();
    if (readResult == TimeoutErrCode.Success) {
      if (opaqueValue == 0) return this.readClosed<StaticArray<UData>>();
      let result = new StaticArray<UData>(<i32>opaqueValue);
      return this.readSuccess<StaticArray<UData>>(
        result,
        changetype<usize>(result),
      );
    }
    // timeouts are easy
    if (readResult == TimeoutErrCode.Timeout) return this.readTimeoutResult<StaticArray<UData>>();
    // must be an error
    return this.readError<StaticArray<UData>>();
  }

  /**
   * Read a buffer from the TCP Stream with a timeout.
   *
   * @returns {ArrayBuffer} The resulting buffer.
   */
  peekBuffer(): TCPResult<ArrayBuffer> {
    this.peekImpl();
    if (readResult == TimeoutErrCode.Success) {
      if (opaqueValue == 0) return this.readClosed<ArrayBuffer>();
      let result = new ArrayBuffer(<i32>opaqueValue);
      return this.readSuccess<ArrayBuffer>(
        result,
        changetype<usize>(result),
      );
    }
    // timeouts are easy
    if (readResult == TimeoutErrCode.Timeout) return this.readTimeoutResult<ArrayBuffer>();
    // must be an error
    return this.readError<ArrayBuffer>();
  }

  peekTypedArray<TData extends ArrayBufferView>(): TCPResult<TData> {
    this.peekImpl();
    if (readResult == TimeoutErrCode.Success) {
      if (opaqueValue == 0) return this.readClosed<TData>();
      let result = instantiate<TData>(<i32>opaqueValue);
      return this.readSuccess<TData>(
        result,
        result.dataStart,
      );
    }
    // timeouts are easy
    if (readResult == TimeoutErrCode.Timeout) return this.readTimeoutResult<TData>();
    // must be an error
    return this.readError<TData>();
  }

  peekArray<TData extends number>(): TCPResult<Array<TData>> {
    this.peekImpl();
    if (readResult == TimeoutErrCode.Success) {
      if (opaqueValue == 0) return this.readClosed<Array<TData>>();
      let result = instantiate<Array<TData>>(<i32>opaqueValue);
      return this.readSuccess<Array<TData>>(
        result,
        result.dataStart,
      );
    }
    // timeouts are easy
    if (readResult == TimeoutErrCode.Timeout) return this.readTimeoutResult<Array<TData>>();
    // must be an error
    return this.readError<Array<TData>>();
  }


  /**
   * Write a typedarray's data to a TCPStream.
   *
   * @param {T extends ArrayBufferView} array - A static array to write the TCPStream
   * @param {u32} timeout - The amount of time to wait and timeout in milliseconds.
   */
  writeTypedArray<T extends ArrayBufferView>(array: T, timeout: u32 = 0): Result<NetworkResultType> {
    return this.writeUnsafe(array.dataStart, <usize>array.byteLength, timeout);
  }

  /**
   * Write a Array to the TCPStream.
   *
   * @param {T extends Array<U>} array - A static array to write the TCPStream
   * @param {u32} timeout - The amount of time to wait and timeout in milliseconds.
   * @returns {Result<NetworkResultType>} A wrapper to a TCPResultType. If an error occured, the
   * errorString property will return a string describing the error.
   */
  writeArray<T extends Array<U>, U>(array: T, timeout: u32 = 0): Result<NetworkResultType> {
    if (isReference<U>()) ERROR("Cannot call writeArray if type of U is a reference.");
    let byteLength = (<usize>array.length) << alignof<U>();
    return this.writeUnsafe(array.dataStart, byteLength, timeout);
  }

  /**
   * Write a StaticArray to the TCPStream.
   *
   * @param {T extends StaticArray<U>} array - A static array to write the TCPStream
   * @param {u32} timeout - The amount of time to wait and timeout in milliseconds.
   * @returns {Result<NetworkResultType>} A wrapper to a TCPResultType. If an error occured, the
   * errorString property will return a string describing the error.
   */
  writeStaticArray<T extends StaticArray<U>, U>(array: T, timeout: u32 = 0): Result<NetworkResultType> {
    if (isReference<U>()) ERROR("Cannot call writeStaticArray if type of U is a reference.");
    let byteLength = (<usize>array.length) << alignof<U>();
    return this.writeUnsafe(changetype<usize>(array), byteLength, timeout);
  }

  /**
   * Write the bytes of an ArrayBuffer to the TCPStream.
   *
   * @param {ArrayBuffer} buffer - The buffer to be written.
   * @param {u32} timeout - The amount of time to wait and timeout in milliseconds.
   * @returns {Result<NetworkResultType>} A wrapper to a TCPResultType. If an error occured, the
   * errorString property will return a string describing the error.
   */
  writeBuffer(buffer: ArrayBuffer, timeout: u32 = 0): Result<NetworkResultType> {
    return this.writeUnsafe(changetype<usize>(buffer), <usize>buffer.byteLength, timeout);
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
  @unsafe writeUnsafe(ptr: usize, len: usize, timeout: u32 = 0): Result<NetworkResultType> {
    // Statically allocate an iovec for writing data
    let vec = changetype<iovec>(memory.data(offsetof<iovec>()));
    vec.buf = ptr;
    vec.buf_len = len;

    // call tcp_write_vectored
    let result = tcp.tcp_write_vectored(this.id, vec, 1, timeout, opaquePtr);
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