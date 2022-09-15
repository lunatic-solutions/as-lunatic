// @ts-ignore: @lazy!
@lazy export const ipAddressPointer = memory.data(offsetof<IPAddress>());

/** IPAddress types defined by the lunatic runtime. */
export const enum IPType {
  None = 0,
  IPV4 = 4,
  IPV6 = 6,
}

/** Represents an IP Address, v6 or v4. */
export class IPAddress {
  static v4(ip: StaticArray<u8>, port: u16): IPAddress {
    let result = new IPAddress();
    assert(ip.length == 4);
    memory.copy(changetype<usize>(result), changetype<usize>(ip), 4);
    result.port = port;
    result.type = IPType.IPV4;
    return result;
  }

  static v6(ip: StaticArray<u8>, port: u16, flowInfo: u32, scopeId: u32): IPAddress {
    let result = new IPAddress();
    assert(ip.length == 16);
    memory.copy(changetype<usize>(result), changetype<usize>(ip), 16);
    result.port = port;
    result.type = IPType.IPV6;
    result.flowInfo = flowInfo;
    result.scopeId = scopeId;
    return result;
  }

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

export class TCPResult {
  constructor(
    public type: NetworkResultType = NetworkResultType.Success,
    public error: string | null = null,
    public byteLength: usize = 0,
    ) {}
}

export class UDPResult {
  constructor(
    public type: NetworkResultType = NetworkResultType.Success,
    public error: string | null = null,
    public byteLength: usize = 0,
    public ip: IPAddress | null = null,
    ) {}
}