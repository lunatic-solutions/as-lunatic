import { ErrCode, Mailbox } from "..";
import { UnmanagedResult } from "../error";
import { Process } from "./index";

export class TaskStartWrapper<TPayload, TResult> {
    constructor(
        public payload: TPayload,
        public process: Process<TResult>,
        public callback: u32,
    ) {}
}

export namespace Task {
    export function create<TPayload, TResult>(
        payload: TPayload,
        process: Process<TResult>,
        callback: (payload: TPayload) => TResult,
    ): UnmanagedResult<ErrCode> {
        let wrapper = new TaskStartWrapper<TPayload, TResult>(payload, process, callback.index);
        let result = Process.inheritSpawnWith<TaskStartWrapper<TPayload, TResult>, i32>(
            wrapper,
            (start: TaskStartWrapper<TPayload, TResult>, _mb: Mailbox<i32>) => {
                let result: TResult = call_indirect(start.callback, start.payload);
                start.process.send(result);
            },
        );
        if (result.isOk()) return new UnmanagedResult(ErrCode.Success);
        return new UnmanagedResult(ErrCode.Fail, result.errorString);
    }
}
