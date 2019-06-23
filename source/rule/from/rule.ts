import { FromInput } from "./source";
import { Assertion, loadAssertion } from "./assertion";
import { LimitSet } from "../../limit";
import { Clause, loadClause } from "../../clause";
import { FromSolution } from "../../solution";
import { RequirementContext } from "../../requirement";
import { Rule } from "../interface";
import { logger } from "../../logging";
import assert from "assert";
import { enumerate } from "../../lib";
import { CourseInstance } from "../../data";

export class FromRule implements Rule {
	readonly source: FromInput;
	readonly action: null | Assertion = null;
	readonly limit: LimitSet;
	readonly where: null | Clause = null;

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
		if ("from" in data) {
			return true;
		}
		return false;
	}

	constructor(data: any) {
		let where = data.where;
		if (where) {
			this.where = loadClause(where);
		}

		this.limit = new LimitSet(data.limit || []);

		if ("assert" in data) {
			this.action = loadAssertion(data["assert"]);
		}

		this.source = new FromInput(data.from);
	}

	estimate({ ctx }: { ctx: RequirementContext }) {
		return 0;
	}

	validate({ ctx }: { ctx: RequirementContext }) {
		this.source.validate({ ctx });
		if (this.action) {
			this.action.validate({ ctx });
		}
	}

	*solutions_when_student({
		ctx,
		path,
	}: {
		ctx: RequirementContext;
		path: string[];
	}): IterableIterator<readonly CourseInstance[]> {
		let data;
		if (this.source.itemtype == "courses") {
			data = ctx.transcript;

			if (this.source.repeat_mode == "first") {
				let filtered_courses = [];
				let course_identities = new Set();
				for (let course of data) {
					if (!course_identities.has(course.identity)) {
						filtered_courses.push(course);
					}
				}
				data = filtered_courses;
			}
		} else {
			throw new TypeError(`${this.source.itemtype} not yet implemented`);
		}

		yield data;
	}

	*solutions_when_saves({
		ctx,
		path,
	}: {
		ctx: RequirementContext;
		path: string[];
	}): IterableIterator<readonly CourseInstance[]> {
		let saves = this.source.saves.map(s => {
			let save = ctx.save_rules.get(s);
			if (!save) {
				throw new Error(`could not find ${save}`);
			}
			return save.solutions({ ctx, path });
		});

		for (let p of product(...saves)) {
			yield Array.from(new Set(p.flatMap(save_result => save_result.stored())));
		}
	}

	*solutions_when_reqs({
		ctx,
		path,
	}: {
		ctx: RequirementContext;
		path: string[];
	}): IterableIterator<readonly CourseInstance[]> {
		let reqs = this.source.requirements.map(r => {
			let req = ctx.requirements.get(r);
			if (!req) {
				throw new Error(`could not find ${req}`);
			}
			return req.solutions({ ctx, path });
		});

		for (let p of product(...reqs)) {
			yield Array.from(new Set(p.flatMap(req_result => req_result.matched())));
		}
	}

	*solutions({
		ctx,
		path,
	}: {
		ctx: RequirementContext;
		path: string[];
	}): IterableIterator<FromSolution> {
		path = [...path, ".from"];
		logger.debug(path);

		let iterable;
		if (this.source.mode == "student") {
			iterable = this.solutions_when_student({ ctx, path });
		} else if (this.source.mode == "saves") {
			iterable = this.solutions_when_saves({ ctx, path });
		} else if (this.source.mode == "requirements") {
			iterable = this.solutions_when_reqs({ ctx, path });
		} else {
			throw new TypeError(`unknown "from" type "${this.source.mode}"`);
		}

		assert(this.action != null);

		let did_iter = false;
		for (let data of iterable) {
			if (this.where) {
				let where = this.where;
				logger.debug(`fromrule/filter/clause: ${this.where.toString()}`);
				if (data.length) {
					for (let [i, c] of enumerate(data)) {
						logger.debug(`fromrule/filter/before/${i}: ${c}`);
					}
				} else {
					logger.debug(`fromrule/filter/before: []`);
				}

				data = data.filter(c => c.apply_clause(where));

				if (data.length) {
					for (let [i, c] of enumerate(data)) {
						logger.debug(`fromrule/filter/after/${i}: ${c}`);
					}
				} else {
					logger.debug(`fromrule/filter/after: []`);
				}
			}

			for (let course_set of this.limit.limited_transcripts(data)) {
				if (this.action) {
					for (let n of this.action.range({ items: course_set })) {
						for (let combo of combinations(course_set, n)) {
							logger.debug(
								`fromrule/combo/size=${n} of ${
									course_set.length
								} :: ${combo.map(String)}`,
							);
							did_iter = true;
							yield new FromSolution({ output: combo, rule: this });
						}
					}
				}
				// # also yield one with the entire set of courses
				yield new FromSolution({ output: course_set, rule: this });
			}
		}

		if (!did_iter) {
			// # be sure we always yield something
			logger.info("did not yield anything; yielding empty collection");
			yield new FromSolution({ output: [], rule: this });
		}
	}
}
