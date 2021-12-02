import { Result, id_ptr } from "../error";
import { net } from "../bindings";
import { err_code } from "..";


// ip address constant pointers
const ip_address = memory.data(16);
const ip_address_type = memory.data(sizeof<u32>());
const ip_port = memory.data(sizeof<u16>());
const ip_flow_info = memory.data(sizeof<u32>());
const ip_scope_id = memory.data(sizeof<u32>());

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
    let value: IPResolution[] = [];

    // obtain the ip resolutions
    while (net.resolve_next(id, ip_address_type, ip_address, ip_port, ip_flow_info, ip_scope_id) == err_code.Success) {
      value.push(new IPResolution()); // IPResolution will automatically load from the pointers
    }

    // always drop if successful
    net.drop_dns_iterator(id);
    return new Result<IPResolution[] | null>(value);
  } 
  return new Result<IPResolution[] | null>(null, id);
}

export class TCPServer {

}
