
import * as fs from 'fs';

import { version } from "../constants.ts"
import { id_to_planner_name, planner_name_to_id } from './action_helpers.ts';

import mcd from "minecraft-data"
const mcData = mcd(version)
import type { Recipe as MCRecipe, RecipeItem } from 'minecraft-data'
import prismarineRecipe from 'prismarine-recipe'
const { Recipe } = prismarineRecipe(mcData)


// ===============================
export const DOMAIN_FILE_JSON = 'domain.json'

// ===============================
class ValuedExpr {
    poly_id: string;
}
class Identifier extends ValuedExpr {
    name: string;
}
class IdentifierParam extends Identifier {
    poly_id = "IdentifierParam"
    name: string;
}
class IdentifierConst extends Identifier {
    poly_id = "IdentifierConst"
    name: string;
}

class Param {
    name: string;
    type: string;
}

class LogicalExpr {
    poly_id: string;
}

class FactExpr extends LogicalExpr {
    poly_id = "FactExpr";
    negated: boolean;
    predicate_name: string;
    args: ValuedExpr[];
}

class Action {
    poly_id = "Action";
    action_name: string;
    params: Param[];
    precondition: LogicalExpr[];
    postcondition: LogicalExpr[];
    annotation: string;
}

// ===============================
class Rec {
    result: RecipeItem;
    inShape: Array<Array<RecipeItem>>;
    outShape: Array<Array<RecipeItem>>;
    ingredients: Array<RecipeItem>;
    delta: Array<RecipeItem>;
    requiresTable: boolean;
}

function crafting_actions(actions: Action[]): Action[] {
    return actions.filter((action: Action) => action.action_name.startsWith("recipe_"));
}

function is_has_item_fact(cond: LogicalExpr): boolean {
    if (cond.poly_id !== "FactExpr") return false;
    let fact = cond as FactExpr;
    if (fact.negated) return false;
    if (fact.predicate_name !== "has_item") return false;
    let item_arg = fact.args[0] as IdentifierConst;
    if (item_arg.poly_id !== "IdentifierConst") return false;
    return true;
}

function contains_has_item_fact(exprs: LogicalExpr[], item_name: string): boolean {
    return exprs.some((cond: LogicalExpr) => {
        if (!is_has_item_fact(cond)) return false;
        let fact = cond as FactExpr;
        let item_arg = fact.args[0] as IdentifierConst;
        return item_arg.name === item_name;
    })
}

function crafting_action_uses_items(action: Action, item_names: string[]): boolean {
    return item_names.every(
        (item_name: string) => (!item_name) || contains_has_item_fact(action.precondition, item_name));
}
function crafting_action_produces_item(action: Action, item_name: string): boolean {
    return contains_has_item_fact(action.postcondition, item_name);
}

function crafting_action_result_item(action: Action): string {
    for (const cond of action.postcondition) {
        if (!is_has_item_fact(cond)) continue;

        let fact = cond as FactExpr;
        let item_arg = fact.args[0] as IdentifierConst;
        return item_arg.name;
    }
    return "";
}

export function recipe_ingredients(recipe: Rec): string[] {
    if (recipe.inShape) {
        return recipe.inShape
            .flat()
            .filter((item: RecipeItem) => item !== null)
            .map((item) => id_to_planner_name.get(item.id) ?? "")
        }
    return recipe.ingredients
        .map((item) => item.valueOf() as number)
        .map((id) => id_to_planner_name.get(id) ?? "")
}

// ===============================
let domain_str = fs.readFileSync(DOMAIN_FILE_JSON,'utf8');
let domain_obj = JSON.parse(domain_str);

let top_level_elements = domain_obj.top_level_elements
let actions = top_level_elements.filter(
    (e: any) => e.poly_id === "Action") as Action[];

let c_actions = crafting_actions(actions);
c_actions.filter((a) => crafting_action_uses_items(a, ["i_stick", "i_iron_ingot"])).forEach((action: Action) => {
    console.log(`Action: ${action.action_name}`)
})


export const ACTION_RECIPE = new Map<string, Rec | null>(
    c_actions.map((action: Action) => {
        const result = crafting_action_result_item(action);
        const res_id = planner_name_to_id(result);
        const recipes = Recipe.find(res_id, null);
        if (!recipes || recipes.length === 0)
            return [action.action_name, null];

        const matching_recipes = recipes.filter(
            (recipe: Rec) => {
            const ingredients = recipe_ingredients(recipe);
            return crafting_action_uses_items(action, ingredients);
        })
        
        return [
            action.action_name,
            matching_recipes.length > 0 ? matching_recipes[0] : null]
    })
)


// ACTION_RECIPE.forEach((recipe: Rec | null, action_name: string) => {
//     console.log(`Action: ${action_name}, Recipe: ${recipe}`)})