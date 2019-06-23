import { RequirementContext } from "../../requirement";
import assert from "assert";

export class FromInput {
	readonly mode: string;
	readonly itemtype: null | string = null;
	readonly requirements: ReadonlyArray<string> = [];
	readonly saves: ReadonlyArray<string> = [];
	readonly repeat_mode: null | "all" | "first" = null;

	constructor(data: any) {
		if ("student" in data) {
			this.mode = "student";
			this.itemtype = data["student"];
			this.repeat_mode = data.repeats || "all";
		} else if ("saves" in data) {
			this.mode = "saves";
			this.saves = data["saves"];
		} else if ("save" in data) {
			this.mode = "saves";
			this.saves = [data["save"]];
		} else if ("requirements" in data) {
			this.mode = "requirements";
			this.requirements = data["requirements"];
		} else if ("requirement" in data) {
			this.mode = "requirements";
			this.requirements = [data["requirement"]];
		} else if ("stored-values" in data) {
			this.mode = "stored-values";
			this.requirements = [data["stored-values"]];
		} else {
			throw new TypeError(
				`expected student, stored-values, saves, or requirements; got ${Object.keys(
					data,
				)}`,
			);
		}
	}

	validate({ ctx }: { ctx: RequirementContext }) {
		assert(typeof this.mode === "string");

		let saves = ctx.save_rules;
		let requirements = ctx.requirements;

		let dbg = `(when validating this=${this}, saves=${saves}, reqs=${requirements})`;

		if (this.mode == "requirements") {
			// # TODO: assert that the result type of all mentioned requirements is the same
			if (!this.requirements || !requirements) {
				throw new TypeError(
					"expected this.requirements and args.requirements to be lists",
				);
			}
			for (let name of this.requirements) {
				assert(typeof name === "string", `expected ${name} to be a string`);
				assert(
					ctx.requirements.has(name),
					`expected to find '${name}' once, but could not find it ${dbg}`,
				);
			}
		} else if (this.mode == "saves") {
			// # TODO: assert that the result type of all mentioned saves is the same
			if (!this.saves || !saves) {
				throw new TypeError("expected this.saves and args.saves to be lists");
			}
			for (let name of this.saves) {
				assert(typeof name === "string", `expected ${name} to be a string`);
				assert(
					ctx.save_rules.has(name),
					`expected to find '${name}' once, but could not find it ${dbg}`,
				);
			}
		} else if (this.mode == "student") {
			assert(
				["courses", "performances", "areas"].includes(this.itemtype as any),
			);
		} else {
			throw new TypeError(`unknown 'from' type ${this.mode}`);
		}
	}
}
