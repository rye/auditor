import assert from "assert";
import { logger } from "./logging";

import { FromRule } from "./rule";
import { RequirementContext } from "./requirement";
// import { FromSolution } from "./solution";

export class SaveRule {
	readonly innards: FromRule;
	readonly name: string;

	constructor(name: string, data: { [key: string]: any }) {
		this.name = name;
		this.innards = new FromRule(data);
	}

	validate({ ctx }: { ctx: RequirementContext }) {
		assert(this.name.trim() !== "");

		this.innards.validate({ ctx });
	}

	*solutions({ ctx, path }: { ctx: RequirementContext; path: string[] }) {
		path = [...path, `.save["${this.name}"]`];
		logger.debug("inside a saverule", { path });
		yield* this.innards.solutions({ ctx, path });
	}
}
