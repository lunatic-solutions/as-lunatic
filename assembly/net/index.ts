import { iovec } from "bindings/wasi";

// @ts-ignore: valid decorator
@external("lunatic", "resolve")
declare function lunatic_resolve(
  name_ptr: usize /* *const u8 */,
  name_len: usize,
  resolver_id: usize /* *mut u32 */
): ResolveResult;

const enum ResolveNextResult {
  Success = 0,
  Done = 1,
}

export const enum ResolveResult {
  Success = 0,
  Fail = 1,
}

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

export class IPResolution {
  address: StaticArray<u8> | null = null;
  addr_len: usize;
  port: u16;
  flowinfo: u32;
  scope_id: u32;
}

export const enum TCPConnectResult {
  Success = 0,
  Fail = 1,
}

export const enum TCPWriteResult {
  Success = 0,
  Fail = 1,
}

export const enum TCPFlushResult {
  Success = 0,
  Fail = 1,
}

export const enum TCPReadResult {
  Success = 0,
  Fail = 1,
}

// @ts-ignore: valid decorator
@external("lunatic", "tcp_connect")
declare function tcp_connect(
  addr_ptr: usize, // *const u8,
  addr_len: usize,
  port: u16,
  listener_id: usize, // *mut u32,
): TCPConnectResult;

// @ts-ignore: valid decorator
@external("lunatic", "close_tcp_stream")
declare function close_tcp_stream(listener: u32): void;

// @ts-ignore: valid decorator
@external("lunatic", "tcp_write_vectored")
declare function tcp_write_vectored(
  tcp_stream: u32,
  data: usize, // *const c_void,
  data_len: usize,
  nwritten: usize // *mut usize,
): TCPWriteResult;

// @ts-ignore: valid decorator
@external("lunatic", "tcp_flush")
declare function tcp_flush(tcp_stream: u32): TCPFlushResult;

// @ts-ignore: valid decorator
@external("lunatic", "tcp_read_vectored")
declare function tcp_read_vectored(
  tcp_stream: u32,
  data: usize, // *mut c_void,
  data_len: usize,
  nwritten: usize, // *mut usize,
): TCPReadResult;

// @ts-ignore: valid decorator
@external("lunatic", "tcp_stream_serialize")
declare function tcp_stream_serialize(tcp_stream: u32): u32;
// @ts-ignore: valid decorator
@external("lunatic", "tcp_stream_deserialize")
declare function tcp_stream_deserialize(tcp_stream: u32): u32;

export const enum TCPBindResult {
  Success = 0,
  Fail = 1,
}

export const enum TCPAcceptResult {
  Success = 0,
  Fail = 1,
}

// @ts-ignore: valid decorator
@external("lunatic", "tcp_bind")
declare function tcp_bind(
  addr_ptr: usize,// *const u8,
  addr_len: usize,
  port: u16,
  listener_id: usize, //*mut u32,
): TCPBindResult;

// @ts-ignore: valid decorator
@external("lunatic", "close_tcp_listener")
declare function close_tcp_listener(listener: u32): void;

// @ts-ignore: valid decorator
@external("lunatic", "tcp_accept")
declare function tcp_accept(
  listener: u32,
  tcp_socket: usize, //*mut u32
): TCPAcceptResult;

// @ts-ignore: valid decorator
@external("lunatic", "tcp_listener_serialize")
declare function tcp_listener_serialize(tcp_stream: u32): u32;

// @ts-ignore: valid decorator
@external("lunatic", "tcp_listener_deserialize")
declare function tcp_listener_deserialize(tcp_stream: u32): u32;

/** This pointer is for standard reads, configured by the compile time read and count tcp read buffer constants. */
const tcpReadDataPointer = memory.data(TCP_READ_BUFFER_SIZE * TCP_READ_BUFFER_COUNT);
const tcpReadVecs = memory.data(TCP_READ_BUFFER_COUNT * sizeof<usize>() * 2);
const readCountPtr = memory.data(sizeof<u32>());
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

export class TCPSocket {
  private socket_id: u32;

  public static connect(ip: StaticArray<u8>, port: u16): TCPSocket | null {
    let length = ip.length;
    assert(length == 4 || length == 16);
    let t = new TCPSocket();
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

  public __asonSerialize(): StaticArray<u8> {
    let buffer = new StaticArray<u8>(sizeof<u32>());
    store<u32>(changetype<usize>(buffer), tcp_stream_serialize(this.socket_id));
    return buffer;
  }

  public __asonDeserialize(buffer: StaticArray<u8>): void {
    this.socket_id = tcp_stream_deserialize(load<u32>(changetype<usize>(buffer)))
  }

  constructor() {}

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

  public writeBuffer(buffer: StaticArray<u8>): usize {
    return this.writeUnsafe(changetype<usize>(buffer), buffer.length);
  }

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

  public flush(): bool {
    return tcp_flush(this.socket_id) == TCPFlushResult.Success;
  }

  public close(): void {
    close_tcp_stream(this.socket_id);
  }
}

export class TCPServer {
  private listener: u32;

  public __asonDeserialize(buffer: StaticArray<u8>): void {
    this.listener = tcp_listener_deserialize(load<u32>(changetype<usize>(buffer)));
  }

  public __asonSerialize(): StaticArray<u8> {
    let buffer = new StaticArray<u8>(sizeof<u32>());
    store<u32>(changetype<usize>(buffer), tcp_listener_serialize(this.listener));
    return buffer;
  }

  public static bind(address: StaticArray<u8>, port: u16): TCPServer | null {
    let server = new TCPServer();
    assert(address.length == 4 || address.length == 16);
    // tcp_bind writes the listener id here
    if (tcp_bind(changetype<usize>(address), <usize>address.length, port, changetype<usize>(server)) == TCPBindResult.Success) {
      return server;
    } else {
      return null;
    }
  }

  public accept(): TCPSocket | null {
    let socket = new TCPSocket();
    if (tcp_accept(this.listener, changetype<usize>(socket)) == TCPAcceptResult.Success) {
      return socket;
    } else {
      return null;
    }
  }

  public close(): void {
    close_tcp_listener(this.listener);
  }
}

const resolverIdPtr = memory.data(sizeof<u32>());

export function resolve(ip: string): IPResolution[] | null {
  // encode the ip address to utf8
  let ipBuffer = String.UTF8.encode(ip);
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
