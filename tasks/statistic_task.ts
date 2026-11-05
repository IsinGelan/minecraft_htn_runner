
import fs from "fs"

import type { Bot } from "mineflayer";
import { block_stats_path } from "../constants.ts";
import { Task } from "./task_handler.ts";
import type { TaskHandler } from "./task_handler.ts";
import { chunk_likelihoods } from "../extra/block_stats.ts";
import {sort_object, highest_collidable_blockpos} from "../helpers.ts"
import type { CustomBot } from "../runner/custom_bot.ts";


export class ChunkStatisticTask extends Task {
    private chunks_seen: Set<string>
    private chunks_nr: number
    private block_biome_stat: Map<string, number>
    private block_layer_stat: Map<string, number>
    private biomes_stat: Map<string, number>

    constructor(bot: CustomBot, handler: TaskHandler, info: boolean = false) {
        super(bot, handler, info)
        this.chunks_seen = new Set()
        this.chunks_nr = 0
        this.block_biome_stat = new Map()
        this.block_layer_stat = new Map()
        this.biomes_stat = new Map()
    }

    async start() {
        console.log("[StatTask] I am ", this.get_name())
        await this.load_stats()
    }

    async on_new_chunk(chunk_pos: [number, number]) {
        const key = `${chunk_pos[0]},${chunk_pos[1]}`
        if(this.chunks_seen.has(key)) return;

        this.bot.bot.chat(`[StatTask] Analyzing chunk [${chunk_pos[0]}, ${chunk_pos[1]}]`)
        this.chunks_seen.add(key)
        this.chunks_nr += 1

        let {block_biome, block_layer, biomes} = chunk_likelihoods(this.bot.bot, chunk_pos)
        block_biome.forEach((bb) => {
            this.block_biome_stat.set(bb, (this.block_biome_stat.get(bb) || 0) + 1)
        })
        block_layer.forEach((bl) => {
            this.block_layer_stat.set(bl, (this.block_layer_stat.get(bl) || 0) + 1)
        })
        biomes.forEach((b) => {
            this.biomes_stat.set(b, (this.biomes_stat.get(b) || 0) + 1)
        })
    }

    async load_stats() {
        if(!fs.existsSync(block_stats_path)) return;

        const data = await fs.promises.readFile(block_stats_path, "utf-8")
        const obj = JSON.parse(data)
        this.chunks_nr = obj.chunk_nr
        this.chunks_seen = new Set(obj.chunks_seen)
        this.block_biome_stat = new Map(Object.entries(obj.block_biome_stat))
        this.block_layer_stat = new Map(Object.entries(obj.block_layer_stat))
        this.biomes_stat = new Map(Object.entries(obj.biomes))
    }
    save_stats() {
        let obj = {
            chunk_nr: this.chunks_nr,
            biomes: Object.fromEntries(this.biomes_stat),
            block_biome_stat: sort_object(Object.fromEntries(this.block_biome_stat)),
            block_layer_stat: sort_object(Object.fromEntries(this.block_layer_stat)),
            chunks_seen: Array.from(this.chunks_seen)
        }
        fs.writeFileSync(block_stats_path, JSON.stringify(obj, null, 2), (err) => {
            if (err) console.error(err)
        })
    }

    async stop() {
        this.bot.bot.chat("Stopping chunk statistic task. Saving stats...")
        this.save_stats()
        this.bot.bot.chat("Done!")
        console.log("Chunk statistic task stopped. Stats saved to " + block_stats_path)
    }
}