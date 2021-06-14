import { iovec } from "bindings/wasi";

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
  resolver_id: usize /* *mut u32 */
): ResolveResult;

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
 * The result of resolving a host name.
 */
export const enum ResolveResult {
  /** A succesful result. */
  Success = 0,
  /** The host could not resolve the given hostname. */
  Fail = 1,
}

/**
 * Write the next IP address into memory if it exists.
 *
 * @param {u32} resolver_id - The iterator id.
 * @param {usize} addr - A pointer to 16 allocated bytes to write the resolved IP address.
 * @param {usize} addr_len - A pointer to a usize to write the length of the resolved IP address.
 * @param {usize} port - A pointer to a u16 to write the port number of the resolved IP address.
 * @param {usize} flowinfo - A pointer to a u32 to write the flowinfo of the resolved IP address.
 * @param {usize} scope_id - A pointer to a u32 to write the scope_id of the resolved IP address.
 * @returns {ResolveNextResult} The result of iterating over the next IP address. If it returns
 * Success, there is another IP address to retrieve.
 */
// @ts-ignore: valid decorator
@external("lunatic", "resolve_next")
declare function resolve_next(
  resolver_id: u32,
  addr: usize /* *mut u8 */,
  addr_len: usize /* *mut usize */,
  port: usize /* *mut u16 */,
  flowinfo: usize /* *mut u32 */,
  scope_id: usize /* *mut u32 */,
): ResolveNextResult;
/**
 * A resulting IPResolution.
 */
export class IPResolution {
  /** An array of bytes representing the IP address. */
  address: StaticArray<u8> | null = null;
  /** The length of the IP address. 4 or 16. */
  addr_len: usize;
  /** The port. */
  port: u16;
  /** The flow info. */
  flowinfo: u32;
  /** The scope_id. */
  scope_id: u32;
}

/** The result of initiating a tcp connection. */
export const enum TCPConnectResult {
  /** The connection was successful. */
  Success = 0,
  /** The connection failed. */
  Fail = 1,
}

/** The result of writing to a TCPSocket. */
export const enum TCPWriteResult {
  /** The write was successful. */
  Success = 0,
  /** The write failed. */
  Fail = 1,
}

/** The result of flushing the TCPSocket. */
export const enum TCPFlushResult {
  /** The flush was successful. */
  Success = 0,
  /** The flush failed. */
  Fail = 1,
}

/** The result of reading from a TCPSocket. */
export const enum TCPReadResult {
  /** The read was successful, the bytes were written to the module. */
  Success = 0,
  /** The read failed. */
  Fail = 1,
}

/**
 * Initiate a TCP connection.
 *
 * @param {usize} addr_ptr - A pointer to an array of bytes.
 * @param {usize} addr_len - A pointer to a usize that describes the length of the IP address.
 * @param {u16} port - The port.
 * @param {usize} listener_id - A pointer to a u32 where the listener_id will be written if
 * the connection was successful.
 * @returns {TCPConnectResult} The result of initiating a TCP connection.
 */
// @ts-ignore: valid decorator
@external("lunatic", "tcp_connect")
declare function tcp_connect(
  addr_ptr: usize, // *const u8,
  addr_len: usize,
  port: u16,
  listener_id: usize, // *mut u32,
): TCPConnectResult;

/**
 * Dereference a given TCP stream. Once a stream has been dererferenced
 * on every Process, the socket becomes closed.
 *
 * @param {u32} listener - The stream to be dereferenced.
 */
// @ts-ignore: valid decorator
@external("lunatic", "close_tcp_stream")
declare function close_tcp_stream(listener: u32): void;

/**
 * Write bytes to a TCP stream.
 *
 * @param {u32} tcp_stream - The stream to write the bytes to.
 * @param {usize} data - A pointer to the data.
 * @param {usize} data_len - How many bytes to write.
 * @param {usize} nwritten - A pointer to a usize that will contain how many bytes were written.
 */
// @ts-ignore: valid decorator
@external("lunatic", "tcp_write_vectored")
declare function tcp_write_vectored(
  tcp_stream: u32,
  data: usize, // *const c_void,
  data_len: usize,
  nwritten: usize // *mut usize,
): TCPWriteResult;

/** Flush a tcp stream. */
// @ts-ignore: valid decorator
@external("lunatic", "tcp_flush")
declare function tcp_flush(tcp_stream: u32): TCPFlushResult;

/**
 * Block the current process and wait for bytes to come in on the stream.
 *
 * @param {u32} tcp_stream - The TCP stream.
 * @param {usize} data - A pointer to write the bytes to.
 * @param {usize} data_len - How many bytes should be read.
 * @param {usize} nread - A pointer to a usize that is the of bytes read from the stream.
 */
// @ts-ignore: valid decorator
@external("lunatic", "tcp_read_vectored")
declare function tcp_read_vectored(
  tcp_stream: u32,
  data: usize, // *mut c_void,
  data_len: usize,
  nread: usize, // *mut usize,
): TCPReadResult;

/** Serialize a tcp stream. */
// @ts-ignore: valid decorator
@external("lunatic", "tcp_stream_serialize")
declare function tcp_stream_serialize(tcp_stream: u32): u32;
/** Deserialize a tcp stream. */
// @ts-ignore: valid decorator
@external("lunatic", "tcp_stream_deserialize")
declare function tcp_stream_deserialize(tcp_stream: u32): u32;

/** The result of binding a TCPServer to an IP address. */
export const enum TCPBindResult {
  Success = 0,
  Fail = 1,
}

/** The result of accepting a TCPSocket from a TCPServer. */
export const enum TCPAcceptResult {
  Success = 0,
  Fail = 1,
}

/**
 * Bind a TCPServer to an IP Address and port.
 *
 * @param {usize} addr_ptr - A pointer to the address bytes.
 * @param {usize} addr_len - The length of the IP address, 4 or 16.
 * @param {u16} port - The port.
 * @param {usize} listener_id - A pointer to a u32 that will be the TCPServer
 * listener ID.
 * @returns {TCPBindResult} The result of binding to an IP address.
 */
// @ts-ignore: valid decorator
@external("lunatic", "tcp_bind")
declare function tcp_bind(
  addr_ptr: usize,// *const u8,
  addr_len: usize,
  port: u16,
  listener_id: usize, //*mut u32,
): TCPBindResult;

/**
 * Close a tcp server.
 *
 * @param {u32} listener - The TCPServer id that should be closed.
 */
// @ts-ignore: valid decorator
@external("lunatic", "close_tcp_listener")
declare function close_tcp_listener(listener: u32): void;

/**
 * Block the current thread to accept a socket from the TCPServer.
 *
 * @param {u32} listener - The listener.
 * @param {usize} tcp_socket - A pointer to a u32 that will contain the socket id.
 * @returns {TCPAcceptResult} The result of accepting a tcp socket.
 */
// @ts-ignore: valid decorator
@external("lunatic", "tcp_accept")
declare function tcp_accept(
  listener: u32,
  tcp_socket: usize, //*mut u32
): TCPAcceptResult;

/**
 * Serialize a TCPServer.
 *
 * @param {u32} tcp_listener - The listener to serialize
 * @returns {u32} The serialized TCPServer handle.
 */
// @ts-ignore: valid decorator
@external("lunatic", "tcp_listener_serialize")
declare function tcp_listener_serialize(tcp_listener: u32): u32;

/**
 * Deserialize a TCPServer.
 *
 * @param {u32} tcp_listener - The serialized TCPServer.
 * @returns {u32} The deserialized TCPServer handle.
 */
// @ts-ignore: valid decorator
@external("lunatic", "tcp_listener_deserialize")
declare function tcp_listener_deserialize(tcp_listener: u32): u32;

/** This pointer is for standard reads, configured by the compile time read and count tcp read buffer constants. */
const tcpReadDataPointer = memory.data(TCP_READ_BUFFER_SIZE * TCP_READ_BUFFER_COUNT);
/** The c-array of iovecs that will contain the data returned by a TCPSocket read. */
const tcpReadVecs = memory.data(TCP_READ_BUFFER_COUNT * sizeof<usize>() * 2);
/** A pointer to a static location where the readCount will be set by the host. */
const readCountPtr = memory.data(sizeof<u32>());
/** A pointer to a static location where the writeCount will be read by the host. */
const writeCountPtr = memory.data(sizeof<usize>());

// this is setup that configures the tcpReadVecs segment
let tcpReadVecsTemp = tcpReadVecs;
for (let i = <usize>0; i < <usize>TCP_READ_BUFFER_COUNT; i++) {
  // compile time free cast to iovec (will be optimized away)
  let vec = changetype<iovec>(tcpReadVecsTemp);

  // set the properties
  vec.buf = tcpReadDataPointer + <usize>TCP_READ_BUFFER_SIZE * <usize>i;
  vec.buf_len = <usize>TCP_READ_BUFFER_SIZE;

  // advance to the next vec
  tcpReadVecsTemp += offsetof<iovec>();
}


  /**
   * A TCP Socket that allows for reading and writing data from and to the TCP connection
   * associated. This object is constructed by an associated `TCPServer` or the
   * `TCPSocket.connect()` method. Typically, lunatic end users should not construct
   * TCPSocket references directly using the  `new` keyword.
   *
   * @param {u32} socket_id - The host's socket_id.
   */
export class TCPSocket {

  constructor(private socket_id: u32) {}

  /** Connect to a given IP address and port. Returns `null` if the connection wasn't successful. */
  public static connect(ip: StaticArray<u8>, port: u16): TCPSocket | null {
    let length = ip.length;
    assert(length == 4 || length == 16);
    let t = new TCPSocket(0);
    let result = tcp_connect(
      changetype<usize>(ip),
      ip.length,
      port,
      changetype<usize>(t),
    );
    return result == TCPConnectResult.Success
      ? t
      : null;
  }

  /** Public ason serialization method for transfering a TCPSocket through a channel. */
  public __asonSerialize(): StaticArray<u8> {
    let buffer = new StaticArray<u8>(sizeof<u32>());
    store<u32>(changetype<usize>(buffer), tcp_stream_serialize(this.socket_id));
    return buffer;
  }

  /** Public ason deserialization method for obtaining a TCPSocket from a channel. */
  public __asonDeserialize(buffer: StaticArray<u8>): void {
    this.socket_id = tcp_stream_deserialize(load<u32>(changetype<usize>(buffer)))
  }

  /**
   * Block the current process to read the data from the TCPSocket using the default
   * static memory locations provided by the as-lunatic asconfig properties.
   *
   * @returns {StaticArray<u8> | null} `null`
   * if the read was unsuccessful because the socket closed, or there was an error.
   */
  public read(): StaticArray<u8> | null {
    // default read uses TCP_READ_BUFFER_COUNT vectors all in the same segment
    let result = tcp_read_vectored(
      this.socket_id,
      changetype<usize>(tcpReadVecs),
      <usize>TCP_READ_BUFFER_COUNT,
      readCountPtr,
    );

    if (result != TCPReadResult.Success) return null;
    let readCount = load<u32>(readCountPtr);
    let array = new StaticArray<u8>(readCount);
    memory.copy(changetype<usize>(array), tcpReadDataPointer, readCount);
    return array;
  }

  /**
   * Block the current process, and read data from a socket into the provided
   * buffers.
   *
   * @param {Array<StaticArray<u8>>} buffers - The buffers to be read into.
   * @returns {usize} - The number of bytes written into the buffers.
   */
  public readVectored(buffers: Array<StaticArray<u8>>): usize {
    let buffersLength = <usize>buffers.length;
    let vecs = heap.alloc(
      // adding 1 to align of usize effectively doubles the heap allocation size
      buffersLength << (usize(alignof<usize>()) + 1)
    );
    for (let i = <usize>0; i < buffersLength; i++) {
      let ptr = vecs + (i << (usize(alignof<usize>()) + 1));
      let buffer = unchecked(buffers[i]);
      store<usize>(ptr, changetype<usize>(buffer));
      store<usize>(ptr, <usize>buffer.length, sizeof<usize>());
    }

    let readResult = tcp_read_vectored(this.socket_id, vecs, buffersLength, readCountPtr);
    heap.free(vecs);
    if (readResult == TCPReadResult.Success) {
      return load<u32>(readCountPtr);
    } else return 0;
  }

  /** Write a buffer to the TCPSocket stream. */
  public writeBuffer(buffer: StaticArray<u8>): usize {
    return this.writeUnsafe(changetype<usize>(buffer), buffer.length);
  }

  /**
   * An explicitly unsafe method for writing data to a socket.
   *
   * @param {usize} ptr - A pointer `void*` which points to the data being written.
   * @param {usize} length - The number of bytes to be written to the socket.
   * @returns {usize} The number of bytes written.
   */
  @unsafe public writeUnsafe(ptr: usize, length: usize): usize {
    let vec = changetype<iovec>(memory.data(offsetof<iovec>()));
    vec.buf = ptr;
    vec.buf_len = length;

    let result = tcp_write_vectored(
      this.socket_id,
      changetype<usize>(vec),
      1,
      writeCountPtr,
    );

    return result == TCPWriteResult.Success
      ? load<usize>(writeCountPtr)
      : 0;
  }

  /** Flush the socket. Returns true if the operation was successful. */
  public flush(): bool {
    return tcp_flush(this.socket_id) == TCPFlushResult.Success;
  }

  /**
   * TCP streams are reference counted. Every time a TCP stream is sent through a
   * channel to another process it's duplicated and the reference count incremented.
   * Every time drop() is called, lunatic will decrement the the reference count. Once
   * this reference count reaches 0, the stream is closed.
   */
  public drop(): void {
    close_tcp_stream(this.socket_id);
  }
}

/**
 * This class represents a TCPServer. In order to obtain a reference to a TCPServer,
 * lunatic must provide a `listener_id` by calling the lunatic.tcp_bind method. Typical
 * end users will call the `TCPServer.bind(ip, port)` method to obtain a reference.
 */
export class TCPServer {
  constructor(private listener: u32) {}

  /** Public ason deserialize method. */
  public __asonDeserialize(buffer: StaticArray<u8>): void {
    this.listener = tcp_listener_deserialize(load<u32>(changetype<usize>(buffer)));
  }

  /** Public ason serialize method. */
  public __asonSerialize(): StaticArray<u8> {
    let buffer = new StaticArray<u8>(sizeof<u32>());
    store<u32>(changetype<usize>(buffer), tcp_listener_serialize(this.listener));
    return buffer;
  }

  /**
   * Bind a TCPServer to an address and a port.
   *
   * @param {StaticArray<u8>} address - The address in an array of bytes.
   * @param {u16} port - The port.
   * @returns {TCPServer | null} Null if the server could not be bound.
   */
  public static bind(address: StaticArray<u8>, port: u16): TCPServer | null {
    let server = new TCPServer(0);
    assert(address.length == 4 || address.length == 16);
    // tcp_bind writes the listener id here
    if (tcp_bind(changetype<usize>(address), <usize>address.length, port, changetype<usize>(server)) == TCPBindResult.Success) {
      return server;
    } else {
      return null;
    }
  }

  /**
   * Block the current process and accept a TCPSocket if it was succesfully obtained.
   * @returns {TCPSocket | null} null if the tcp server errored.
   */
  public accept(): TCPSocket | null {
    let socket = new TCPSocket(0);
    if (tcp_accept(this.listener, changetype<usize>(socket)) == TCPAcceptResult.Success) {
      return socket;
    } else {
      return null;
    }
  }

  /**
   * Dereference the TCPServer. If a TCPServer was accepted in another process, it will
   * need to be `close()`ed there too to unbind the server.
   */
  public close(): void {
    close_tcp_listener(this.listener);
  }
}

/** A pointer to an ip resolution iterator. */
const resolverIdPtr = memory.data(sizeof<u32>());

/**
 * Resolve an ip address from a host name.
 *
 * @param {string} host - The host or ip address name that should be resolved.
 * @returns {IPResolution[] | null} null if the IP could not be resolved.
 */
export function resolve(host: string): IPResolution[] | null {
  // encode the ip address to utf8
  let ipBuffer = String.UTF8.encode(host);
  // call the host to resolve the IP address
  let resolveResult = lunatic_resolve(
    changetype<usize>(ipBuffer),
    ipBuffer.byteLength,
    // write the resolver to memory
    resolverIdPtr
  );
  if (resolveResult == ResolveResult.Fail) return null;

  // read the resolver id
  let resolverId = load<u32>(resolverIdPtr);

  // loop over each IPResolution and add it to the list
  let result = new Array<IPResolution>(0);
  let i = 0;
  while (true) {
    // must always allocate 16 bytes
    let buffer = new StaticArray<u8>(16);
    let resolution = new IPResolution();
    resolution.address = buffer;

    // the host iterates over each result until it returns Done
    let resolutionResult = resolve_next(
      resolverId,
      changetype<usize>(buffer),
      changetype<usize>(resolution) + offsetof<IPResolution>("addr_len"),
      changetype<usize>(resolution) + offsetof<IPResolution>("port"),
      changetype<usize>(resolution) + offsetof<IPResolution>("flowinfo"),
      changetype<usize>(resolution) + offsetof<IPResolution>("scope_id"),
    );
    if (resolutionResult == ResolveNextResult.Done) break;
    result.push(resolution);
    i++;
  }
  return bool(i) ? result : null;
}
