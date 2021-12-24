import { Result, id_ptr } from "../error";
import { net } from "../bindings";
import { err_code, IPType, LunaticManaged, iovec_vector } from "../util";
import { iovec } from "bindings/wasi";



// ip address constant pointers
// @ts-ignore: @lazy!
@lazy const ip_address = memory.data(16);
// @ts-ignore: @lazy!
@lazy const ip_address_type = memory.data(sizeof<u32>());
// @ts-ignore: @lazy!
@lazy const ip_port = memory.data(sizeof<u16>());
// @ts-ignore: @lazy!
@lazy const ip_flow_info = memory.data(sizeof<u32>());
// @ts-ignore: @lazy!
@lazy const ip_scope_id = memory.data(sizeof<u32>());

// @ts-ignore: @lazy!
@lazy const opaque_ptr = memory.data(sizeof<u64>());

export class IPResolution {
  // allocate 16 bytes for the address
  private _address_1: u64 = 0;
  private _address_2: u64 = 0;
  public type: IPType = IPType.None;
  public port: u16 = 0;
  public flowInfo: u32 = 0;
  public scopeId: u32 = 0;

  constructor() {
    let type = <IPType>load<u32>(ip_address_type);
    memory.copy(changetype<usize>(this), ip_address, select<usize>(i32(type == IPType.IPV4), 16, 4));
    this.type = type;
    this.port = load<u16>(ip_port);
    this.flowInfo = load<u32>(ip_flow_info);
    this.scopeId = load<u32>(ip_scope_id);
  }

  public get ip(): StaticArray<u8> {
    let type = this.type;
    if (type == IPType.None) assert(false);
    let result = new StaticArray<u8>(4);
    memory.copy(changetype<usize>(result), changetype<usize>(this), select<usize>(i32(type == IPType.IPV4), 16, 4));
    return result;
  }
}

/** The different tcp read results. */

export const enum TCPResultType {
  Success,
  Timeout,
  Closed,
  Error,
}

/**
 * Resolve the contents of a DNS Iterator.
 * @param {u64} id - The dns iterator id.
 * @returns {IPResolution[]} The IPResolution array.
 */
function resolveDNSIterator(id: u64): IPResolution[] {
  let value: IPResolution[] = [];

  // obtain the ip resolutions
  while (net.resolve_next(id, ip_address_type, ip_address, ip_port, ip_flow_info, ip_scope_id) == err_code.Success) {
    value.push(new IPResolution()); // IPResolution will automatically load from the pointers
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
 * @returns {Result<IPResolution[] | null>} The resulting IPResolution set.
 */
export function resolve(host: string, timeout: u32 = 0): Result<IPResolution[] | null> {
  // encode the string to utf8
  let name_ptr = String.UTF8.encode(host);

  // resolve the host
  let result = net.resolve(changetype<usize>(name_ptr), <usize>name_ptr.byteLength, timeout, id_ptr);

  // process the result
  let id = load<u64>(id_ptr);
  if (result == err_code.Success) {
    let value: IPResolution[] = resolveDNSIterator(id);
    return new Result<IPResolution[] | null>(value);
  }
  return new Result<IPResolution[] | null>(null, id);
}

/**
 * A TCP Socket that can be written to or read from.
 */
export class TCPSocket extends LunaticManaged {
  /** The resulting read buffer. */
  public buffer: StaticArray<u8> | null = null;
  /** Written byte count after calling write. */
  public byteCount: i32 = 0;

  static connectIPV4(ip: StaticArray<u8>, port: u16): TCPSocket {
    assert(ip.length >= 4);
    return TCPSocket.connectUnsafe();
  }

  static connectIPV6(ip: StaticArray<u8>, port: u16): TCPSocket {

  }

  static connectUnsafe(addr_type: u32, addr_ptr: usize, port: u16, flow_info: u32, scope_id: u32, timeout: u32): Result<TCPSocket | null> {
    assert(addr_type == 4 || addr_type == 6);
    let result = net.tcp_connect(
      addr_type,
      addr_ptr,
      port,
      flow_info,
      scope_id,
      timeout,
      id_ptr,
    );
    let id = load<u64>(id_ptr);
    if (result == err_code.Success) {
      // setup memory to copy an IPResolution object
      memory.copy(ip_address, addr_ptr, select<usize>(4, 16, addr_type == 4));

      store<u32>(ip_address_type, addr_type);
      store<u16>(ip_address_type, port);
      store<u32>(ip_flow_info, flow_info);
      store<u32>(ip_scope_id, scope_id);

      // new IPResolution() copies from the previous pointers
      return new Result<TCPSocket | null>(new TCPSocket(id, new IPResolution()), 0);
    }
    return new Result<TCPSocket | null>(null, id);
  }

  constructor(
    /** The tcp socket id on the host. */
    public id: u64,
    /** The IP Address of this socket. */
    public ip: IPResolution
  ) {
    super(id, net.drop_tcp_listener);
  }

  /**
   * Read a buffer from the TCP Stream with a timeout.
   *
   * @param {u32} timeout - How long a read should wait until the request times out.
   * @returns {StaticArray<u8>} The resulting buffer.
   */
  read(timeout: u32 = 0): TCPResultType {
    // setup
    let result_buffer = new iovec_vector(); // unmanaged! must be freed
    let id = this.id;

    let count = 0;
    // for each successful read
    while (true) {
      // TCP_READ_VECTOR_SIZE is managed by `--use TCP_READ_VECTOR_SIZE={some const value}`
      let buff = heap.alloc(TCP_READ_VECTOR_SIZE);
      let read_result = net.tcp_read(id, buff, TCP_READ_VECTOR_SIZE, timeout, id_ptr);
      if (read_result == err_code.Success) {
        // get bytes read
        let bytes_read = load<u64>(id_ptr);

        // if no bytes were read on a success, the socket was closed
        if (bytes_read == 0) {
          result_buffer.free_children();
          this.buffer = null;
          heap.free(changetype<usize>(buff));
          return TCPResultType.Closed;
        }

        // give ownership of buffer to result_buffer
        result_buffer.push(buff, <usize>bytes_read);
      } else {
        // free the buffer and continue execution
        heap.free(buff);
        break;
      }
      count++;
    }

    // if success was never returned, user defined timeout
    if (count == 0) {
      return TCPResultType.Timeout;
    }

    // free all the internal buffers and copy them into a static array
    let result = result_buffer.to_static_array();
    heap.free(changetype<usize>(result_buffer));
    this.buffer = result;
    return TCPResultType.Success;
  }

  @unsafe writeUnsafe(ptr: usize, len: usize, timeout: u32 = 0): Result<TCPResultType> {
    let vec = changetype<iovec>(memory.data(offsetof<iovec>()));
    vec.buf = ptr;
    vec.buf_len = len;
    let result = net.tcp_write_vectored(this.id, vec, 1, timeout, id_ptr);
    let count = load<u64>(id_ptr);

    if (result == err_code.Success) {
      if (count == 0) {
        return new Result<TCPResultType>(TCPResultType.Closed);
      }
      this.byteCount = count;
      return new Result<TCPResultType>(TCPResultType.Success);
    } else {
      return new Result<TCPResultType>(TCPResultType.Error, count);
    }
  }
}

/**
 * Represents a TCPListener, waiting for incoming TCP connections at the bound
 * address.
 *
 * Construct one with the `TCPServer.bind()` method.
 */
export class TCPServer extends LunaticManaged {
  constructor(
    public id: u64
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
    return TCPServer.bindUnsafe(IPType.IPV4, changetype<usize>(ip), port, 0, 0);
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
    return TCPServer.bindUnsafe(IPType.IPV4, changetype<usize>(ip), port, flowInfo, scopeId);
  }

  /**
   * Bind a TCPServer unsafely to a local address.
   *
   * @param {usize} addressPtr 
   * @param {IPType} addressType 
   * @param {u16} port 
   * @param {u32} flowInfo 
   * @param {u32} scopeId 
   * @returns {Result<TCPServer | null>} The resulting TCPServer or an error.
   */
  @unsafe static bindUnsafe(
    addressPtr: usize,
    addressType: IPType,
    port: u16,
    flowInfo: u32,
    scopeId: u32,
  ): Result<TCPServer | null> {
    let result = net.tcp_bind(addressType, addressPtr, port, flowInfo, scopeId, id_ptr);
    let id = load<u64>(id_ptr);
    if (result == err_code.Success) {
      return new Result<TCPServer | null>(new TCPServer(id));
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

  accept(): Result<TCPSocket | null> {
    let result = net.tcp_accept(this.id, id_ptr, opaque_ptr);
    let id = load<u64>(id_ptr);
    if (result == err_code.Success) {
      let dns_iterator = load<u64>(opaque_ptr);
      let ipResolutions = resolveDNSIterator(dns_iterator);
      assert(ipResolutions.length == 1);
      return new Result<TCPSocket | null>(new TCPSocket(id, unchecked(ipResolutions[0])))
    }
    return new Result<TCPSocket | null>(null, id);
  }
}
