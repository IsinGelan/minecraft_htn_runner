
import type { Bot } from "mineflayer"
import { TaskHandler } from "../tasks/task_handler.ts"
import { TravelPlanner } from "../tasks/travel_planner.ts";
import { import_plan, run_task_call, TaskCall } from "./actions.ts";
import { split_once } from "../helpers.ts";

export class CustomBot {
    bot: Bot;
    task_handler: TaskHandler;
    travel_planner: TravelPlanner;
    memorized_structures: Map<string, [number, number, number]>;

    constructor(b: Bot, th: TaskHandler) {
        this.bot = b;
        this.task_handler = th;
        this.travel_planner = new TravelPlanner(b, th, false)
        this.task_handler.add_task("travel_planner", this.travel_planner)

        this.set_extra_listeners()
    }

    set_extra_listeners() {
        this.bot.on("chat", async (username: string, message: string) => {
            if (username === this.bot.username) return
            console.log(`Chat message from ${username}: ${message}`)

            if (message.startsWith("execute")) {
                let tc = split_once(message, "execute")[1]
                let task_call = TaskCall.from_string(tc)
                this.bot.chat(`task name: ${task_call.task_name}`)
                await run_task_call(this, task_call);
                this.bot.chat(`Task ${task_call.to_string()} finished!`)
            }

            if (message.startsWith("run plan")) {
                let {name, goal, calls} = import_plan()
                this.bot.chat(`>> Running plan '${name}'(${calls.length} a) with goal ${goal}`)
                await this.run_plan(calls)
                this.bot.chat(`|| Plan finished!`)
            }
        })
    }

    async run_plan(plan: TaskCall[]) {
        for (const taskcall of plan) {
            this.bot.chat(`Executing task: ${taskcall.to_string()}`)
            await run_task_call(this, taskcall);
        }
    }

    // -----------------
    memorize_structure(name: string, pos: [number, number, number]) {
        this.memorized_structures.set(name, pos)
        this.bot.chat(`Structure ${name} memorized at position ${pos}`)
    }

    get_memorized_structure(name: string): [number, number, number] | null {
        if (!this.memorized_structures.has(name)) {
            this.bot.chat(`Structure ${name} not memorized`)
            return null
        }
        return this.memorized_structures.get(name)!
    }
}
    