
import type { Bot } from "mineflayer"
import mf_pathfinder from "mineflayer-pathfinder"
const { GoalNearXZ } = mf_pathfinder.goals
import { Movements } from 'mineflayer-pathfinder'

import { distance2, vec3_to_xz } from "../helpers.ts"
import { replan_distance, section_length, reached_distance } from "../constants.ts"
import { Task } from "./task_handler.ts"
import type { TaskHandler } from "./task_handler.ts"

type UpdateAction = "init" | "keep_going" | "new_goal" | "new_section_goal" | "recompute_section_goal" | "done"


export class TravelPlanner extends Task {
    public bot: Bot

    private current_section_goal: [number, number] | null
    private current_goal: [number, number] | null
    private next_goal_callback: (() => [number, number]) | null
    private goal_reached_callback: (() => void) | null

    private previous_action: UpdateAction
    
    constructor(bot: Bot, handler: TaskHandler, info: boolean = false) {
        super(bot, handler, info)
        this.bot = bot

        this.current_goal = null
        this.current_section_goal = null
        this.next_goal_callback = null
        this.goal_reached_callback = null

        this.previous_action = "init"
        this.chat_info = false
    }

    async start() {
        this.set_recurrent_interval(1)
    }

    async recurrent() {
        let action = this.check_completion()
        if (action == "keep_going") {
            this.print_info()
        }
        else if (action == "done" && this.previous_action != "done") {
            // the moment the goal was reached
            // console.log("goal reached!")
            // this.goal_reached_callback?.()
            // this.clear_goal_reached_callback()
        }
        else if (action == "done") {}
        else if (action == "new_goal") {
            this.log("I need to calculate a new goal!")
            this.new_goal()
        }
        else if (action == "new_section_goal" || action == "recompute_section_goal") {
            this.log("I need to calculate a new section goal!")
            this.log(`I am ${this.get_dist_to_goal()?.toFixed(2)} from my goal!`)
            this.new_section_goal()
        }

        this.previous_action = action
    }
    
    // ---------------------------
    private check_completion (): UpdateAction {
        if (!this.current_goal) {
            this.current_section_goal = null
            return this.next_goal_callback ? "new_goal" : "done"
        }

        let bpos_2d = vec3_to_xz(this.bot.entity.position)
        let goal_dist = distance2(bpos_2d, this.current_goal)
        if (goal_dist <= reached_distance) {
            this.reach_goal()
            return this.next_goal_callback ? "new_goal" : "done"
        }

        if (!this.current_section_goal) {
            // somehow there is a goal but no section goal
            return "recompute_section_goal"
        }

        let subgoal_dist = distance2(bpos_2d, this.current_section_goal)
        if (subgoal_dist <= replan_distance) {
            this.current_section_goal = null
            return "new_section_goal"
        }

        return "keep_going";
    }


    private new_goal() {
        if (!this.next_goal_callback) return;
        this.current_goal = this.next_goal_callback()
        this.new_section_goal()
    }
    private new_section_goal() {
        if (!this.current_goal) {
            console.error("I got no goal!")
            return;
        };
        let bpos_2d = vec3_to_xz(this.bot.entity.position)
        let rel_goal_vec: [number, number] = [this.current_goal[0] - bpos_2d[0], this.current_goal[1] - bpos_2d[1]]
        let rel_goal_dist = distance2([0, 0], rel_goal_vec)
        if (rel_goal_dist < section_length) {
            this.log("My section goal is so close, it's my final goal!")
            this.set_section_goal(this.current_goal)
        } else {
            let scale = section_length / rel_goal_dist
            let section_vec = [rel_goal_vec[0] * scale, rel_goal_vec[1] * scale]
            let section_goal: [number, number] = [bpos_2d[0] + section_vec[0], bpos_2d[1] + section_vec[1]]
            this.set_section_goal(section_goal)
        }
    }
    private set_section_goal(section_goal: [number, number]) {
        this.current_section_goal = section_goal
        this.bot.pathfinder.setGoal(new GoalNearXZ(section_goal[0], section_goal[1], reached_distance - 1))
    }


    private reach_goal() {
        this.log("I reached my goal!")
        // this.log(`goal_reached_callback: ${this.goal_reached_callback}`)
        this.clear_goal()
        this.goal_reached_callback?.()
    }

    print_info() {
        if (!this.info) return;
        let pos = this.bot.entity.position
        let dist = distance2([pos.x, pos.z], this.current_section_goal!)
        this.log(`I am ${dist.toFixed(2)} from my section goal!`)
    }

    // Public area ---------------
    get_current_goal() {return this.current_goal}
    get_current_section_goal() {return this.current_section_goal}

    get_dist_to_goal(): number | null{
        if (!this.current_goal) return null;
        let pos = this.bot.entity.position
        return distance2([pos.x, pos.z], this.current_goal)
    }

    set_goal(goal: [number, number]) {
        console.log(`TravelPlanner: setting goal to [${goal[0]}, ${goal[1]}]`)
        console.log(`  goal pre:      ${this.current_goal}`)
        console.log(`  sec goal pre:  ${this.current_section_goal}`)
        this.clear_goal()
        this.current_goal = goal
        let action = this.check_completion()
        console.log(`  current cb:    ${this.goal_reached_callback}`)
        console.log(`  goal post:     ${this.current_goal}`)
        console.log(`  sec goal post: ${this.current_section_goal}`)
        console.log(`  action:        ${action}`)
    }
    set_path_routine(next_goal_callback: () => [number, number]) {
        this.clear_goal()
        this.next_goal_callback = next_goal_callback
        this.current_goal = this.next_goal_callback()
    }
    set_goal_reached_callback(callback: () => void) {
        // when a goal is set that is already reached:
        // If the travel planner is supposed to call this callback in this case,
        // it shall be set before the goal.
        this.goal_reached_callback = callback
    }
    clear_goal_reached_callback() {
        this.goal_reached_callback = null
    }

    clear_goal() {
        this.current_goal = null
        this.current_section_goal = null
        this.next_goal_callback = null
        this.bot.pathfinder.setGoal(null)
    }
}