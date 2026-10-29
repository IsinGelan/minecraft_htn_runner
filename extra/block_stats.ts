
import fs from "fs"
import vec3 from "vec3"

import type {Bot} from "mineflayer"
import type { Block } from 'prismarine-block'

import { version_ymax, version_ymin, block_stats_path } from "../constants.ts"
import { biome_name } from "../helpers.ts"


// ===============================

export function chunk_likelihoods(bot: Bot, chunk_pos: [number, number]): { block_biome: Set<string>, block_layer: Set<string>, biomes: Set<string> } {
    let block_biome: Set<string> = new Set()
    let block_layer: Set<string> = new Set()
    let biomes: Set<string> = new Set()

    let [cx, cz] = chunk_pos

    function handle_block(b: Block, layer: string) {
        let bio = biome_name(b.biome.id)
        biomes.add(bio)
        block_biome.add(`${b.name},${bio}`)
        block_layer.add(`${b.name},${layer}`)
    }

    function handle_surface(cx: number, cz: number, surface_level: number) {
        for(let i = 1; i <= 8; i++) {
            let b = bot.blockAt(vec3(cx, surface_level + i, cz))!
            handle_block(b, "s+")
        }
        for(let i = 0; i < 8; i++) {
            let b = bot.blockAt(vec3(cx, surface_level - i, cz))!
            handle_block(b, "s-")
        }
    }

    // chunk corner
    let ccx = cx*16
    let ccz = cz*16
    for(let x = 0; x < 16; x ++) {
        for(let z = 0; z < 16; z ++) {
            let above_surface = true
            
            for(let y = version_ymax; y >= version_ymin; y--) {
                let b = bot.blockAt(vec3(ccx+x, y, ccz+z))!
                let layer = Math.floor(y / 8)
                handle_block(b, layer.toString())

                if (above_surface && b.boundingBox == "block") {
                    above_surface = false
                    handle_surface(ccx+x, ccz+z, y)
                }
            }
        }
    }
    return { block_biome, block_layer, biomes }
}



// ===============================
export function key_biome(key: string): string {
    // e.g. "lava,mountains" -> "mountains"
    return key.split(",")[1]
}

function prob_from_fraction(occurences: number, out_of: number): number {
    // TODO: add some smoothing to avoid 0 probabilities
    if (out_of == 0) return 0
    return occurences / out_of
}

export function load_block_probs() {
    if (!fs.existsSync(block_stats_path)) {
        console.warn(`Block statistics file ${block_stats_path} not found! All probabilities will be 0.`)
        return { block_biome_stat: new Map(), block_layer_stat: new Map() }
    }

    const raw_data = fs.readFileSync(block_stats_path, "utf-8")
    const obj = JSON.parse(raw_data)
    const biome_count: Map<string, number> = new Map(Object.entries(obj.biomes))

    // generate relative probabilities that the block is in a chunk of the biome
    const block_biome_stat = new Map(
        Object.entries(obj.block_biome_stat)
        .map(([k, v]) => [k, prob_from_fraction(Number(v), biome_count.get(key_biome(k as string)) ?? 0)])    
    )
    const block_layer_stat = new Map(
        Object.entries(obj.block_layer_stat)
        .map(([k, v]) => [k, prob_from_fraction(Number(v), biome_count.get(key_biome(k as string)) ?? 0)])    
    )

    return { block_biome_stat, block_layer_stat }
}