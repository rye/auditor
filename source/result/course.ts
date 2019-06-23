import { Result } from "./interface";
import { CourseRule } from "../rule";
import { ClaimAttempt } from "../requirement";

export class CourseResult implements Result {
	readonly course: string;
	readonly rule: CourseRule;
	readonly claim_attempt: null | ClaimAttempt = null;

	constructor(args: {
		readonly course: string;
		readonly rule: CourseRule;
		readonly claim_attempt?: null | ClaimAttempt;
	}) {
		this.course = args.course;
		this.rule = args.rule;
		this.claim_attempt = args.claim_attempt || null;
	}

	claims() {
		if (this.claim_attempt) {
			return [this.claim_attempt];
		} else {
			return [];
		}
	}

	state() {
		return "result";
	}

	ok(): boolean {
		return this.claim_attempt != null && this.claim_attempt.failed() === false;
	}

	rank() {
		return this.ok() ? 1 : 0;
	}
}
