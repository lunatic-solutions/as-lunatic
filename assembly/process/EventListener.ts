import { Mailbox, MessageType } from "..";
import { Result } from "../error";
import { Process } from "./index";

export abstract class EventListener<TBaseEvent> {
    /** How long to wait for messages before a timeout occurs. */
    timeout: u32 = 0;
    /** A collection of tags to listen for. */
    tags: StaticArray<i64> | null = null;
    /** The process listening for events. */
    process: Process<TBaseEvent> | null = null;

    /** A method called when the EventListener starts up. */
    abstract onInitialize(): void;
    /** A method called when the EventListener listens for a message and the call times out. */
    abstract onTimeout(): bool;
    /**
     * A method called whenever an event occurs.
     *
     * @param {TBaseEvent} ev - The base class of the event being emitted.
     * @returns {bool} True if the event listener should stop listening and close.
     */
    abstract onEvent(ev: TBaseEvent): bool;
    /**
     * A method called whenever a signal is received that a process died.
     *
     * @param {u64} tag - The process tag that was received in the signal.
     * @returns {bool} True if the event listener should stop listening and close.
     */
    abstract onSignal(tag: u64): bool;
    /** A method called whenever resources are finalized in the listening process. */
    abstract onFinalize(): void;

    /**
     * Start listening to events on a new process.
     *
     * @returns {Result<Process<TBaseEvent> | null>} The result of creating the process the event listener is listening on.
     */
    start(): Result<Process<TBaseEvent> | null>  {
        assert(!this.process);
        let result = Process.inheritSpawnWith<EventListener<TBaseEvent>, TBaseEvent>(this, (ctx: EventListener<TBaseEvent>, mb: Mailbox<TBaseEvent>) => {
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
        if (result.isOk()) this.process = result.expect();
        return result;
    }

    /** Emit an event to the listening process. */
    emit<EventType extends TBaseEvent>(event: EventType): void {
        this.process!.send<EventType>(event);
    }
}
