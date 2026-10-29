
import {version} from "../constants.ts"

// import { Vec3 } from "vec3"
import type { Block } from 'prismarine-block'
import type { Bot } from "mineflayer"
import mcd from "minecraft-data"
import type { Entity } from "prismarine-entity"
import { goals } from "mineflayer-pathfinder"
const mcData = mcd(version)

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
        (e) => e.id === entity_id && e.position.distanceTo(bot.entity.position) < 3
    )
    if (entity === null) {
        throw new Error(`Expected ${etype} not found within 3 blocks`)
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
            new goals.GoalNear( target.position.x, target.position.y, target.position.z, 1 ) )
        return true
    } catch (error) {
        console.error(`Could not reach ${itemName}:, ${error}`)
        return false
    }
}