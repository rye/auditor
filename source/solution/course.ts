import { CourseRule } from "../rule";
import { CourseResult, Result } from "../result";
import { RequirementContext } from "../requirement";
import { Solution } from "./interface";
import { logger } from "../logging";

export class CourseSolution implements Solution {
	readonly type = "course";
	readonly course: string;
	readonly rule: CourseRule;

	constructor({ course, rule }: { course: string; rule: CourseRule }) {
		this.course = course;
		this.rule = rule;
	}

	toJSON() {
		return {
			...this.rule.toJSON(),
			type: "count",
			state: this.state(),
			status: "pending",
			rank: this.rank(),
			ok: this.ok(),
			claims: this.claims(),
		};
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

	audit({ ctx, path }: { ctx: RequirementContext; path: string[] }): Result {
		path = [...path, `$c->${this.course}`];

		let matched_course = ctx.find_course(this.course);
		if (!matched_course) {
			logger.debug(`course "${this.course}" does not exist in the transcript`, {
				path,
			});
			return new CourseResult({
				course: this.course,
				rule: this.rule,
				claim_attempt: null,
			});
		}

		let claim = ctx.make_claim({
			course: matched_course,
			crsid: matched_course.shorthand,
			path: path,
			clause: this.rule,
		});

		if (claim.failed()) {
			logger.debug(
				`course "${this.course}" exists, but has already been claimed by ${claim.conflict_with}`,
				{ path },
			);
			return new CourseResult({
				course: this.course,
				rule: this.rule,
				claim_attempt: claim,
			});
		}

		logger.debug(`course "${this.course}" exists, and has not been claimed`, {
			path,
		});

		return new CourseResult({
			course: this.course,
			rule: this.rule,
			claim_attempt: claim,
		});
	}
}
