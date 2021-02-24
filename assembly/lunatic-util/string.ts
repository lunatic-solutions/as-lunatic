export const enum CharCode {
  _0 = 0x30,
  _9 = 0x39,
  dot = 0x2E,
  colon = 0x3A,
  a = 0x61,
  f = 0x66,
  A = 0x41,
  F = 0x46,
}

// @ts-ignore force inlining
@inline
function betweenInclusive(val: u16, start: u16, end: u16): i32 {
  return i32(val >= start) & i32(val <= end);
}

// @ts-ignore force inlining
@inline
function isDigit(char: u16, isHex: bool): bool {
  return bool(betweenInclusive(char, <u16>CharCode._0, <u16>CharCode._9)
   | (i32(isHex) & (betweenInclusive(char, <u16>CharCode.A, <u16>CharCode.F) | betweenInclusive(char, <u16>CharCode.a, <u16>CharCode.f))));
}

export const ipOutput = memory.data(16); // static segment for output
export const portOutput = memory.data(2); // u16 for port
export const byteOutput = memory.data(1); // single byte for consumeOctet output

export class IP {
  public constructor(
    public isv6: bool,
    public bytes: StaticArray<u8>,
    public port: u16,
  ) {}
}

export function getIP(isv6: bool): IP {
  let length = select<i32>(16, 4, isv6);
  let bytes = new StaticArray<u8>(length);
  memory.copy(changetype<usize>(bytes), ipOutput, length);
  return new IP(
    isv6,
    bytes,
    load<u16>(portOutput),
  );
}

export function tryParseIPV4(input: usize, byteLength: usize): bool {
  let offset = <usize>0;
  // three times, consume octet + "."
  for (let i = 0; i < 3; i++) {
    let advance = tryParseOctet(input, byteLength, offset);
    if (advance == 0) return false;
    offset += advance;
    if (!tryConsumeCode(input, byteLength, offset, <u16>CharCode.dot)) return false;
    offset += 2;
    let byte = load<u8>(byteOutput);
    store<u8>(ipOutput + <usize>i, byte);
  }

  // then consume one last octet
  let advance = tryParseOctet(input, byteLength, offset);
  if (advance == 0) return false;
  offset += advance;
  let byte = load<u8>(byteOutput);
  store<u8>(ipOutput, byte, 3);

  if (tryConsumeCode(input, byteLength, offset, <u16>CharCode.colon)) {
    offset += 2;
    advance = tryParsePort(input, byteLength, offset);
    if (advance > 0) {
      offset += advance;
      return offset == byteLength;
    } else return false; // no port after colon error
  } else {
    // no port? set it to 0 just in case
    store<u16>(portOutput, 0);
    return offset == byteLength;
  }
}

function tryConsumeCode(input: usize, byteLength: usize, offset: usize, code: u16): bool {
  if (offset >= byteLength) return false;
  let char = load<u16>(input + offset);
  return char == code;
}

const CHAR_CONVERSION_CONST: u16 = 0x0030;

function tryParseOctet(input: usize, byteLength: usize, offset: usize): usize {
  let ptr = input + offset;
  if (offset >= byteLength) return 0; // consume nothing
  let char1: u16 = load<u16>(ptr);
  let char2: u16 = 0;
  let char3: u16 = 0;
  let consumeCount: usize = 2;
  let total: u16 = 0;
  if (offset + 2 <= byteLength && isDigit(char1, false)) {
    char2 = load<u16>(ptr, 2);
    total = char1 - CHAR_CONVERSION_CONST;
    if (offset + 4 <= byteLength && isDigit(char2, false)) {
      char3 = load<u16>(ptr, 4);
      total = total * 10 + char2 - CHAR_CONVERSION_CONST;
      if (isDigit(char3, false)) {
        consumeCount = 6;
        total = total * 10 + char3 - CHAR_CONVERSION_CONST;
      } else {
        consumeCount = 4;
      }
    }
  }

  // if this is a valid octet
  if (total <= 255) {
    store<u8>(byteOutput, <u8>total);
    return consumeCount;
  }

  return 0;
}

function tryParsePort(input: usize, byteLength: usize, offset: usize): usize {
  let advance: usize = 0;
  let total: u32 = 0;

  while (true) {
    let index = offset + advance;
    if (index >= byteLength) break;
    let char = load<u16>(input + index);
    if (!isDigit(char, false)) break;
    total = total * 10 + <u32>(char - CHAR_CONVERSION_CONST);
    advance += sizeof<u16>();
  }

  // port range must be u16 range
  if (total > 0xFFFF) {
    store<u16>(portOutput, 0);
    return 0;
  }

  store<u16>(portOutput, <u16>total);
  return advance;
}

const enum ipv6_flag_t {
  HasPort       = 0b0001,
  HasMask       = 0b0010,
  HasEmbedIPV4  = 0b0100,
  HasIPV4Compat = 0b1000,
}

// @ts-ignore
@inline const IPV6_NUM_COMPONENTS = 8;
// @ts-ignore
@inline const IPV4_NUM_COMPONENTS = 2;
// @ts-ignore
@inline const IPV4_EMBED_INDEX = 6;

class ipv6_address_full_t {
  address_0: u8;
  address_1: u8;
  address_2: u8;
  address_3: u8;
  address_4: u8;
  address_5: u8;
  address_6: u8;
  address_7: u8;
  address_8: u8;
  address_9: u8;
  address_10: u8;
  address_11: u8;
  address_12: u8;
  address_13: u8;
  address_14: u8;
  address_15: u8;
  port: u16;
  pad0: u16;
  mask: u32;
  iface_offset: usize;
  iface_length: usize;
  flags: ipv6_flag_t;
}

const enum ipv6_compare_result_t {
  IPV6_COMPARE_OK = 0,
  IPV6_COMPARE_FORMAT_MISMATCH = 1,       // address differ in their
  IPV6_COMPARE_MASK_MISMATCH = 2,         // the CIDR mask does not match
  IPV6_COMPARE_PORT_MISMATCH = 3,         // the port does not match
  IPV6_COMPARE_ADDRESS_MISMATCH = 4,      // address components do not match
}

const enum ipv6_diag_event_t {
    IPV6_DIAG_STRING_SIZE_EXCEEDED          = 0,
    IPV6_DIAG_INVALID_INPUT                 = 1,
    IPV6_DIAG_INVALID_INPUT_CHAR            = 2,
    IPV6_DIAG_TRAILING_ZEROES               = 3,
    IPV6_DIAG_V6_BAD_COMPONENT_COUNT        = 4,
    IPV6_DIAG_V4_BAD_COMPONENT_COUNT        = 5,
    IPV6_DIAG_V6_COMPONENT_OUT_OF_RANGE     = 6,
    IPV6_DIAG_V4_COMPONENT_OUT_OF_RANGE     = 7,
    IPV6_DIAG_INVALID_PORT                  = 8,
    IPV6_DIAG_INVALID_CIDR_MASK             = 9,
    IPV6_DIAG_IPV4_REQUIRED_BITS            = 10,
    IPV6_DIAG_IPV4_INCORRECT_POSITION       = 11,
    IPV6_DIAG_INVALID_BRACKETS              = 12,
    IPV6_DIAG_INVALID_ABBREV                = 13,
    IPV6_DIAG_INVALID_DECIMAL_TOKEN         = 14,
    IPV6_DIAG_INVALID_HEX_TOKEN             = 15,
}

class ipv6_diag_info_t {
  message: string;        // English ascii debug message
  input: usize;           // Input string that generated the diagnostic
  position: usize;        // Position in input that caused the diagnostic
  pad0: usize;
}

const enum state_t {
  STATE_NONE              = 0,
  STATE_ADDR_COMPONENT    = 1,
  STATE_V6_SEPARATOR      = 2,
  STATE_ZERORUN           = 3,
  STATE_CIDR              = 4,
  STATE_IFACE             = 5,
  STATE_PORT              = 6,
  STATE_POST_ADDR         = 7,
  STATE_ERROR             = 8,
}

const enum eventclass_t {
  EC_DIGIT                = 0,
  EC_HEX_DIGIT            = 1,
  EC_V4_COMPONENT_SEP     = 2,
  EC_V6_COMPONENT_SEP     = 3,
  EC_CIDR_MASK            = 4,
  EC_IFACE                = 5,
  EC_OPEN_BRACKET         = 6,
  EC_CLOSE_BRACKET        = 7,
  EC_WHITESPACE           = 8,
}

const enum ipv6_reader_state_flag_t {
  READER_FLAG_ZERORUN            = 0x00000001,   // indicates that the zerorun index is set
  READER_FLAG_ERROR              = 0x00000002,   // indicates an error occurred in parsing
  READER_FLAG_IPV4_EMBEDDING     = 0x00000004,   // indicates IPv4 embedding has occurred
  READER_FLAG_IPV4_COMPAT        = 0x00000008,   // indicates IPv4 compatible address
}

class ipv6_reader_state_t {
  address_full: ipv6_address_full_t;
  error_message: string | null;
  input: usize;
  current: state_t;
  input_bytes: usize;
  position: usize;
  components: i32;
  token_position: i32;
  token_len: i32;
  seperator: i32;
  brackets: i32;
  zerorun: usize;
  v4_embedding: usize;
  v4_octets: i32;
  flags: u32;
  userData: StaticArray<u8>;
  diag_func: usize; // should be a callback
}
