
export const version = "1.16.5"

export const config_path = "config.json"
export const master_player_name = "Herr_Fifian"

export const version_ymax = 255
export const version_sealevel = 63
export const version_ymin = 0

export const unloaded_biome_id = 127 // biome id for unloaded chunks, e.g. due to immediate unload after load
export const unloaded_biome_name = "unloaded" // biome id for unloaded chunks, e.g. due to immediate unload after load

export const block_stats_path = "data/block_stats.json"
export const stat_tp_dist = 50
export const stat_tp_interval = 12 // s

export const section_length = 48    // blocks
export const replan_distance = 5    // blocks away from section goal to trigger computing a new section goal
export const reached_distance = 2   // blocks away from goal as to see it reached

export const half_score_distance = 200 // the distance at which a chunk right next to the player with half score is preferrable
export const wander_distance = 100 // how far the bot wanders before recalling the path planner for a new goal
export const prob_lower_threshold = 0.1 // the probability threshold below which a chunk is considered unpromising
export const look_for_block_distance = 16 // how far the bot looks for a block in the locate_in_chunk phase

export const plan_path = "plan.txt"