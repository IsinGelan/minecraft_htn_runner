
import type { Bot } from "mineflayer"
import { TaskHandler } from "../tasks/task_handler.ts"
import { TravelPlanner } from "../tasks/travel_planner.ts";
import { import_plan, run_task_call, TaskCall } from "./actions.ts";
import { split_once } from "../helpers.ts";

export class CustomBot {
    bot: Bot;
    task_handler: TaskHandler;
    travel_planner: TravelPlanner | null = null; // only null before bot is spawned
    memorized_structures: Map<string, [number, number, number]>;

    constructor(b: Bot) {
        this.bot = b;
        this.task_handler = new TaskHandler();

        this.set_extra_listeners()
    }

    on_spawn() {
        this.travel_planner = new TravelPlanner(this, this.task_handler, false)
        this.task_handler.add_task("travel_planner", this.travel_planner)
    }

    set_extra_listeners() {
        this.bot.on("spawn", () => {this.on_spawn()})
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

    // extra -----------------
    in_deep_water(): boolean {
        let feetpos = this.bot.entity.position
        let feetblock = this.bot.blockAt(feetpos)
        if (feetblock == null) return false
        if (feetblock.name != "water") return false

        let belowpos = feetpos.offset(0, -1, 0)
        let headpos = feetpos.offset(0, 1, 0)
        let belowblock = this.bot.blockAt(belowpos)
        let headblock = this.bot.blockAt(headpos)
        if (belowblock?.name == "water" || headblock?.name == "water") return true;
        return false;
    }
}
    