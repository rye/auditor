import { CountRule, Rule } from "../rule";
import { Result, CountResult } from "../result";
import { RequirementContext } from "../requirement";
import { Solution } from "./interface";
import { enumerate } from "../lib";

export class CountSolution implements Solution {
	readonly count: number;
	readonly items: ReadonlyArray<Solution | Rule>;

	state(): "solution" {
		return "solution";
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

	constructor(args: {
		rule: CountRule;
		items: ReadonlyArray<Solution | Rule>;
	}) {
		this.count = args.rule.count;
		this.items = args.items;
	}

	audit({ ctx, path }: { ctx: RequirementContext; path: string[] }): Result {
		path = [...path, ".of"];

		let results = [...enumerate(this.items)].map(([i, r]) =>
			this.isSolution(r) ? r.audit({ ctx, path: [...path, i] }) : r,
		);

		// # print(this.items)

		return new CountResult({ count: this.count, items: results });
	}

	isSolution(r: Solution | Rule): r is Solution {
		return r.state() === "solution";
	}
}
