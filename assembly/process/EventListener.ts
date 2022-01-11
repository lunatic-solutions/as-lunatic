import { Mailbox, MessageType } from "..";
import { UnmanagedResult } from "../error";
import { Process } from "./index";

export abstract class EventListener<TBaseEvent> {
    timeout: u32 = 0;
    tags: StaticArray<i64> | null = null;
    abstract onInitialize(): void;
    abstract onTimeout(): bool;
    abstract onEvent(ev: TBaseEvent): bool;
    abstract onSignal(tag: u64): bool;
    abstract onFinalize(): void;
}

export class EventEmitter<TBaseEvent> {

    static createWith<TBaseEvent, TEventListener extends EventListener<TBaseEvent>>(
        context: TEventListener
    ): UnmanagedResult<EventEmitter<TBaseEvent> | null> {
        let result = Process.inheritSpawnWith<TEventListener, TBaseEvent>(context, (ctx: TEventListener, mb: Mailbox<TBaseEvent>) => {
            ctx.onInitialize();

            while (true) {
                let msg = mb.receive(ctx.tags, ctx.timeout);
                let type = msg.type;
                if (type == MessageType.Data) {
                    if (ctx.onEvent(msg.value!.value)) break;
                } else if (type == MessageType.Timeout) {
                    if (ctx.onTimeout()) break;
                } else {
                    if (ctx.onSignal(msg.tag)) break;
                }
            }

            ctx.onFinalize();
        });

        if (result.isOk()) return new UnmanagedResult<EventEmitter<TBaseEvent> | null>(new EventEmitter<TBaseEvent>(result.value!));
        return new UnmanagedResult<EventEmitter<TBaseEvent> | null>(null, result.errorString);
    }

    constructor(
        public process: Process<TBaseEvent>,
    ) {}

    emit<EventType extends TBaseEvent>(event: EventType): void {
        this.process.send<EventType>(event);
    }
}
