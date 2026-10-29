
import type { Bot } from "mineflayer";

import {stat_tp_dist, stat_tp_interval} from "../constants.ts";
import { Task } from "./task_handler.ts";
import type { TaskHandler } from "./task_handler.ts";
import { distance2, highest_collidable_blockpos } from "../helpers.ts";




export class TpTask extends Task {
    private start_pos: [number, number]

    constructor(bot: Bot, handler: TaskHandler, info: boolean = false) {
        super(bot, handler, info)
        let bpos = bot.entity.position
        this.start_pos = [bpos.x, bpos.z]
    }

    async start() {
        console.log("[TpTask] I am ", this.get_name())
        this.set_recurrent_interval(stat_tp_interval)
    }

    async recurrent() {
        await this.bot.waitForChunksToLoad()
        this.tp();
    }

    async tp() {
        let bpos = this.bot.entity.position
        let next_x = bpos.x + stat_tp_dist
        let this_z = bpos.z
        let hpos = highest_collidable_blockpos(this.bot, [next_x, this_z])
        let next_y = hpos >= 63 ? hpos + 1 : 80
        this.bot.chat(`/tp ${next_x} ${next_y} ${this_z}`)
        let dist_now = distance2(this.start_pos, [next_x, this_z])
        this.log(`I already moved ${dist_now.toFixed(2)} blocks!`)
    }

}