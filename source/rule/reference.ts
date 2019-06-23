// import itertools

import { loggers } from "winston";
const logger = loggers.get("degreepath");

import { CourseSolution } from "../solution";
import {
	RequirementContext,
	RequirementSolution,
	RequirementState,
} from "../requirement";
import { Rule } from "./interface";

class ReferenceRule implements Rule {
	readonly name: string;

	constructor(name: string) {
		this.name = name;
	}

	state() {
		return "rule";
	}

	claims() {
		return [];
	}

	rank() {
		return 0;
	}

	ok() {
		return false;
	}

	static can_load(data: any): boolean {
		if ("requirement" in data) {
			return true;
		}
		return false;
	}

	static load(data: any): ReferenceRule {
		return new ReferenceRule(data["requirement"]);
	}

	validate({ ctx }: { ctx: RequirementContext }) {
		let req = ctx.requirements.get(this.name);
		if (!req) {
			let reqs = Array.from(ctx.requirements.keys()).join(", ");
			throw new TypeError(
				`expected a requirement named '${this.name}', but did not find one [options: ${reqs}]`,
			);
		}

		req.validate({ ctx });
	}

	private init({ ctx, path }: { ctx: RequirementContext; path: string[] }) {
		let requirement = ctx.requirements.get(this.name);

		if (!requirement) {
			throw new Error("how is requirement not defined here");
		}

		let state = ctx.requirement_cache.get(requirement);

		if (!state) {
			state = new RequirementState({
				iterable: requirement.solutions({ ctx, path }),
			});
			ctx.requirement_cache.set(requirement, state);
		}

		return state;
	}

	estimate({ ctx }: { ctx: RequirementContext }) {
		return 0;

		let requirement = ctx.requirements.get(this.name);

		let state = this.init({ ctx: ctx, path: [] });

		// return state.estimate((ctx = ctx));
	}

	*solutions({ ctx, path }: { ctx: RequirementContext; path: string[] }) {
		let requirement = ctx.requirements.get(this.name);

		let state = this.init({ ctx, path });
		// # print("hi")
		// # ident = hash(requirement.name)
		// # ident = requirement.name

		yield* state.iter_solutions();
	}
}
