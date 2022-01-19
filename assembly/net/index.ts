import { Result, idPtr } from "../error";
import { net, message } from "../bindings";
import { ErrCode, IPType, NetworkErrCode as NetworkErrCode } from "../util";
import { iovec } from "bindings/wasi";
import { ASManaged } from "as-disposable";
import { error } from "..";


// @ts-ignore: @lazy!
@lazy const opaquePtr = memory.data(sizeof<u64>());

// @ts-ignore: @lazy!
@lazy const ipAddressPointer = memory.data(offsetof<IPAddress>());

/** Represents an IP Address, v6 or v4. */
export class IPAddress {
  // allocate 16 bytes for the address
  private _address_1: u64 = 0;
  private _address_2: u64 = 0;
  public type: IPType = IPType.None;
  public port: u16 = 0;
  public flowInfo: u32 = 0;
  public scopeId: u32 = 0;

  constructor() {}

  /** Load an IPAddress object from the DNS Iterator pointer. */
  static load(): IPAddress {
    let ip = new IPAddress();
    memory.copy(changetype<usize>(ip), ipAddressPointer, offsetof<IPAddress>());
    return ip;
  }

  /** Perform a memcopy of the IP address and return a new buffer. */
  public get ip(): StaticArray<u8> {
    let type = this.type;
    if (type == IPType.None) assert(false);
    let result = new StaticArray<u8>(4);
    memory.copy(changetype<usize>(result), changetype<usize>(this), select<usize>(i32(type == IPType.IPV4), 16, 4));
    return result;
  }
}

/** The different tcp read results. */

export const enum NetworkResultType {
  Success,
  Timeout,
  Closed,
  Error,
}

/**
 * Resolve the contents of a DNS Iterator.
 * @param {u64} id - The dns iterator id.
 * @returns {IPAddress[]} The IPResolution array.
 */
export function resolveDNSIterator(id: u64): IPAddress[] {
  let value: IPAddress[] = [];

  // obtain the ip resolutions
  while (net.resolve_next(id,
    ipAddressPointer + offsetof<IPAddress>("type"),
    ipAddressPointer,
    ipAddressPointer + offsetof<IPAddress>("port"),
    ipAddressPointer + offsetof<IPAddress>("flowInfo"),
    ipAddressPointer + offsetof<IPAddress>("scopeId")) == ErrCode.Success) {
    // IPResolution will automatically load from the pointers
    value.push(IPAddress.load());
  }

  // always drop if successful
  net.drop_dns_iterator(id);
  return value;
}

/**
 * Resolve a hostname it it's given IPResolutions.
 *
 * @param {string} host - The host to be resolved.
 * @param {u32} timeout - The timeout.
 * @returns {Result<IPAddress[] | null>} The resulting IPResolution set.
 */
export function resolve(host: string, timeout: u32 = 0): Result<IPAddress[] | null> {
  // encode the string to utf8
  let namePtr = String.UTF8.encode(host);

  // resolve the host
  let result = net.resolve(changetype<usize>(namePtr), <usize>namePtr.byteLength, timeout, idPtr);

  // process the result
  let id = load<u64>(idPtr);
  if (result == ErrCode.Success) {
    let value: IPAddress[] = resolveDNSIterator(id);
    return new Result<IPAddress[] | null>(value);
  }
  return new Result<IPAddress[] | null>(null, id);
}

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
    let result = net.tcp_connect(
      addr_type,
      addr_ptr,
      port,
      flow_info,
      scope_id,
      timeout,
      idPtr,
    );
    let id = load<u64>(idPtr);
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
    super(id, net.drop_tcp_stream);
  }

  /**
   * Read a buffer from the TCP Stream with a timeout.
   *
   * @param {u32} timeout - How long a read should wait until the request times out.
   * @returns {StaticArray<u8>} The resulting buffer.
   */
  read(timeout: u32 = 0): Result<NetworkResultType> {

    // Static data memory pointer
    let ptr = memory.data(TCP_READ_VECTOR_SIZE);
    let id = this.id;

    // call tcp read
    let readResult = net.tcp_read(id, ptr, TCP_READ_VECTOR_SIZE, timeout, idPtr);
    let bytesRead = load<u64>(idPtr);

    if (readResult == NetworkErrCode.Success) {

      // if no bytes were read, the socket is closed
      if (bytesRead == 0) return new Result<NetworkResultType>(NetworkResultType.Closed);

      // copy the bytes to a new static array
      let buffer = new StaticArray<u8>(<i32>bytesRead);
      memory.copy(changetype<usize>(buffer), ptr, <usize>bytesRead);

      // store the result
      this.buffer = buffer;
      this.byteCount = <usize>bytesRead;

      // return success
      return new Result<NetworkResultType>(NetworkResultType.Success);
    } else if (readResult == NetworkErrCode.Fail) {
      // failure means that bytesRead has an error id
      return new Result<NetworkResultType>(NetworkResultType.Error, bytesRead);
    } else {
      error.drop_error(bytesRead);
      // this must be a timeout
      assert(readResult == NetworkErrCode.Timeout);
      return new Result<NetworkResultType>(NetworkResultType.Timeout);
    }
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
    let result = net.tcp_write_vectored(this.id, vec, 1, timeout, idPtr);
    let count = load<u64>(idPtr);

    if (result == NetworkErrCode.Success) {
      if (count == 0) {
        return new Result<NetworkResultType>(NetworkResultType.Closed);
      }
      this.byteCount = <u32>count;
      return new Result<NetworkResultType>(NetworkResultType.Success);
    } else if (result == NetworkErrCode.Fail) {
      // count is actually an index to an error
      return new Result<NetworkResultType>(NetworkResultType.Error, count);
    } else {
      error.drop_error(count);
      assert(result == NetworkErrCode.Timeout);
      return new Result<NetworkResultType>(NetworkResultType.Timeout);
    }
  }

  clone(): TCPSocket {
    return new TCPSocket(net.clone_tcp_stream(this.id), this.ip);
  }

  /** Utilized by ason to serialize a socket. */
  __asonSerialize(): StaticArray<u8> {
    let id = net.clone_tcp_stream(this.id);
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
    super(id, net.drop_tcp_listener);
  }

  /**
   * Bind a TCPServer to an IPV4 address.
   *
   * @param {StaticArray<u8>} ip - Must be at least 4 bytes long, the first four bytes will be used.
   * @param {u16} port - The port to bind to.
   * @returns {Result<TCPServer | null>} The resulting TCPServer or an error.
   */
  static bindIPv4(ip: StaticArray<u8>, port: u16): Result<TCPServer | null> {
    assert(ip.length >= 4);
    return TCPServer.bindUnsafe(changetype<usize>(ip), IPType.IPV4, port, 0, 0);
  }

  /**
   * Bind a TCPServer to an IPV6 address.
   *
   * @param {StaticArray<u8>} ip - Must be at least 16 bytes long, the first 16 bytes will be used.
   * @param {u16} port - The port to bind to.
   * @param {u32} flowInfo - The flow info of the IP address.
   * @param {u32} scopeId - The scope id of the IP address.
   * @returns {Result<TCPServer | null>} The resulting TCPServer or an error.
   */
  static bindIPv6(ip: StaticArray<u8>, port: u16, flowInfo: u32, scopeId: u32): Result<TCPServer | null> {
    assert(ip.length >= 4);
    return TCPServer.bindUnsafe(changetype<usize>(ip), IPType.IPV6, port, flowInfo, scopeId);
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
    let result = net.tcp_bind(addressType, addressPtr, port, flowInfo, scopeId, idPtr);
    let id = load<u64>(idPtr);
    if (result == ErrCode.Success) {
      let ipResult = net.local_addr(id, idPtr);
      let iteratorId = load<u64>(idPtr);
      if (ipResult == ErrCode.Success) {
        let ipAddress = resolveDNSIterator(iteratorId);
        assert(ipAddress.length == 1);
        let server = new TCPServer(id, ipAddress[0]);
        return new Result<TCPServer | null>(server);
      }
      net.drop_tcp_listener(id);
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
    let result = net.tcp_accept(this.id, idPtr, opaquePtr);
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

export class UDPSocket extends ASManaged {
  static bindAddress(addr: IPAddress): Result<UDPSocket | null> {
    return UDPSocket.bindUnsafe(
      addr.type,
      changetype<usize>(addr),
      addr.port,
      addr.flowInfo,
      addr.scopeId,
    );
  }

  static bindIPV4(ip: StaticArray<u8>, port: u16 = 0): Result<UDPSocket | null> {
    assert(ip.length >= 4);
    return UDPSocket.bindUnsafe(
      IPType.IPV4,
      changetype<usize>(ip),
      port,
      0,
      0,
    );
  }
  static bindIPV6(ip: StaticArray<u8>, port: u16 = 0, flowInfo: u32, scopeId: u32): Result<UDPSocket | null> {
    assert(ip.length >= 16);
    return UDPSocket.bindUnsafe(
      IPType.IPV6,
      changetype<usize>(ip),
      port,
      flowInfo,
      scopeId,
    );
  }

  @unsafe static bindUnsafe(
    addressType: IPType,
    addressPtr: usize,
    port: u16,
    flowInfo: u32,
    scopeId: u32,

  ): Result<UDPSocket | null> {
    let result = net.udp_bind(
      addressType,
      addressPtr,
      port,
      flowInfo,
      scopeId,
      idPtr,
    );
    let socketId = load<u64>(idPtr);
    if (result == ErrCode.Success) {
      return new Result<UDPSocket | null>(new UDPSocket(socketId));
    }
    return new Result<UDPSocket | null>(null, socketId);
  }

  constructor(
    public id: u64,
  ) {
    super(id, net.drop_udp_socket);
  }

  public byteCount: usize = 0;

  public buffer: StaticArray<u8> | null = null;
  public ip: IPAddress | null = null;

   /** Utilized by ason to serialize a socket. */
  __asonSerialize(): StaticArray<u8> {
    let id = net.clone_udp_socket(this.id);
    let messageId = message.push_udp_socket(id);
    let buff = new StaticArray<u8>(sizeof<u64>());
    let ptr = changetype<usize>(buff);
    store<u64>(ptr, messageId);
    // memory.copy(ptr + sizeof<u64>(), changetype<usize>(this.ip), offsetof<IPAddress>());
    return buff;
  }

  __asonDeserialize(buffer: StaticArray<u8>): void {
    assert(buffer.length == sizeof<u64>());
    let id = load<u64>(changetype<usize>(buffer));
    this.id = message.take_udp_socket(id);
  }

  /**
   * Send a buffer to the given address using udp.
   *
   * @param {StaticArray<u8>} buffer - The buffer to send.
   * @param {IPAddress} addr - The IPAddress to send to.
   * @param {u32} timeout - How long to wait until the operation times out.
   * @returns {Result<NetworkResultType>} The result of sending a message to the given IPAddress using the socket.
   */
  sendTo(buffer: StaticArray<u8>, addr: IPAddress, timeout: u32 = 0): Result<NetworkResultType> {
    let result = net.udp_send_to(
      this.id,
      changetype<usize>(buffer),
      <usize>buffer.length,
      addr.type,
      changetype<usize>(addr),
      addr.port,
      addr.flowInfo,
      addr.scopeId,
      timeout,
      idPtr,
    );
    let bytesWritten = load<u64>(idPtr);
    if (result == NetworkErrCode.Success) {
      if (bytesWritten == 0) return new Result<NetworkResultType>(NetworkResultType.Closed);
      this.byteCount = <usize>bytesWritten;
      return new Result<NetworkResultType>(NetworkResultType.Success);
    } else if (result == NetworkErrCode.Fail) {
      return new Result<NetworkResultType>(NetworkResultType.Error, bytesWritten);
    } else {
      error.drop_error(bytesWritten);
      assert(result == NetworkErrCode.Timeout);
      return new Result<NetworkResultType>(NetworkResultType.Timeout);
    }
  }

  read(timeout: u32 = 0): Result<NetworkResultType> {
    let udpBuffer = memory.data(UDP_READ_BUFFER_SIZE);
    let result = net.udp_read(
      this.id,
      udpBuffer,
      UDP_READ_BUFFER_SIZE,
      timeout,
      opaquePtr,
      idPtr,
    );
    let bytesWritten = load<u64>(opaquePtr);
    if (result == NetworkErrCode.Success) {
      let buffer = new StaticArray<u8>(bytesWritten);
      let dnsId = load<u64>(idPtr);
      let ips = resolveDNSIterator(dnsId);
      assert(ips.length == 1);
      memory.copy(changetype<usize>(buffer), udpBuffer, <usize>bytesWritten);
      this.buffer = buffer;
      this.byteCount = bytesWritten;
      this.ip = unchecked(ips[0]);
      return new Result<NetworkResultType>(NetworkResultType.Success);
    } else if (result == NetworkErrCode.Fail) {
      return new Result<NetworkResultType>(NetworkResultType.Error, bytesWritten);
    } else {
      error.drop_error(bytesWritten);
      assert(result == NetworkErrCode.Timeout);
      return new Result<NetworkResultType>(NetworkResultType.Timeout);
    }
  }

  /** Set or get if this socket should broadcast. */
  get broadcast(): bool {
    return net.get_udp_socket_broadcast(this.id);
  }

  set broadcast(value: bool) {
    net.set_udp_socket_broadcast(this.id, value);
  }

  /** Set or get the time to live for this socket. */
  get ttl(): u32 {
    return net.get_udp_socket_ttl(this.id);
  }

  set ttl(value: u32) {
    net.set_udp_socket_ttl(this.id, value);
  }

  /** Clone the current socket. */
  clone(): UDPSocket {
    return new UDPSocket(net.clone_udp_socket(this.id));
  }
}