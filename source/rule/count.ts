import { logger } from "../logging";
import assert from "assert";
import { CountSolution, Solution } from "../solution";
import { RequirementContext } from "../requirement";
import { CourseRule } from "./course";
import { Rule } from "./interface";
import { loadRule } from "./index";
import { range, enumerate, difference } from "../lib";
import { sortBy } from "lodash";
import cartesian from "../vendor/cartesian";
import combinations from "../vendor/combinations";

export class CountRule implements Rule {
	readonly type = "count";
	readonly count: number;
	readonly items: ReadonlyArray<Rule>;

	constructor({ count, items }: { count: number; items: ReadonlyArray<Rule> }) {
		this.count = count;
		this.items = items;
	}

	toJSON() {
		return {
			type: "count",
			state: this.state(),
			count: this.count,
			items: this.items,
			status: this.ok() ? "pass" : "problem",
			rank: this.rank(),
			ok: this.ok(),
			claims: this.claims(),
		};
	}

	state(): "rule" {
		return "rule";
	}

	claims() {
		return [];
	}

	rank(): 0 {
		return 0;
	}

	ok() {
		return false;
	}

	static can_load(data: any): boolean {
		if ("count" in data && "of" in data) {
			return true;
		}
		if ("all" in data) {
			return true;
		}
		if ("any" in data) {
			return true;
		}
		if ("both" in data) {
			return true;
		}
		if ("either" in data) {
			return true;
		}
		return false;
	}

	static load(data: any): CountRule {
		let items, count;
		if ("all" in data) {
			items = data["all"];
			count = items.length;
		} else if ("any" in data) {
			items = data["any"];
			count = 1;
		} else if ("both" in data) {
			items = data["both"];
			count = 2;
			if (items.length != 2) {
				throw new TypeError(
					`expected two items in both; found ${items.length} items`,
				);
			}
		} else if ("either" in data) {
			items = data["either"];
			count = 1;
			if (items.length != 2) {
				throw new TypeError(
					`expected two items in both; found ${items.length} items`,
				);
			}
		} else {
			items = data["of"];
			if (data["count"] == "all") {
				count = items.length;
			} else if (data["count"] == "any") {
				count = 1;
			} else {
				count = parseInt(data["count"], 10);
			}
		}

		return new CountRule({ count, items: items.map(loadRule) });
	}

	validate({ ctx }: { ctx: RequirementContext }) {
		assert(
			Number.isSafeInteger(this.count),
			`${this.count} should be an integer`,
		);
		assert(this.count >= 0);
		assert(this.count <= this.items.length);

		for (let rule of this.items) {
			rule.validate({ ctx });
		}
	}

	*solutions(args: {
		ctx: RequirementContext;
		path: string[];
	}): IterableIterator<Solution> {
		let { ctx, path } = args;
		path = [...path, ".of"];
		logger.debug(path);

		let did_iter = false;

		let lo = this.count;
		let hi = this.items.length + 1;

		let potentials = this.items.filter(
			r => !(r instanceof CourseRule) || ctx.find_course(r.course),
		);
		let pot_hi = potentials.length + 1;

		assert(lo < hi);

		let size = this.items.length;

		let all_children = new Set(this.items);

		let item_indices = new Map(this.items.map((r, i) => [r, i]));

		for (let r of range(lo, hi)) {
			logger.debug(`${path} ${lo}..<${hi}, r=${r}, max=${potentials.length}`);

			for (let [combo_i, combo] of enumerate(combinations(this.items, r))) {
				let selected_children: Set<Rule> = new Set(combo);

				let other_children = sortBy(
					Array.from(difference(all_children, selected_children)),
					r => item_indices.get(r),
				);

				let selected_original_indices = new Map();
				for (let [idx, item] of enumerate(this.items)) {
					if (!other_children.includes(item)) {
						selected_original_indices.set(item, idx);
					}
				}

				logger.debug(
					`${path} combo=${combo_i}: generating product(*solutions)`,
				);
				did_iter = true;

				let solutions = combo.map(rule => rule.solutions({ ctx, path }));

				// # print("combo", combo)

				for (let solutionset of cartesian(...solutions)) {
					// # print("solset", solutionset)

					// # todo: clean up this block
					let req_ident_map: Map<string, number> = new Map();
					let do_not_yield = false;

					let cleaned: Solution[] = [];

					for (let rulesol of solutionset) {
						let solution = rulesol;

						if (Array.isArray(rulesol)) {
							let [identity, sol]: [
								[string, number],
								Solution,
							] = rulesol as any;

							let [req_ident, req_idx] = identity;

							if (!req_ident_map.has(req_ident)) {
								req_ident_map.set(req_ident, req_idx);
							}

							if (req_ident_map.get(req_ident) != req_idx) {
								do_not_yield = true;
								break;
							}

							solution = sol;
						}

						cleaned.push(solution);
					}

					if (do_not_yield) {
						continue;
					}
					// # end clean-up-this-block

					let solset = [...cleaned, ...other_children];

					// # ordered_solset = sorted(
					// #     solset,
					// #     key=lambda r: item_indices[r]
					// #     # if r in item_indices
					// #     # else selected_original_indices[r],
					// # )

					yield new CountSolution({ rule: this, items: solset });
				}
			}
		}

		if (!did_iter) {
			// # ensure that we always yield something
			yield new CountSolution({ rule: this, items: this.items });
		}
	}

	estimate({ ctx }: { ctx: RequirementContext }) {
		let lo = this.count;
		let hi = this.items.length + 1;

		let estimates = this.items.map(rule => rule.estimate({ ctx }));
		let indices = this.items.map((_, i) => i);

		let count = 0;
		for (let r of range(lo, hi)) {
			for (let combo of combinations(indices, r)) {
				count += combo.map(i => estimates[i]).reduce((acc, n) => acc * n, 0);
			}
		}

		return count;
	}
}
