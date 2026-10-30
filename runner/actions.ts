
import fs from "fs"

import mf_pathfinder from "mineflayer-pathfinder"
const { GoalFollow } = mf_pathfinder.goals

// import type {Bot} from "mineflayer"
import { ACTION_RECIPE } from "./crafting.ts"
import { closest_placing_positions, goto_item, look_at_found_block, look_at_found_entity, place_block_feedback, planner_name_to_id, short_name } from "./action_helpers.ts"
import { plan_path } from "../constants.ts"
import { CustomBot } from "./custom_bot.ts"
import { SearchTask } from "../tasks/search_task.ts"
import { distance2 } from "../helpers.ts"


export function teleport(bot: CustomBot, pos: [number, number, number]){
    bot.bot.chat(`/tp ${pos[0]} ${pos[1]} ${pos[2]}`)
}


export function dono(bot: CustomBot) {} 

// BLOCK

// action mine-block-directly(btype: Block, tool: Tool, res_item: Item)
export async function mine_block_directly(bot: CustomBot, btype: string, tool: string, res_item: string){
    let block = look_at_found_block(bot.bot, btype)
    if (block === null) {
        bot.bot.chat(`Block not found: ${btype}`)
        return}
    if (tool !== "i_air") {
        let tool_id = planner_name_to_id(tool)
        if (!bot.bot.inventory.items().find((item) => item.type === tool_id)) {
            bot.bot.chat(`Tool not in inventory: ${tool}`)
            return
        }
        bot.bot.equip(tool_id, "hand")
    }
    await bot.bot.dig(block)
}

// action reap-block(btype: Block, tool: Tool, res_item: Item)
export function reap_block(bot: CustomBot, btype: string, tool: string, res_item: string){}

// action place-block(btype: Block, item: Item)
export async function place_block(bot: CustomBot, btype: string, item: string){
    bot.bot.chat(`Placing block ${btype} using item ${item}`)
    let item_id = planner_name_to_id(item)
    if (!bot.bot.inventory.items().find((item) => item.type === item_id)) {
        bot.bot.chat(`Item to place down not in inventory: ${item}`)
        return
    }
    await bot.bot.equip(item_id, "hand")
    for (let [blockpos, visible_side] of closest_placing_positions(bot.bot)) {
        console.log(`Trying to place block at ${blockpos} with visible side ${visible_side}`)
        let success = await place_block_feedback(bot.bot, blockpos, visible_side)
        if (success) return
    }
    bot.bot.chat(`No valid position found to place block ${btype}`)
}

// action find-block-in-dim(btype: Block, dim: Dim)
export async function find_block_in_dim(bot: CustomBot, btype: string, dim: string){
    let search_task = new SearchTask(bot.bot, bot.task_handler, bot.travel_planner, btype, false)
    bot.task_handler.add_task("search_task", search_task)
    await search_task.run()
}

// action container-put(ctype: Container, item: Item)
export function container_put(bot: CustomBot, ctype: string, item: string){

}

// action container-take(ctype: Container, item: Item)
export function container_take(bot: CustomBot, ctype: string, item: string){}


// ENTITY

// action kill-entity-directly(entity: Entity)
export async function kill_entity_directly(bot: CustomBot, entity: string){
    let en = look_at_found_entity(bot.bot, entity)
    if (en === null) return;
    bot.bot.pathfinder.setGoal(new GoalFollow(en, 1.5), true)
    while (en.isValid) {
        // Do until dead
        await bot.bot.waitForTicks(10)
        if (distance2(
            [bot.bot.entity.position.x, bot.bot.entity.position.z],
            [en.position.x, en.position.z]) < 3) {
            bot.bot.attack(en)
        }
    }
}

// action kill-entity-directly-for-item(entity: Entity, res_item: Item)
export async function kill_entity_directly_for_item(bot: CustomBot, entity: string, res_item: string){
    await kill_entity_directly(bot, entity)
}

// action reap-entity(entity: Entity, tool: Tool, res_item: Item)
export function reap_entity(bot: CustomBot, entity: string, tool: string, res_item: string){}

// action find-entity-in-dim(etype: Entity, dim: Dim)
export function find_entity_in_dim(bot: CustomBot, etype: string, dim: string){}


// DIMENSION

// action enter-portal-dim(portal_type: Portal, dim: Dim)
export function enter_portal_dim(bot: CustomBot, portal_type: string, dim: string){}


// STRUCTURE

// action goto-memorized-structure(s: Structure)
export function goto_memorized_structure(bot: CustomBot, structure: string){
    let pos = bot.get_memorized_structure(structure)
    if (pos === null) return;
    bot.travel_planner.set_goal([pos[0], pos[2]])
}

// action build-nether-portal-overworld
export function build_nether_portal_overworld(bot: CustomBot){
    // implementation
    let botpos = bot.bot.entity.position
    bot.memorize_structure("nether_portal_overworld", [botpos.x, botpos.y, botpos.z])
}

// action build-nether-portal-nether
export function build_nether_portal_nether(bot: CustomBot){
    // implementation
    let botpos = bot.bot.entity.position
    bot.memorize_structure("nether_portal_nether", [botpos.x, botpos.y, botpos.z])
}

// action build-lit-end-portal
export function build_lit_end_portal(bot: CustomBot){
    // implementation
    let botpos = bot.bot.entity.position
    bot.memorize_structure("nether_portal_nether", [botpos.x, botpos.y, botpos.z])
}

// action find-structure-in-dim(s: Structure, dim: Dim)
export function find_structure_in_dim(bot: CustomBot, structure: string, dim: string){
    // implementation
    let botpos = bot.bot.entity.position
    bot.memorize_structure(structure, [botpos.x, botpos.y, botpos.z])
}


// ITEM

// action pickup-item(item: Item)
export async function pickup_item(bot: CustomBot, item: string){
    await goto_item(bot.bot, short_name(item))
}

// action recipe_...(i0: Item, ...)
export async function recipe(bot: CustomBot, recipe_name: string, items: string[]){
    let rec = ACTION_RECIPE.get(recipe_name)
    if (rec === undefined || rec === null) {
        bot.bot.chat(`Recipe not implemented by mineflayer: ${recipe_name}`)
        return
    }
    bot.bot.chat(`Crafting recipe ${recipe_name} requires: ${rec.requiresTable ? "crafting table" : "no crafting table"}`)
    if (rec.requiresTable) {
        let crafting_table = look_at_found_block(bot, "b_crafting_table")
        bot.bot.craft(rec as any, 1, crafting_table)
    } else {
        bot.bot.craft(rec as any, 1, null)
    }
}

// ===============================
export class TaskCall {
    task_name: string;
    args: string[];

    constructor(task_name: string, args: string[]) {
        this.task_name = task_name;
        this.args = args;
    }

    to_string(): string {
        return `${this.task_name}(${this.args.join(", ")})`
    }

    static from_string(s: string): TaskCall {
        const [task_name, ...args] = s.trim().split("(");
        return new TaskCall(task_name, args[0].slice(0, -1).split(", "));
    }
}

// export const TASK_CALL_FUNCTION
export async function run_task_call(bot: CustomBot, task_call: TaskCall){
    bot.bot.chat(`Running task: ${task_call.to_string()}`)
    switch(task_call.task_name) {
        case "dono":
            dono(bot);
            break;
        case "mine-block-directly":
            await mine_block_directly(bot, task_call.args[0], task_call.args[1], task_call.args[2]);
            break;
        case "reap-block":
            reap_block(bot, task_call.args[0], task_call.args[1], task_call.args[2]);
            break;
        case "place-block":
            await place_block(bot, task_call.args[0], task_call.args[1]);
            break;
        case "find-block-in-dim":
            await find_block_in_dim(bot, task_call.args[0], task_call.args[1]);
            break;
        case "container-put":
            container_put(bot, task_call.args[0], task_call.args[1]);
            break;
        case "container-take":
            container_take(bot, task_call.args[0], task_call.args[1]);
            break;
        case "kill-entity-directly":
            await kill_entity_directly(bot, task_call.args[0]);
            break;
        case "kill-entity-directly-for-item":
            await kill_entity_directly_for_item(bot, task_call.args[0], task_call.args[1]);
            break;
        case "reap-entity":
            reap_entity(bot, task_call.args[0], task_call.args[1], task_call.args[2]);
            break;
        case "find-entity-in-dim":
            await find_entity_in_dim(bot, task_call.args[0], task_call.args[1]);
            break;
        case "enter-portal-dim":
            enter_portal_dim(bot, task_call.args[0], task_call.args[1]);
            break;
        case "goto-memorized-structure":
            goto_memorized_structure(bot, task_call.args[0]);
            break;
        case "build-nether-portal-overworld":
            build_nether_portal_overworld(bot);
            break;
        case "build-nether-portal-nether":
            build_nether_portal_nether(bot);
            break;
        case "build-lit-end-portal":
            build_lit_end_portal(bot);
            break;
        case "find-structure-in-dim":
            find_structure_in_dim(bot, task_call.args[0], task_call.args[1]);
            break;
        case "pickup-item":
            await pickup_item(bot, task_call.args[0]);
            break;
        default:
            if (!task_call.task_name.startsWith("recipe_")) {
                // console.error(`Unknown task: ${task_call.task_name}`);
                bot.bot.chat(`Unknown task: ${task_call.task_name}`);
                break;
            }
            await recipe(bot, task_call.task_name, task_call.args);
            break;
    }
}

const plan_header_pattern = /^#[ ]*([\w\d_-]+)[ ]*:[ ]*(.*)$/

export function import_plan(): {name: string; goal: string; calls: TaskCall[]} {
    let res = fs.readFileSync(plan_path, "utf-8").split("\n")
    let firstline = res[0]
    let match = firstline.match(plan_header_pattern)
    if (!match) {throw new Error("Invalid plan header")}
    let [_, plan_name, call] = match
    return {
        name: plan_name,
        goal: call,
        calls: res.slice(1).filter((line) => line.trim() !== "").map((line) => TaskCall.from_string(line))
    }
}