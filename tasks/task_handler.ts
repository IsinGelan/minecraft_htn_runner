
import type { Bot } from "mineflayer"
import type { CustomBot } from "../runner/custom_bot.ts"


export class Task {
    protected bot: CustomBot
    protected handler: TaskHandler
    private recurrent_interval: number
    private name: string
    public info: boolean = false
    public chat_info: boolean = false

    async start () {}
    async recurrent () {}
    async stop () {}

    constructor(bot: CustomBot, handler: TaskHandler, info: boolean = false) {
        this.bot = bot
        this.handler = handler
        this.recurrent_interval = 0
        this.name = ""
        this.info = info
        this.chat_info = info
    }
    take_name(name: string) {
        this.name = name
    }
    get_name(): string {
        return this.name
    }

    get_recurrent_interval(): number {
        return this.recurrent_interval
    }
    set_recurrent_interval(interval_s: number) {
        this.recurrent_interval = interval_s
        // TODO: Implement automatic calling by TaskHandler
        this.handler.update_recurrent_interval(this.name, interval_s)
    }

    log(msg: string) {
        if(!this.info) return;
        
        let text = `[${this.name}] ${msg}`
        console.log(text)

        if(!this.chat_info) return;
        let lines = text.split("\n")
        lines.forEach((line) => {
            this.bot.bot.chat(line)
        })
    }
}

export class FinishableTask extends Task {
    public finished: boolean = false

    private resolveFinished!: () => void;
    private finishedPromise: Promise<void>;

    constructor(bot: CustomBot, handler: TaskHandler, info: boolean = false) {
        super(bot, handler, info)
        this.finishedPromise = new Promise<void>((resolve) => {
            this.resolveFinished = resolve;
        });
    }

    protected async finish() {
        this.finished = true
        this.resolveFinished();
        await this.handler.stop_task(this.get_name())
    }
    async run() {
        await this.finishedPromise;
    }
}



export class TaskHandler {
    tasks: Map<string, Task>
    interval_ids: Map<string, NodeJS.Timeout>

    constructor() {
        this.tasks = new Map()
        this.interval_ids = new Map()
    }

    add_task(name: string, task: Task) {
        this.tasks.set(name, task)
        task.take_name(name)
        task.start()
    }
    has_task(name: string): boolean {
        return this.tasks.has(name)
    }
    get_task(name: string): Task | null {
        return this.tasks.get(name) || null
    }
    update_recurrent_interval(task_name: string, interval_s: number) {
        if (!this.tasks.has(task_name)) return;

        // remove interval call
        this.interval_ids.get(task_name)?.close()
        console.log(`cleared for ${task_name}!`)

        if (interval_s <= 0.5) return;

        const interval_id = setInterval(() => {
            const task = this.tasks.get(task_name)!
            task.recurrent()
            },
            interval_s*1000
        )
        this.interval_ids.set(task_name, interval_id)
    }
    async stop_task(name: string) {
        const task = this.tasks.get(name)
        if(!task) return;
        this.update_recurrent_interval(name, 0)
        await task.stop()
        this.tasks.delete(name)
    }
    async stop_all_tasks() {
        this.tasks.forEach(async (task, name) => {
            this.stop_task(name)
        })
    }
}