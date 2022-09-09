/** The message type when calling `mailbox.receive()`. */
export const enum MessageType {
  /** Represents a data message, the value must be unpacked. */
  Data = 0,
  /** Represents a signal message, a process has been affected. */
  Signal = 1,
  /** A receive timeout means that no message was received. */
  Timeout = 9027,
}
