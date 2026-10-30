
import {version} from "../constants.ts"

import vec3, { Vec3 } from "vec3"
import type { Block } from 'prismarine-block'
import type { Bot } from "mineflayer"
import mcd from "minecraft-data"
import type { Entity } from "prismarine-entity"
import mf_pathfinder from "mineflayer-pathfinder"
const { GoalNear } = mf_pathfinder.goals
const mcData = mcd(version)

import { block_faces_towards_bot, closest_positions } from "../helpers.ts"

export function split_once(str: string, delimiter: string): [string, string] {
    const index = str.indexOf(delimiter);
    if (index === -1) {
        return [str, ''];
    }
    const firstPart = str.substring(0, index);
    const secondPart = str.substring(index + delimiter.length);
    return [firstPart, secondPart];
} 

// ===============================
export function planner_name_to_id(planner_name: string): number {
    let [prefix, name] = split_once(planner_name, "_")
    if (name === "") throw new Error(`Invalid planner name: ${planner_name}`) 
    switch(prefix){
        case "i":
            return name in mcData.itemsByName ? mcData.itemsByName[name].id : -1
        case "b":
            return name in mcData.blocksByName ? mcData.blocksByName[name].id : -1
        case "e":
            return name in mcData.entitiesByName ? mcData.entitiesByName[name].id : -1
        default:
            throw new Error(`Unknown prefix: ${prefix}`)
    }
}

export function short_name(planner_name: string): string {
    let [prefix, name] = split_once(planner_name, "_")
    if (!["i", "b", "e"].includes(prefix)) throw new Error(`Unknown prefix: ${prefix}`)
    if (name === "") throw new Error(`Invalid planner name: ${planner_name}`) 
    return name
}

export const id_to_planner_name = new Map<number, string>(
    Object.entries(mcData.itemsByName).map((name, id) => [id+1, `i_${name[0]}`])
)

// ===============================
export function look_at_found_block(bot: Bot, btype: string): Block {
    let block_id = planner_name_to_id(btype)
    let block = bot.findBlock({
        matching: block_id,
        maxDistance: 3,
    })
    if (block === null) {
        throw new Error(`Expected ${btype} not found within 3 blocks`)
    }
    bot.lookAt(block.position)
    return block
}

export function look_at_found_entity(bot: Bot, etype: string): Entity {
    let entity_id = planner_name_to_id(etype)
    let entity = bot.nearestEntity(
        (e) => e?.entityType === entity_id
    )
    // console.log(`Found entity: ${entity.entityType} ${entity?.name} at ${entity?.position}`)
    if (entity === null) {
        bot.chat(`Expected ${etype} ${entity_id} not found within 5 blocks`)
        return null
    }
    bot.lookAt(entity.position)
    return entity as Entity
}

export function cheat_give(bot: Bot, item_name: string, count: number) {
    let bare_name = split_once(item_name, "_")[1]
    bot.chat(`/give ${bot.username} minecraft:${bare_name} ${count}`)
}

export async function goto_item(bot: Bot, itemName: string, maxDistance = 16): Promise<boolean> {
    const target = bot.nearestEntity(entity => { if (entity.name !== 'item') return false
        const item = entity.getDroppedItem()
        if (!item || item.name !== itemName) return false
        return (entity.position.distanceTo(bot.entity.position) <= maxDistance)
    })
    if (!target) { return false }

    try {
        await bot.pathfinder.goto(
            new GoalNear( target.position.x, target.position.y, target.position.z, 1 ) )
        return true
    } catch (error) {
        console.error(`Could not reach ${itemName}:, ${error}`)
        return false
    }
}


export function* closest_placing_positions(bot: Bot): Generator<[Vec3, Vec3] | null> {
    // bot.chat("Finding closest placing positions...")
    const playerPos = bot.entity.position
    const playerX = Math.floor(playerPos.x)
    const playerY = Math.floor(playerPos.y)
    const playerZ = Math.floor(playerPos.z)

    for (let [x, y, z] of closest_positions([playerX, playerY, playerZ])) {
        console.log(`Checking position: ${x}, ${y}, ${z}`)
        if (Math.abs(playerY - y) > 3) break;
        let blockpos = vec3(x, y, z)
        if (!bot.canSeeBlock(bot.blockAt(blockpos))) continue;
        if (bot.blockAt(blockpos)?.boundingBox !== "block") continue;
        // let blockpos_between = block_in_front(bot, blockpos)
        // console.log(`Block in front: ${blockpos_between}`)
        for (let face of block_faces_towards_bot(bot, bot.blockAt(blockpos))) {
            let blockpos_between = blockpos.plus(face)
            if (bot.blockAt(blockpos_between)?.boundingBox === "block") {
                console.log(": solid in front"); continue
            };
            // console.log(`Found placing position: ${blockpos} with visible side ${face}`)
            yield [blockpos, face]
        }
        // check for entity in the way?
        // let visible_side = blockpos_between.minus(blockpos)
    }
    return null
}


export async function place_block_feedback(bot: Bot, blockpos: Vec3, visible_side: Vec3): Promise<boolean> {
    // let hand_number_before = bot.inventory.slots[bot.getEquipmentDestSlot("hand")]?.count || 0
    try {
        await bot.placeBlock(bot.blockAt(blockpos), visible_side)
    } catch (error) {
        console.log(`Failed to place block at ${blockpos}: ${error}`)
        return false
    }
    // bot.waitForTicks(10) // item number apparently updates after a few ticks, not immediately
    // let hand_number_after = bot.inventory.slots[bot.getEquipmentDestSlot("hand")]?.count || 0
    // bot.chat(`Hand count before: ${hand_number_before}, after: ${hand_number_after}`)
    // return hand_number_after < hand_number_before
    return bot.blockAt(blockpos)?.boundingBox === "block" // check if block is now there
}

// ===============================
