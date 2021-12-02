import { Result, id_ptr } from "../error";
import { net } from "../bindings";
import { err_code, IPType, LunaticManaged } from "../util";


// ip address constant pointers
const ip_address = memory.data(16);
const ip_address_type = memory.data(sizeof<u32>());
const ip_port = memory.data(sizeof<u16>());
const ip_flow_info = memory.data(sizeof<u32>());
const ip_scope_id = memory.data(sizeof<u32>());

const dns_iterator_id = memory.data(sizeof<u64>());

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
  constructor(
    /** The tcp socket id on the host. */
    public id: u64,
    /** The IP Address of this socket. */
    public ip: IPResolution
  ) {
    super(id, net.drop_tcp_listener);
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
    let result = net.tcp_accept(this.id, id_ptr, dns_iterator_id);
    let id = load<u64>(id_ptr);
    if (result == err_code.Success) {
      let dns_iterator = load<u64>(dns_iterator_id);
      let ipResolutions = resolveDNSIterator(dns_iterator);
      assert(ipResolutions.length == 1);
      return new Result<TCPSocket | null>(new TCPSocket(id, unchecked(ipResolutions[0])))
    }
    return new Result<TCPSocket | null>(null, id);
  }
}
