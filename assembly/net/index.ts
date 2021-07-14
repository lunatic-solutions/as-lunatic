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
): TCPErrorCode;

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
 * The result of a TCP request of some kind.
 */
export const enum TCPErrorCode {
  /** A succesful result. */
  Success = 0,
  /** An entity was not found, often a file. */
  NotFound = 1,
  /** The operation lacked the necessary privileges to complete. */
  PermissionDenied = 2,
  /** The connection was refused by the remote server. */
  ConnectionRefused = 3,
  /** The connection was reset by the remote server. */
  ConnectionReset = 4,
  /** The connection was aborted (terminated) by the remote server. */
  ConnectionAborted = 5,
  /** The network operation failed because it was not connected yet. */
  NotConnected = 6,
  /** A socket address could not be bound because the address is already in use elsewhere. */
  AddrInUse = 7,
  /** A nonexistent interface was requested or the requested address was not local. */
  AddrNotAvailable = 8,
  /** The connection pipe is broken. */
  BrokenPipe = 9,
  /** An entity already exists, often a file. */
  AlreadyExists = 10,
  /** The operation needs to block to complete, but the blocking operation was requested to not occur. */
  WouldBlock = 11,
  /** A parameter was incorrect. */
  InvalidInput = 12,
  /**
   * Data not valid for the operation were encountered.
   *
   * Unlike InvalidInput, this typically means that the operation parameters were valid, however the error was caused by malformed input data.
   *
   * For example, a function that reads a file into a string will error with InvalidData if the file’s contents are not valid UTF-8.
   */
  InvalidData = 13,
  /** The I/O operation’s timeout expired, causing it to be canceled. */
  TimedOut = 14,
  /**
   * An error returned when an operation could not be completed because a call to write returned Ok(0).
   *
   * This typically means that an operation could only succeed if it wrote a particular number of bytes but only a smaller number of bytes could be written.
   */
  WriteZero = 15,
  /**
   * This operation was interrupted.
   *
   * Interrupted operations can typically be retried.
   */
  Interrupted = 16,
  /**
   * An error returned when an operation could not be completed because an “end of file” was reached prematurely.
   *
   * This typically means that an operation could only succeed if it read a particular number of bytes but only a smaller number of bytes could be read.
   */
  UnexpectedEof = 17,
  /**
   * This operation is unsupported on this platform.
   *
   * This means that the operation can never succeed.
   */
  Unsupported = 18,
  /** The system is out of memory. */
  OutOfMemory = 19,
  /** Some other kind of error has occurred. */
  Other = 20,
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

/** Represents the result of an operation. */
export class TCPResult<T> {
  constructor(
    public code: TCPErrorCode,
    public value: T,
  ) {}
}

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

/**
 * Initiate a TCP connection.
 *
 * @param {usize} addr_ptr - A pointer to an array of bytes.
 * @param {usize} addr_len - A pointer to a usize that describes the length of the IP address.
 * @param {u16} port - The port.
 * @param {usize} listener_id - A pointer to a u32 where the listener_id will be written if
 * the connection was successful.
 * @returns {TCPErrorCode} The result of initiating a TCP connection.
 */
// @ts-ignore: valid decorator
@external("lunatic", "tcp_connect")
declare function tcp_connect(
  addr_ptr: usize, // *const u8,
  addr_len: usize,
  port: u16,
  listener_id: usize, // *mut u32,
): TCPErrorCode;

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
 * @returns The error code if there was a problem.
 */
// @ts-ignore: valid decorator
@external("lunatic", "tcp_write_vectored")
declare function tcp_write_vectored(
  tcp_stream: u32,
  data: usize, // *const c_void,
  data_len: usize,
  nwritten: usize // *mut usize,
): TCPErrorCode;

/** Flush a tcp stream. */
// @ts-ignore: valid decorator
@external("lunatic", "tcp_flush")
declare function tcp_flush(tcp_stream: u32): TCPErrorCode;

/**
 * Block the current process and wait for bytes to come in on the stream.
 *
 * @param {u32} tcp_stream - The TCP stream.
 * @param {usize} data - A pointer to write the bytes to.
 * @param {usize} data_len - How many bytes should be read.
 * @param {usize} nread - A pointer to a usize that is the of bytes read from the stream.
 * @returns An error code if there was a problem.
 */
// @ts-ignore: valid decorator
@external("lunatic", "tcp_read_vectored")
declare function tcp_read_vectored(
  tcp_stream: u32,
  data: usize, // *mut c_void,
  data_len: usize,
  nread: usize, // *mut usize,
): TCPErrorCode;

/** Serialize a tcp stream. */
// @ts-ignore: valid decorator
@external("lunatic", "tcp_stream_serialize")
declare function tcp_stream_serialize(tcp_stream: u32): u32;
/** Deserialize a tcp stream. */
// @ts-ignore: valid decorator
@external("lunatic", "tcp_stream_deserialize")
declare function tcp_stream_deserialize(tcp_stream: u32): u32;


/**
 * Bind a TCPServer to an IP Address and port.
 *
 * @param {usize} addr_ptr - A pointer to the address bytes.
 * @param {usize} addr_len - The length of the IP address, 4 or 16.
 * @param {u16} port - The port.
 * @param {usize} listener_id - A pointer to a u32 that will be the TCPServer
 * listener ID.
 * @returns {TCPErrorCode} The result of binding to an IP address.
 */
// @ts-ignore: valid decorator
@external("lunatic", "tcp_bind")
declare function tcp_bind(
  addr_ptr: usize,// *const u8,
  addr_len: usize,
  port: u16,
  listener_id: usize, //*mut u32,
): TCPErrorCode;

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
): TCPErrorCode;

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
export class TCPStream {

  constructor(private socket_id: u32) {}

  /** Connect to a given IP address and port. Returns `null` if the connection wasn't successful. */
  public static connect(ip: StaticArray<u8>, port: u16): TCPResult<TCPStream | null> {
    let length = ip.length;
    assert(length == 4 || length == 16);
    let stream = new TCPStream(0);
    let code = tcp_connect(
      changetype<usize>(ip),
      ip.length,
      port,
      changetype<usize>(stream),
    );
    if (code == TCPErrorCode.Success) return new TCPResult<TCPStream | null>(code, stream);
    return new TCPResult<TCPStream | null>(code, null)
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
   * @returns {TCPResult<StaticArray<u8> | null>} The error code if the read was unsuccesful,
   * and also the data if the read was successful.
   */
  public read(): TCPResult<StaticArray<u8> | null> {
    // default read uses TCP_READ_BUFFER_COUNT vectors all in the same segment
    let code = tcp_read_vectored(
      this.socket_id,
      changetype<usize>(tcpReadVecs),
      <usize>TCP_READ_BUFFER_COUNT,
      readCountPtr,
    );

    if (code == TCPErrorCode.Success) {
      let readCount = load<u32>(readCountPtr);
      let array = new StaticArray<u8>(readCount);
      memory.copy(changetype<usize>(array), tcpReadDataPointer, readCount);
      return new TCPResult<StaticArray<u8> | null>(code, array);
    }
    return new TCPResult<StaticArray<u8> | null>(code, null);
  }

  /**
   * Block the current process, and read data from a socket into the provided
   * buffers.
   *
   * @param {Array<StaticArray<u8>>} buffers - The buffers to be read into.
   * @returns {usize} - The number of bytes written into the buffers.
   */
  public readVectored(buffers: Array<StaticArray<u8>>): TCPResult<usize> {
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
    let count = readResult == TCPErrorCode.Success
      ? <usize>load<u32>(readCountPtr)
      : <usize>0;
    return new TCPResult<usize>(readResult, count);
  }

  /** Write a buffer to the TCPSocket stream. */
  public writeBuffer(buffer: StaticArray<u8>): TCPResult<usize> {
    return this.writeUnsafe(changetype<usize>(buffer), buffer.length);
  }

  /**
   * An explicitly unsafe method for writing data to a socket.
   *
   * @param {usize} ptr - A pointer `void*` which points to the data being written.
   * @param {usize} length - The number of bytes to be written to the socket.
   * @returns {TCPResult<usize>} The number of bytes written and the error code if any.
   */
  @unsafe public writeUnsafe(ptr: usize, length: usize): TCPResult<usize> {
    let vec = changetype<iovec>(memory.data(offsetof<iovec>()));
    vec.buf = ptr;
    vec.buf_len = length;

    let code = tcp_write_vectored(
      this.socket_id,
      changetype<usize>(vec),
      1,
      writeCountPtr,
    );
    let count = code == TCPErrorCode.Success
      ? <usize>load<u32>(writeCountPtr)
      : <usize>0;
    return new TCPResult<usize>(code, count);
  }

  /** Flush the socket. Returns true if the operation was successful. */
  public flush(): TCPResult<bool> {
    let code = tcp_flush(this.socket_id);
    return new TCPResult<bool>(
      code,
      code == TCPErrorCode.Success,
    );
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
   * @returns {TCPResult<TCPServer | null>} The error code and TCPServer if the error code was 0
   */
  public static bind(address: StaticArray<u8>, port: u16): TCPResult<TCPServer | null> {
    let server = new TCPServer(0);
    assert(address.length == 4 || address.length == 16);
    // tcp_bind writes the listener id here
    let code = tcp_bind(changetype<usize>(address), <usize>address.length, port, changetype<usize>(server));
    return new TCPResult<TCPServer | null>(
      code,
      code == TCPErrorCode.Success
        ? server
        : null,
    );
  }

  /**
   * Block the current process and accept a TCPSocket if it was succesfully obtained.
   * @returns {TCPStream | null} null if the tcp server errored.
   */
  public accept(): TCPResult<TCPStream | null> {
    let stream = new TCPStream(0);
    let code = tcp_accept(this.listener, changetype<usize>(stream));
    return new TCPResult<TCPStream | null>(
      code,
      code == TCPErrorCode.Success
        ? stream
        : null,
    );
  }

  /**
   * TCP servers are reference counted. Every time a TCP server is sent through a
   * channel to another process it's duplicated and the reference count incremented.
   * Every time drop() is called, lunatic will decrement the the reference count. Once
   * this reference count reaches 0, the server is closed.
   */
  public drop(): void {
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
export function resolve(host: string): TCPResult<IPResolution[] | null> {
  // encode the ip address to utf8
  let ipBuffer = String.UTF8.encode(host);
  // call the host to resolve the IP address
  let resolveResult = lunatic_resolve(
    changetype<usize>(ipBuffer),
    ipBuffer.byteLength,
    // write the resolver to memory
    resolverIdPtr
  );

  let result = new TCPResult<IPResolution[] | null>(
    resolveResult,
    null,
  );
  if (resolveResult == TCPErrorCode.Success) {
    // read the resolver id
    let resolverId = load<u32>(resolverIdPtr);

    // loop over each IPResolution and add it to the list
    let ipArray = new Array<IPResolution>(0);
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
      ipArray.push(resolution);
      i++;
    }

    result.value = ipArray;
  }

  return result;
}
