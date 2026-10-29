
import type { Vec3 } from "vec3"
import vec3 from "vec3"
import {unloaded_biome_id, unloaded_biome_name, version, version_sealevel, version_ymax, version_ymin} from "./constants.ts"

import type { Bot } from "mineflayer";

import mcd from "minecraft-data"
const mcData = mcd(version)

// ===============================
export function argmin<T>(arr: T[], score: (item: T) => number): T | undefined {
    if (arr.length === 0) return undefined;

    return arr.reduce((best, item) =>
        score(item) < score(best) ? item : best
    );
}

export function argmax<T>(arr: T[], score: (item: T) => number): T | undefined {
    if (arr.length === 0) return undefined;

    return arr.reduce((best, item) =>
        score(item) > score(best) ? item : best
    );
}


// ===============================
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
export function to_polar(pos: [number, number]): [number, number] {
    let [x, z] = pos
    let r = Math.sqrt(x*x + z*z)
    let theta = Math.atan2(z, x)
    return [r, theta]
}

export function to_cartesian(pos: [number, number]): [number, number] {
    let [r, theta] = pos
    let x = r * Math.cos(theta)
    let z = r * Math.sin(theta)
    return [x, z]
}

export function distance2(pos1: [number, number], pos2: [number, number]): number {
    let [x1, z1] = pos1
    let [x2, z2] = pos2
    return Math.sqrt((x1-x2)**2 + (z1-z2)**2)
}

export function vec3_to_xz(pos: Vec3): [number, number] {
    return [pos.x, pos.z]
}

export function random_direction(): number {
    return Math.random() * 2 * Math.PI
}

// ===============================
export function chunk_at(pos: Vec3): [number, number] {
    let chunk_x = Math.floor(pos.x / 16)
    let chunk_z = Math.floor(pos.z / 16)
    return [chunk_x, chunk_z]
}

export function chunk_center(chunk_pos: [number, number]): [number, number] {
    let [chunk_x, chunk_z] = chunk_pos
    let center_x = chunk_x * 16 + 8
    let center_z = chunk_z * 16 + 8
    return [center_x, center_z]
}

// ===============================
export function sort_object<T>(obj: Record<string, T>) {
    return Object.fromEntries(
        Object.entries(obj).sort(([a], [b]) => a.localeCompare(b))
    );
}

// ===============================
export function biome_name(id: number){
    if (id === unloaded_biome_id) return unloaded_biome_name;
    return mcData.biomes[id].name
}

export function biome_display_name(id: number){
    if (id === unloaded_biome_id) return unloaded_biome_name;
    return mcData.biomes[id].displayName
}

export function highest_collidable_blockpos(bot: Bot, pos: [number, number]): number {
    for(let y = version_ymax; y >= version_ymin; y--) {
        const block = bot.blockAt(vec3(pos[0], y, pos[1]))
        
        if(block && block.boundingBox == "block") {
            return y
        }
    }
    return -1
}

export function chunk_biome(bot: Bot, chunk_pos: [number, number]): number {
    // may return null if chunk not loaded, e.g if it's unloaded immediately
    const [chunk_x, chunk_z] = chunk_pos
    // only checks at (8,8)
    const middle_block = bot.blockAt(vec3(chunk_x * 16 + 8, version_sealevel, chunk_z * 16 + 8))
    if (!middle_block) return unloaded_biome_id;
    return middle_block.biome.id
}


// ===============================
export function block_id(bot: Bot, block_name: string): number {
    const block = bot.registry.blocksByName[block_name]!
    return block.id
}
