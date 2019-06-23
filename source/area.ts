import assert from "assert";
import { Limit } from "./limit";
import { loadClause, Clause } from "./clause";
import { CourseInstance } from "./data";
import { RequirementContext, Requirement } from "./requirement";

import { loggers } from "winston";
const logger = loggers.get("degreepath");

interface Rule {
	solutions(_: { ctx: RequirementContext; path: string[] }): any;
	validate(_: { ctx: RequirementContext }): void;
	estimate(_: { ctx: RequirementContext }): number;
}
class CourseRule implements Rule {
	constructor(data: any) {}
	validate() {}
	estimate({ ctx }: { ctx: RequirementContext }) {
		return 1;
	}
	solutions({ ctx, path }: { ctx: RequirementContext; path: string[] }): any {}
}
function loadRule(data: any): Rule {
	return new CourseRule(null);
}

interface Solution {
	audit({ ctx, path }: { ctx: any; path: (string | number)[] }): any;
}

class InvalidMulticountable extends TypeError {}

export class AreaOfStudy {
	readonly name: string;
	readonly kind: string;
	readonly degree: string;
	readonly catalog: string;

	readonly limit: Limit[];
	readonly result: Rule;
	readonly requirements: ReadonlyMap<string, Requirement>;

	readonly attributes: ReadonlyMap<string, string[]>;
	readonly multicountable: ReadonlyArray<Array<CourseRule | Clause>>;

	constructor(data: any) {
		assert(data.name != null);
		this.name = data.name;
		assert(data.kind != null);
		this.kind = data.kind;
		assert(data.degree != null);
		this.degree = data.degree;
		assert(data.catalog != null);
		this.catalog = data.catalog;

		let requirements = Object.entries(data.requirements || {}).map(
			([name, req]: [string, any]) =>
				[name, new Requirement(name, req)] as [string, Requirement],
		);
		this.requirements = new Map(requirements);

		assert(data.rule != null);
		this.result = loadRule(data.result);

		let limits: any[] = Array.isArray(data.limit) ? data.limit : [];
		this.limit = limits.map(l => new Limit(l));

		this.attributes = new Map(
			Object.entries((data.attributes || {}).courses || {}),
		);

		this.multicountable = ((data.attributes || {}).multicountable || []).map(
			(ruleset: any[]) => {
				return ruleset.map(clause => {
					if (clause.course) {
						return new CourseRule(clause);
					} else if (clause.attributes) {
						return loadClause(clause);
					}

					throw new InvalidMulticountable(
						`invalid multicountable ${JSON.stringify(clause)}`,
					);
				});
			},
		);
	}

	validate() {
		assert(typeof this.name === "string");
		assert(this.name.trim() !== "");

		assert(typeof this.kind === "string");
		assert(["degree", "major", "concentration"].includes(this.kind));

		assert(typeof this.catalog === "string");
		assert(this.catalog.trim() != "");

		if (this.kind !== "degree") {
			assert(typeof this.degree === "string");
			assert(this.degree.trim() != "");
			assert(this.degree in ["Bachelor of Arts", "Bachelor of Music"]);
		}

		let ctx = new RequirementContext({
			transcript: [],
			requirements: this.requirements,
			multicountable: this.multicountable,
		});

		this.result.validate({ ctx });
	}

	*solutions({ transcript }: { transcript: CourseInstance[] }) {
		let path = ["$root"];
		logger.debug("evaluating area.result", { path });

		// # TODO: generate alternate sizes of solution based on the courses subject to the limits
		// # for limited_transcript in

		let ctx = new RequirementContext({
			transcript,
			requirements: this.requirements,
			multicountable: this.multicountable,
		});

		let new_path = [...path, ".result"];
		for (let sol of this.result.solutions({ ctx, path: new_path })) {
			ctx.reset_claims();
			logger.info("generated new area solution", { sol });
			yield new AreaSolution({ solution: sol, area: this });
		}

		logger.debug("all solutions generated", { path });
	}

	estimate({ transcript }: { transcript: CourseInstance[] }) {
		let ctx = new RequirementContext({
			transcript,
			requirements: this.requirements,
			multicountable: this.multicountable,
		});

		return this.result.estimate({ ctx });
	}
}

export class AreaSolution {
	readonly solution: Solution;
	readonly area: AreaOfStudy;

	constructor({ solution, area }: { solution: Solution; area: AreaOfStudy }) {
		this.solution = solution;
		this.area = area;
	}

	audit({ transcript }: { transcript: CourseInstance[] }) {
		let path = ["$root"];
		logger.debug("auditing area.result", { path });

		let ctx = new RequirementContext({
			transcript,
			requirements: this.area.requirements,
			multicountable: this.area.multicountable,
		});

		let new_path = [...path, ".result"];

		return this.solution.audit({ ctx, path: new_path });
	}
}
