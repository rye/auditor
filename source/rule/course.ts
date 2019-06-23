import { logger } from "../logging";
import assert from "assert";

import { CourseSolution, Solution } from "../solution";
import { RequirementContext } from "../requirement";
import { CourseInstance } from "../data";

import { Rule } from "./interface";

export class CourseRule implements Rule {
	readonly course: string;
	readonly hidden: boolean;
	readonly grade: string | null;
	readonly allow_claimed: boolean;

	constructor(args: {
		course: string;
		hidden: boolean;
		grade: string;
		allow_claimed: boolean;
	}) {
		let { course, hidden, grade, allow_claimed } = args;
		this.course = course;
		this.hidden = hidden;
		this.grade = grade;
		this.allow_claimed = allow_claimed;
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
		if ("course" in data) {
			return true;
		}
		return false;
	}

	static load(data: any): CourseRule {
		return new CourseRule({
			course: data["course"],
			hidden: data.hidden || false,
			grade: data.grade || null,
			allow_claimed: data["including claimed"] || false,
		});
	}

	private singleDeptRegex = /[A-Z]{3,5} [0-9]{3}/;
	private multiDeptRegex = /[A-Z]{2}\/[A-Z]{2} [0-9]{3}/;
	private interDeptRegex = /(IS|ID) [0-9]{3}/;
	validate({ ctx }: { ctx: RequirementContext }) {
		let method_a = this.singleDeptRegex.test(this.course);
		let method_b = this.multiDeptRegex.test(this.course);
		let method_c = this.interDeptRegex.test(this.course);

		assert(
			method_a || method_b || method_c,
			`${this.course}, ${method_a}, ${method_b}, ${method_c}`,
		);
	}

	*solutions(args: {
		ctx: RequirementContext;
		path: string[];
	}): IterableIterator<Solution> {
		let { ctx, path } = args;
		logger.debug(`${path} reference to course "${this.course}"`);

		yield new CourseSolution({ course: this.course, rule: this });
	}

	estimate({ ctx }: { ctx: RequirementContext }) {
		return 1;
	}

	mc_applies_same(other: any): boolean {
		// """Checks if this clause applies to the same items as the other clause,
		// when used as part of a multicountable ruleset."""

		if (!(other instanceof CourseRule)) {
			return false;
		}

		return this.course == other.course;
	}

	applies_to(other: CourseInstance): boolean {
		return other.shorthand == this.course || other.identity == this.course;
	}
}
