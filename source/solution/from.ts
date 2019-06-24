import { FromRule } from "../rule";
import { Result, FromResult } from "../result";
import { RequirementContext } from "../requirement";
import { Solution } from "./interface";
import { logger } from "../logging";
import { Decimal } from "decimal.js";

import { CourseInstance, Term } from "../data";

export type FromOutput =
	| readonly CourseInstance[]
	| readonly Term[]
	| readonly Decimal[]
	| readonly number[];

export class FromSolution implements Solution {
	readonly output: FromOutput;
	readonly rule: FromRule;

	constructor({ rule, output }: { rule: FromRule; output: FromOutput }) {
		this.rule = rule;
		this.output = output;
	}

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

	stored() {
		return this.output;
	}

	audit({ ctx, path }: { ctx: RequirementContext; path: string[] }): Result {
		path = [...path, ".of"];

		if (this.rule.source.mode == "student") {
			return this.audit_when_student({ ctx, path });
		}
		if (this.rule.source.mode == "saves") {
			throw new Error("from:save not yet implemented");
			// return this.audit_when_saves({ ctx, path });
		}
		if (this.rule.source.mode == "requirements") {
			throw new Error("from:requirements not yet implemented");
			// return this.audit_when_reqs({ ctx, path });
		}

		throw new TypeError(`unknown "from" type "${this.rule.source.mode}"`);
	}

	isCourseOutput(items: FromOutput): items is readonly CourseInstance[] {
		return items[0] instanceof CourseInstance;
	}

	isDecimalOutput(items: FromOutput): items is readonly Decimal[] {
		return items[0] instanceof Decimal;
	}

	isTermOutput(items: FromOutput): items is readonly Term[] {
		return items[0] instanceof Term;
	}

	isNumberOutput(items: FromOutput): items is readonly number[] {
		return Number.isFinite(items[0] as number);
	}

	audit_when_student(args: {
		ctx: RequirementContext;
		path: string[];
	}): Result {
		let { ctx, path } = args;
		let successful_claims = [];
		let failed_claims = [];

		if (!this.rule.action) {
			throw new Error(
				"`action` should not be none here; otherwise this given-rule has nothing to do",
			);
		}

		if (!this.rule.where) {
			throw new Error(
				"`where` should not be none here; otherwise this given-rule has nothing to do",
			);
		}

		if (!this.isCourseOutput(this.output)) {
			throw new Error("expected to operate on courses");
		}

		for (let course of this.output) {
			let claim = ctx.make_claim({
				crsid: course.shorthand,
				course: course,
				path: path,
				clause: this.rule.where,
			});

			if (claim.failed()) {
				logger.debug(
					`course "${course}" exists, but has already been claimed by ${claim.conflict_with}`,
					{ path },
				);
				failed_claims.push(claim);
			} else {
				logger.debug(`course "${course}" exists, and is available'`, { path });
				successful_claims.push(claim);
			}
		}

		let may_possibly_succeed = this.rule.action.apply(this.output.length);

		if (may_possibly_succeed) {
			logger.debug(`{path} from-rule '${this.rule}' might possibly succeed`);
		} else {
			logger.debug(`{path} from-rule '${this.rule}' did not succeed`);
		}

		return new FromResult({
			rule: this.rule,
			successful_claims: successful_claims,
			failed_claims: failed_claims,
			success: may_possibly_succeed && failed_claims.length == 0,
		});
	}
}
