// This list of globals is provided by the `--use` flag in the `asconfig.json` file
// of the as-lunatic root directory. These constants can be overridden by end users,
// but these defaults are fine.

/**
 * This constant defines how many read buffers will be provided to the host when
 * calling the `TCPStrean#read()` method.
 */
declare const TCP_READ_BUFFER_COUNT: i32;
/**
 * This constant defines how large the read buffers will be when calling the
 * `TCPStrean#read()` method.
 */
declare const TCP_READ_BUFFER_SIZE: i32;
