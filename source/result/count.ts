import { Result } from "./interface";
import { Rule } from "../rule";
import { sum } from "../lib";

export class CountResult implements Result {
	readonly type = "count";
	readonly count: number;
	readonly items: ReadonlyArray<Rule | Result>;

	constructor(args: {
		readonly count: number;
		readonly items: ReadonlyArray<Rule | Result>;
	}) {
		this.count = args.count;
		this.items = args.items;
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

	state(): "result" {
		return "result";
	}

	claims() {
		return this.items.flatMap(item => item.claims());
	}

	ok(): boolean {
		return sum(this.items.map(r => (r.ok() ? 1 : 0))) >= this.count;
	}

	rank() {
		return sum(this.items.map(r => r.rank()));
	}
}
