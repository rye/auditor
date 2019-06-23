import { ClaimAttempt } from "../requirement";
import { FromRule } from "../rule";
import { Result } from "./interface";

export class FromResult implements Result {
	readonly rule: FromRule;
	readonly successful_claims: ReadonlyArray<ClaimAttempt>;
	readonly failed_claims: ReadonlyArray<ClaimAttempt>;
	readonly success: boolean;

	constructor(args: {
		readonly rule: FromRule;
		readonly successful_claims: ReadonlyArray<ClaimAttempt>;
		readonly failed_claims: ReadonlyArray<ClaimAttempt>;
		readonly success: boolean;
	}) {
		let { rule, successful_claims, failed_claims, success } = args;
		this.rule = rule;
		this.successful_claims = successful_claims;
		this.failed_claims = failed_claims;
		this.success = success;
	}

	claims() {
		return this.successful_claims;
	}

	state(): "result" {
		return "result";
	}

	ok(): boolean {
		return this.success;
	}

	rank() {
		// TODO: fix this calculation so that it properly handles #154647's audit
		return Math.min(
			this.successful_claims.length + this.failed_claims.length,
			this.rule.action ? (this.rule.action.get_max_value() as number) : 0,
		);
	}
}
