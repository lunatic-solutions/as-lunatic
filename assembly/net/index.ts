import { err_code, getError } from "../error";

/**
 * Resolve a hostname to an array of ip addresses.
 *
 * @param {usize} name_ptr - A pointer to the hostname to be resolved.
 * @param {usize} name_len - The length of the hostname string.
 * @param {usize} resolver_id - A pointer to a u32 that will contain the result id
 * that represents an iterator.
 * @returns {ResolveResult} The Resolution result.
 */
// @ts-ignore: valid decorator
@external("lunatic", "resolve")
declare function lunatic_resolve(
  name_ptr: usize /* *const u8 */,
  name_len: usize,
  resolver_id: usize /* *mut u64 */
): err_code;

/**
 * The iterator result.
 */
const enum ResolveNextResult {
  /** This value indicates there are more IP addresses to be iterated over. */
  Success = 0,
  /** The IP addresses are exhausted, and iteration is complete. */
  Done = 1,
}

/**
 * Write the next IP address into memory if it exists.
 *
 * @param {u64} resolver_id - The iterator id.
 * @param {usize} addr - A pointer to 16 allocated bytes to write the resolved IP address.
 * @param {usize} addr_len - A pointer to a usize to write the length of the resolved IP address.
 * @param {usize} port - A pointer to a u16 to write the port number of the resolved IP address.
 * @param {usize} flow_info - A pointer to a u32 to write the flow_info of the resolved IP address.
 * @param {usize} scope_id - A pointer to a u32 to write the scope_id of the resolved IP address.
 * @returns {ResolveNextResult} The result of iterating over the next IP address. If it returns
 * Success, there is another IP address to retrieve.
 */
// @ts-ignore: valid decorator
@external("lunatic", "resolve_next")
declare function resolve_next(
  resolver_id: u64,
  addr: usize /* *mut u8 */,
  addr_len: usize /* *mut usize */,
  port: usize /* *mut u16 */,
  flow_info: usize /* *mut u32 */,
  scope_id: usize /* *mut u32 */,
): ResolveNextResult;

/**
 * Free an ip resolution iterator.
 *
 * @param {u64} id - The iterator id.
 */
// @ts-ignore: valid decorator
@external("lunatic", "drop_dns_iterator")
declare function drop_dns_iterator(id: u64): void;

/** Represents the result of an operation. */
export class TCPResult<T> {
  constructor(
    public message: string | null,
    public value: T,
  ) {}
}

/**
 * A resulting IPResolution.
 */
export class IPAddress {
  /** An array of bytes representing the IP address. */
  address: StaticArray<u8> | null = null;
  /** The length of the IP address. 4 or 16. */
  address_len: usize;
  /** The port. */
  port: u16;
  /** The flow info. */
  flow_info: u32;
  /** The scope_id. */
  scope_id: u32;

  /** Clone an IP. */
  clone(): IPAddress {
    let result = new IPAddress();
    result.address = this.address ? this.address.slice(0) : null;
    result.address_len = this.address_len;
    result.port = this.port;
    result.flow_info = this.flow_info
    result.scope_id = this.scope_id;
    return result;
  }
}

/**
 * Close a tcp server.
 *
 * @param {u64} listener - The TCPServer id that should be closed.
 */
// @ts-ignore: valid decorator
@external("lunatic", "drop_tcp_listener")
declare function drop_tcp_listener(listener: u64): void;

/** Drop a tcp stream by it's id. */
// @ts-ignore: valid decorator
@external("lunatic", "drop_tcp_stream")
declare function drop_tcp_stream(stream: u64): void;

/** Clone a socket, return it's new id. */
// @ts-ignore: valid decorator
@external("lunatic", "clone_tcp_stream")
declare function clone_tcp_stream(stream: u64): u64;

/**
 * Block the current process and read from the given TCPStream.
 *
 * @param {u64} stream - The given stream id.
 * @param {usize} ptr - [*mut u8] A pointer to an allocated space of memory for the bytes.
 * @param {usize} len - The maximum number of bytes to be read.
 * @param {usize} opaque - [*mut usize] A pointer to write the number of bytes written.
 */
// @ts-ignore: valid decorator
@external("lunatic", "tcp_read")
declare function tcp_read(stream: u64, ptr: usize, len: usize, opaque: usize): err_code;

/** A pointer to an ip resolution iterator. */
const resolverIdPtr = memory.data(sizeof<u64>());

/**
 * Resolve an ip address from a host name.
 *
 * @param {string} host - The host or ip address name that should be resolved.
 * @returns {IPAddress[] | null} null if the IP could not be resolved.
 */
export function resolve(host: string): TCPResult<IPAddress[] | null> {
  // encode the ip address to utf8
  let ipBuffer = String.UTF8.encode(host);
  // call the host to resolve the IP address
  let resolveResult = lunatic_resolve(
    changetype<usize>(ipBuffer),
    ipBuffer.byteLength,
    // write the resolver to memory
    resolverIdPtr
  );

  if (resolveResult == err_code.Success) {
    // read the resolver id
    let resolverId = load<u64>(resolverIdPtr);

    return new TCPResult<IPAddress[] | null>(null, dns_iterator_to_array(resolverId));
  } else {
    return new TCPResult<IPAddress[] | null>(
      getError(load<u64>(resolverIdPtr)),
      null,
    );
  }
}


/**
 * Bind a TCPServer to an IP Address and port.
 *
 * @param {usize} addr_len - The length of the IP address, 4 or 16.
 * @param {usize} addr_ptr - A pointer to the address bytes.
 * @param {u16} port - The port.
 * @param {usize} listener_id - A pointer to a u32 that will be the TCPServer
 * listener ID.
 * @returns {TCPErrorCode} The result of binding to an IP address.
 */
// @ts-ignore: valid decorator
@external("lunatic", "tcp_bind")
declare function tcp_bind(
  addr_len: usize,
  addr_ptr: usize,// *const u8,
  port: u16,
  flow_info: u32,
  scope_id: u32,
  listener_id: usize, //*mut u32,
): err_code;

/**
 * Block the current thread to accept a socket from the TCPServer.
 *
 * @param {u32} listener - The listener.
 * @param {usize} tcp_socket - A pointer to a u64 that will contain the socket id.
 * @param {usize} address_ptr - A pointer to a u64 that will contain a dns iterator.
 * @returns {err_code} The result of accepting a tcp socket.
 */
// @ts-ignore: valid decorator
@external("lunatic", "tcp_accept")
declare function tcp_accept(
  listener: u32,
  tcp_socket: usize, //*mut u64
  address_ptr: usize, //*mut u64
): err_code;

/**
 * Initiate a TCP connection.
 *
 * @param {usize} addr_ptr - A pointer to an array of bytes.
 * @param {usize} addr_len - A pointer to a usize that describes the length of the IP address.
 * @param {u16} port - The port.
 * @param {u32} flow_info - The flow info. (ipv6)
 * @param {u32} scope_id - The scope id. (ipv6)
 * @param {usize} listener_id - A pointer to a u32 where the listener_id will be written if
 * the connection was successful, or the error id if it failed.
 * @returns {TCPErrorCode} The result of initiating a TCP connection.
 */
// @ts-ignore: valid decorator
@external("lunatic", "tcp_connect")
declare function tcp_connect(
  addr_ptr: usize, // *const u8,
  addr_len: usize,
  port: u16,
  flow_info: u32,
  scope_id: u32,
  listener_id: usize, // *mut u64,
): err_code;

const opaqueu64Ptr = memory.data(sizeof<u64>());

/**
 * This class represents a TCPServer. In order to obtain a reference to a TCPServer,
 * lunatic must provide a `listener_id` by calling the lunatic.tcp_bind method. Typical
 * end users will call the `TCPServer.bind(ip, port)` method to obtain a reference.
 */
 export class TCPServer {
  constructor(private listener: u32) {}

  /** Public ason deserialize method. */
  public __asonDeserialize(buffer: StaticArray<u8>): void {
    //this.listener = tcp_listener_deserialize(load<u32>(changetype<usize>(buffer)));
    this.listener = 0;
  }

  /** Public ason serialize method. */
  public __asonSerialize(): StaticArray<u8> {
    // let buffer = new StaticArray<u8>(sizeof<u32>());
    // store<u32>(changetype<usize>(buffer), tcp_listener_serialize(this.listener));
    // return buffer;
    return new StaticArray<u8>();
  }

  /**
   * Bind a TCPServer to an address and a port.
   *
   * @param {StaticArray<u8>} address - The address in an array of bytes.
   * @param {u16} port - The port.
   * @returns {TCPResult<TCPServer | null>} The error code and TCPServer if the error code was 0
   */
  public static bind(
    address: StaticArray<u8>,
    port: u16,
    flow_info: u32,
    scope_id: u32): TCPResult<TCPServer | null> {

    let result = new TCPServer(0);
    // tcp_bind writes the listener id here
    let code = tcp_bind(
      address.length,
      changetype<usize>(address),
      port,
      flow_info,
      scope_id,
      changetype<usize>(result)
    );
    if (code === err_code.Success) {
      return new TCPResult<TCPServer | null>(null, result);
    } else {
      return new TCPResult<TCPServer | null>(
        getError(result.listener),
        null,
      );
    }
  }

  /**
   * Block the current process and accept a TCPSocket if it was succesfully obtained.
   * @returns {TCPStream | null} null if the tcp server errored.
   */
  public accept(): TCPResult<TCPStream | null> {
    let code = tcp_accept(this.listener, opaqueu64Ptr, resolverIdPtr);
    let tcpStreamId = load<u64>(opaqueu64Ptr);

    if (code == err_code.Success) {
      let resolution = dns_iterator_to_array(load<u64>(resolverIdPtr));
      assert(resolution.length == 1);
      return new TCPResult<TCPStream | null>(
        null,
        new TCPStream(tcpStreamId, resolution[0]),
      );
    } else {
      return new TCPResult<TCPStream | null>(
        getError(tcpStreamId),
        null,
      );
    }
  }

  /**
   * TCP Servers should always be dropped to free up memory when they are no longer in use.
   */
  public drop(): void {
    drop_tcp_listener(this.listener);
  }
}

/**
 * This function accepts a dns_iterator id, and resolves it to an array of IPResolution.
 * @param {u64} id - The iterator.
 * @returns an array of IPResolution.
 */
export function dns_iterator_to_array(id: u64): IPAddress[] {
  // loop over each IPResolution and add it to the list
  let ipArray = new Array<IPAddress>(0);
  while (true) {
    // must always allocate 16 bytes
    let buffer = new StaticArray<u8>(16);
    let resolution = new IPAddress();
    resolution.address = buffer;

    // the host iterates over each result until it returns Done
    let resolutionResult = resolve_next(
      id,
      changetype<usize>(buffer),
      changetype<usize>(resolution) + offsetof<IPAddress>("addr_len"),
      changetype<usize>(resolution) + offsetof<IPAddress>("port"),
      changetype<usize>(resolution) + offsetof<IPAddress>("flow_info"),
      changetype<usize>(resolution) + offsetof<IPAddress>("scope_id"),
    );
    if (resolutionResult == ResolveNextResult.Done) break;
    ipArray.push(resolution);
  }
  drop_dns_iterator(id);
  return ipArray;
}

export function connect_ip(ip: IPAddress): TCPResult<TCPStream | null> {
  return connect_unsafe(
    changetype<usize>(ip.address),
    ip.address_len,
    ip.port,
    ip.flow_info,
    ip.scope_id,
  );
}

export function connect(
  address: StaticArray<u8>,
  port: u16,
  flow_info: u32,
  scope_id: u32,
  ): TCPResult<TCPStream | null> {
  return connect_unsafe(
    changetype<usize>(address),
    <usize>address.length,
    port,
    flow_info,
    scope_id,
  );
}

/**
 * Actually requests a host connection with a raw pointer to address data. Considdered unsafe
 * because passing around pointers can be dangerous.
 *
 * @param {usize} address_ptr - [u8*] The address pointer, 4 or 16 bytes in length
 * @param {usize} address_len - The address length, 4 or 16
 * @param {u16} port - The port number for the connection.
 * @param {u32} flow_info - Flow info, [ipv6]
 * @param {u32} scope_id - Scope id, [ipv6]
 * @returns {TCPResult<TCPStream | null>} The result of attempting to open a tcp connection with a server.
 */
// @ts-ignore: valid decorator
@unsafe export function connect_unsafe(
  address_ptr: usize,
  address_len: usize,
  port: u16,
  flow_info: u32,
  scope_id: u32,
  ): TCPResult<TCPStream | null> {
  let result = tcp_connect(
    address_ptr,
    address_len,
    port,
    flow_info,
    scope_id,
    opaqueu64Ptr,
  );

  if (result === err_code.Success) {
    let resolution = new IPAddress();
    let ip = new StaticArray<u8>(<i32>address_len);
    memory.copy(changetype<usize>(ip), address_ptr, address_len);
    resolution.address = ip;
    resolution.address_len = address_len;
    resolution.port = port;
    resolution.flow_info = flow_info;
    resolution.scope_id = scope_id;
    return new TCPResult<TCPStream | null>(
      null,
      new TCPStream(
        load<u64>(opaqueu64Ptr),
        resolution,
      ),
    );
  } else {
    return new TCPResult<TCPStream | null>(
      getError(load<u64>(opaqueu64Ptr)),
      null,
    );
  }
}

export class TCPStream {
  private dropped: bool = false;

  constructor(public listener: u64, public ip: IPAddress) {}

  drop(): void {
    drop_tcp_stream(this.listener);
    this.dropped = true;
  }

  clone(): TCPResult<TCPStream | null> {
    if (this.dropped) {
      return new TCPResult<TCPStream | null>(
        "Cannot clone a dropped socket.",
        null,
      );
    }
    return new TCPResult<TCPStream | null>(
      null,
      new TCPStream(
        clone_tcp_stream(this.listener),
        this.ip.clone(),
      ),
    );
  }

  /**
   * Read data from this tcp stream into a given static array.
   *
   * @param {StaticArray<u8>} buffer - The buffer the bytes will be written to.
   * @returns The number of bytes written.
   */
  read_static_array(buffer: StaticArray<u8>): TCPResult<usize> {
    return this.read_unsafe(
      changetype<usize>(buffer),
      <usize>buffer.length,
    );
  }

  /**
   * Read data into a given typed array, will use the backing buffer's byteLength to
   * determine the maximum number of bytes to be written.
   *
   * @param {U} buffer - The TypedArray that will be written to.
   * @returns The number of bytes written. Can calculate the number of indicies written
   * by using `<i32>(bytesWritten >>> alignof<valueof<U>>())`.
   */
  read_typed_array<U extends ArrayBufferView>(buffer: U): TCPResult<usize> {
    let ptr = changetype<usize>(buffer.buffer) + <usize>buffer.byteOffset;
    return this.read_unsafe(ptr, <usize>buffer.byteLength);
  }

  /**
   * Read data from this tcp stream into a given array buffer.
   *
   * @param {ArrayBuffer} buffer - The buffer the bytes will be written to.
   * @returns The number of bytes written.
   */
  read_array_buffer(buffer: ArrayBuffer): TCPResult<usize> {
    return this.read_unsafe(
      changetype<usize>(buffer),
      <usize>buffer.byteLength,
    );
  }

  /**
   * Read data from this TCPStream, and return the number of bytes writen.
   *
   * @param {usize} ptr - [*mut u8] A pointer to the location where the bytes will be written.
   * @param {usize} len - The maximum number of bytes to be written.
   * @returns The number of bytes written.
   */
  read_unsafe(ptr: usize, len: usize): TCPResult<usize> {
    let result = tcp_read(this.listener, ptr, len, opaqueu64Ptr);
    if (result == err_code.Success) {
      return new TCPResult<usize>(
        null,
        <usize>load<u64>(opaqueu64Ptr),
      );
    } else {
      return new TCPResult<usize>(
        getError(load<u64>(opaqueu64Ptr)),
        0,
      );
    }
  }
}

