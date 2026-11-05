
import type { Vec3 } from "vec3";

import type { Bot } from "mineflayer";

import { half_score_distance, look_for_block_distance, prob_lower_threshold, unloaded_biome_id, wander_distance } from "../constants.ts";
import { Task, FinishableTask, TaskHandler } from "./task_handler.ts";
import { chunk_biome, biome_name, distance2, chunk_at, chunk_center, vec3_to_xz,
    argmax, random_direction, to_polar, to_cartesian, 
    block_id,
    argmin} from "../helpers.ts";

import { load_block_probs } from "../extra/block_stats.ts";
import type { TravelPlanner } from "./travel_planner.ts";
import { planner_name_to_id, short_name } from "../runner/action_helpers.ts";
import type { CustomBot } from "../runner/custom_bot.ts";

// TERMILOGY:
// search:  to systematically try and find a target
// locate:  to get the position of some target in an area
// find:    unconcrete

type SearchPhase = "start" | "wander" | "goto_chunk" | "locate_in_chunk" | "goto_block"


// ===============================
const { block_biome_stat, block_layer_stat } = load_block_probs()

function biome_block_prob(biome: string, block_type: string): number {
    let key =  `${block_type},${biome}`
    return  block_biome_stat.get(key) ?? 0
}

// ===============================
function chunk_score(bot: Bot, chunk_pos: [number, number], target_block_type: string): number {
    let biome = biome_name(chunk_biome(bot, chunk_pos))
    let biome_prob = biome_block_prob(biome, target_block_type)
    let chunk_dist = distance2(vec3_to_xz(bot.entity.position), chunk_center(chunk_pos))
    let dist_factor = Math.pow(2, -chunk_dist / half_score_distance)

    return biome_prob * dist_factor
}

function is_chunk_promising(prob: number) {
    return prob > prob_lower_threshold
}


// ===============================
export class SearchTask extends FinishableTask {
    private travel_planner: TravelPlanner
    
    private target_block_type: string //short name, so "diamond_ore" instead of "b_diamond_ore"
    private target_block_id: number
    // private current_goal: [number, number]
    private wander_direction: number
    private search_phase: SearchPhase

    private chunks_searched: Set<string> = new Set()


    constructor(bot: CustomBot, handler: TaskHandler, travel_planner: TravelPlanner, target_block_type: string, info: boolean = false) {
        super(bot, handler, info)
        this.travel_planner = travel_planner

        this.target_block_type = short_name(target_block_type)
        this.target_block_id = planner_name_to_id(target_block_type)
        this.bot.bot.chat(`The ID is ${this.target_block_id}`)
        if (this.target_block_id === -1) throw new Error(`Invalid target block type: ${target_block_type}`)
        //block_id(this.bot.bot, this.target_block_type)
        this.search_phase = "start"

        this.wander_direction = 0
    }

    async start() {
        console.log("I am ", this.get_name())
        this.set_recurrent_interval(3)
        
        this.check_where_to_go()
    }

    async recurrent() {
    }


    // start ---------------------
    check_where_to_go() {
        this.search_phase = "start"
        let {chunk_pos, score} = this.get_best_loaded_chunk()!
        let biome = biome_name(chunk_biome(this.bot.bot, chunk_pos))
        
        this.log("checking where to go!")
        this.log(`Best chunk next to me: [${chunk_pos}] <${biome}> with score ${score.toFixed(3)}`)

        if (!chunk_pos || !is_chunk_promising(score)) {
            this.start_wander()
        }

        this.log("There is a good chunk nearby!")
        this.start_goto_chunk(chunk_pos)
    }

    get_best_loaded_chunk(): {chunk_pos: [number, number], score: number} {
        let loaded_chunks = this.bot.bot.world.getColumns()
        let unchecked_chunks = loaded_chunks.filter(chunk => {
            let chunk_key = `${chunk.chunkX},${chunk.chunkZ}`
            return !this.chunks_searched.has(chunk_key)
        })

        if (unchecked_chunks.length === 0) return {chunk_pos: undefined, score: 0};

        let chunk_scores = unchecked_chunks.map(chunk => {
            let chunk_pos = [chunk.chunkX, chunk.chunkZ] as [number, number]
            let score = chunk_score(this.bot.bot, chunk_pos, this.target_block_type)

            return [chunk_pos, score] as [[number, number], number]
        });

        let [maxpos, score] =  argmax(chunk_scores, ([, score]) => score)!
        return {chunk_pos: maxpos, score: score}
    }

    // wander --------------------
    start_wander() {
        this.log("wander phase started!")
        this.wander_direction = random_direction()
        this.travel_planner.set_path_routine(this.wander_routine.bind(this))
        this.search_phase = "wander"
    }

    on_new_chunk(chunk_pos: [number, number]) {
        if (this.search_phase !== "wander") return;

        let [cx, cz] = chunk_pos
        let biome = biome_name(chunk_biome(this.bot.bot, chunk_pos))

        let score = chunk_score(this.bot.bot, chunk_pos, this.target_block_type)
    }

    on_promising_chunk(chunk_pos: [number, number], score: number) {
        let biome = biome_name(chunk_biome(this.bot.bot, chunk_pos))
        this.log(`Found promising chunk [${chunk_pos[0]}, ${chunk_pos[1]}] <${biome}>\n
                with score ${score.toFixed(3)}. I will go there!`)
        
        this.start_goto_chunk(chunk_pos)
    }

    wander_routine() {
        this.log("And I wander...")
        let delta = to_cartesian([wander_distance, this.wander_direction])
        let bpos = this.bot.bot.entity.position
        let new_goal = [bpos.x + delta[0], bpos.z + delta[1]] as [number, number]
        return new_goal
    }

    // locate_in_chunk -----------
    start_goto_chunk(chunk_pos: [number, number]) {
        this.search_phase = "goto_chunk"
        this.log(`goto_chunk phase started! (${chunk_pos[0]}, ${chunk_pos[1]})`)
        this.travel_planner.set_goal_reached_callback(this.on_arrived_at_chunk.bind(this))
        // Why does stuff like this happen:
        // TravelPlanner: setting goal to [3688, 88]
        //   goal pre:      null
        //   sec goal pre:  null
        //   goal post:     3688,88
        //   sec goal post: null
        //   action:        recompute_section_goal
        //   goal post:     3688,88
        //   sec goal post: null
        //   action:        done
        this.travel_planner.set_goal(chunk_center(chunk_pos))
    }

    
    // locate_in_chunk -----------
    on_arrived_at_chunk() {
        console.log("Arrived at chunk! Search phase: " + this.search_phase)
        if (this.search_phase !== "goto_chunk") return;
        this.start_locate_in_chunk()
    }
    
    start_locate_in_chunk() {
        this.search_phase = "locate_in_chunk"
        this.log("locate_in_chunk phase started!")
        let closeby_target = this.is_target_block_nearby()
        if (closeby_target) {
            this.start_goto_block(closeby_target)
        } else {
            let chunk_pos = chunk_at(this.bot.bot.entity.position)
            let chunk_key = `${chunk_pos[0]},${chunk_pos[1]}`
            this.chunks_searched.add(chunk_key)
            this.check_where_to_go()
        }
    }
    
    is_target_block_nearby(): Vec3 | null {
        // Whether the target block is closeby and visible, return its position, else null
        const positions = this.bot.bot.findBlocks({
            matching: this.target_block_id,
            maxDistance: look_for_block_distance,
            count: 1000
        })
        
        const visible = positions.filter(pos => {
            const block = this.bot.bot.blockAt(pos)
            return block && this.bot.bot.canSeeBlock(block)
        })
        
        if (visible.length === 0) return null;
        
        const closest = argmin(visible, pos => distance2(vec3_to_xz(this.bot.bot.entity.position), [pos.x, pos.z]))
        return closest;
    }

    // goto_block ----------------
    start_goto_block(block_pos: Vec3) {
        this.search_phase = "goto_block"
        this.log(`goto_block phase started! (${block_pos.x}, ${block_pos.y}, ${block_pos.z})`)
        this.travel_planner.set_goal_reached_callback(this.finish.bind(this))
        this.travel_planner.set_goal([block_pos.x, block_pos.z])
    }
    
    // ---------------------------
    get_search_phase() {return this.search_phase}
    
    // ---------------------------
    async stop() {
        this.log("Search finished!")
        this.travel_planner.clear_goal()
    }
}