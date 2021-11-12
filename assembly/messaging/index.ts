// @ts-ignore
@external("lunatic::message", "write_data")
export declare function write_data(data_ptr: usize, data_len: usize): usize

// @ts-ignore
@external("lunatic::message", "read_data")
export declare function read_data(data_ptr: usize, data_len: usize): usize

// @ts-ignore
@external("lunatic::message", "seek_data")
export declare function seek_data(id: u64): void

// @ts-ignore
@external("lunatic::message", "get_tag")
export declare function get_tag(): i64

// @ts-ignore
@external("lunatic::message", "get_reply_handle")
export declare function get_reply_handle(): u64

// @ts-ignore
@external("lunatic::message", "drop_reply_handle")
export declare function drop_reply_handle(reply_handle: usize): void

// @ts-ignore
@external("lunatic::message", "data_size")
export declare function data_size(): u64

