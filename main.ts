
import vec3 from "vec3"
import { unloaded_biome_name, version, master_player_name } from "./constants.ts"

import mineflayer from "mineflayer"
import type { Bot } from "mineflayer";
import { pathfinder } from "mineflayer-pathfinder"
import { Movements } from 'mineflayer-pathfinder'
// import mf_pathfinder from "mineflayer-pathfinder"
// const { GoalNear } = mf_pathfinder.goals
import prismarineRecipe from 'prismarine-recipe'
import mcd from "minecraft-data"
const mcData = mcd(version)
const { Recipe } = prismarineRecipe(mcData)

import { highest_collidable_blockpos, biome_display_name, chunk_biome, biome_name, read_config } from "./helpers.ts"
import { chunk_likelihoods } from "./extra/block_stats.ts"
import { TaskHandler } from "./tasks/task_handler.ts"
import { ChunkStatisticTask } from "./tasks/statistic_task.ts"
import { SearchTask } from "./tasks/search_task.ts"
import { TpTask } from "./tasks/tp_task.ts"
import { cheat_give, id_to_planner_name, look_at_found_block, planner_name_to_id, short_name } from "./runner/action_helpers.ts"
import { ACTION_RECIPE, recipe_ingredients } from "./runner/crafting.ts"
import { CustomBot } from "./runner/custom_bot.ts"


// ===============================
const { host, port, bot_name } = read_config() 
console.log(`Connecting to ${host}:${port} as ${bot_name}...`)

const connection_bot = {
    "host": "localhost",
    "port": port,
    "username": bot_name,
    "version": version,
    "viewDistance": "tiny"
}

const connection_account = {
    "host": host,
    "port": "25565",
    "version": version,
    "ign": 0,
    "username": "...",
    "auth": "microsoft"
}


// ===============================
const bo: Bot = mineflayer.createBot(connection_bot as any)
bo.loadPlugin(pathfinder)

const bot = new CustomBot(bo)
let task_handler = bot.task_handler
// ===============================

async function exit() {
    console.log("Stopping all tasks...")
    await task_handler.stop_all_tasks()
    console.log("done!")
    process.exit(0);
}

bo.once('spawn', () => {
    bo.pathfinder.setMovements(new Movements(bo))
})

bo.on("spawn", () => {
    console.log("Bot spawned")
    bo.chat("Hello, I am a bot!")
})

bo.on("chunkColumnLoad", async (pos: any) => {
    let [cx, cy] = [pos.x/16, pos.z/16]
    let biome = chunk_biome(bo, [cx, cy])
    
    if (biome_name(biome) == unloaded_biome_name) return;
    // console.log(`chunk col [${cx}, ${cy}]: ${biome_display_name(biome)}`)

    if (task_handler.has_task("search_task")){
        let search_task = task_handler.get_task("search_task") as SearchTask
        search_task.on_new_chunk([cx, cy]);
    }
    if (task_handler.has_task("chunk_stat_task")){
        let chunk_stat_task = task_handler.get_task("chunk_stat_task") as ChunkStatisticTask
        chunk_stat_task.on_new_chunk([cx, cy]);
    }
})


bo.on("chat", async (username: string, message: string) => {
    if (username === bo.username) return
    console.log(`Chat message from ${username}: ${message}`)

    if (message === "come") {
        bo.chat("Coming, " + username + "!")
        const follow_player = bo.players[username]
        const player_pos = follow_player.entity.position
        // bot.pathfinder.setMovements(defaultMove)
        // bot.pathfinder.setGoal(new GoalNear(player_pos.x, player_pos.y, player_pos.z, 1))
        bot.travel_planner.set_goal([player_pos.x, player_pos.z])
    }

    if (message === "stop come") {
        bo.chat("Stopping, " + username + "!")
        bot.travel_planner.clear_goal()
    }

    if (message === "environment") {
        bo.chat("I see the following blocks around me:")
        let bp = bo.entity.position.round()

        for(let x = -5; x <= 5; x++) {
            for(let z = -5; z <= 5; z++) {
                let surface_level = highest_collidable_blockpos(bo, [bp.x + x, bp.z + z])
                let block_name = bo.blockAt(vec3(bp.x + x, surface_level, bp.z + z))
                bo.chat(`Block at (${bp.x + x}, ${surface_level}, ${bp.z + z}): ${block_name?.name}`)
            }
        }
    }

    if (message === "chunk") {
        let selfpos = bo.entity.position
        let [cx, cz] = [Math.floor(selfpos.x / 16), Math.floor(selfpos.z / 16)]
        let { block_biome, block_layer, biomes } = chunk_likelihoods(bo, [cx, cz])
        bo.chat("I am in chunk " + cx + ", " + cz)
        bo.chat("Block-Biome pairs in this chunk:")
        block_biome.forEach((block_biome) => {
            console.log(block_biome)
        })

        bo.chat("Block-Layer pairs in this chunk:")
        block_layer.forEach((block_layer) => {
            console.log(block_layer)
        })
    }

    if (message === "start stat tp") {
        console.log("Starting chunk statistic task")
        bo.chat("Starting chunk statistic task")
        task_handler.add_task("tp_task", new TpTask(bo, task_handler))
        task_handler.add_task("chunk_stat_task", new ChunkStatisticTask(bot, task_handler))
    }
    if (message === "start stat") {
        console.log("Starting chunk statistic task (no teleportation)")
        bo.chat("Starting chunk statistic task (no teleportation)")
        task_handler.add_task("chunk_stat_task", new ChunkStatisticTask(bot, task_handler))
    }
    if (message === "stop stat") {
        console.log("Stopping chunk statistic task")
        bo.chat("Stopping chunk statistic task")
        task_handler.stop_task("tp_task")
        task_handler.stop_task("chunk_stat_task")
    }

    if (message.startsWith("start search")) {
        let block_type = message.split(" ")[2]
        if (!block_type) {
            bo.chat("Please specify a block type, e.g. 'start search oak_log'")
            return
        }
        let short_blockname = short_name(block_type)
        if (!bo.registry.blocksByName[short_blockname]) {
            bo.chat("Unknown block type: " + block_type)
            return
        }
        task_handler.add_task("search_task", new SearchTask(bot, task_handler, bot.travel_planner, block_type, true))
    }

    if (message === "stop search") {
        console.log("Stopping search task")
        bo.chat("Stopping search task")
        task_handler.stop_task("search_task")
    }


    if (message === "eat") {
        // Implementation for eating
        bo.consume()
    }

    if (message === "howdy") {
        let stats = [bo.health, bo.food, bo.foodSaturation, bo.oxygenLevel].map(x => Math.floor(x))
        bo.chat(`HP: ${stats[0]}, F: ${stats[1]}, S: ${stats[2]}, O2: ${stats[3]}`)
    }

    if (message === "leave") {
        bo.chat("Goodbye!")
        exit()
    }
})


bo.on("end", async () => {
    console.log("Bot disconnected from server")
    await exit()
})

bo.on("error", async (err: Error) => {
    console.error("Error: ", err)
    await exit()
})


process.on('SIGINT', async () => {
    await exit();
});

process.on('SIGTERM', async () => {
    await exit();
});
