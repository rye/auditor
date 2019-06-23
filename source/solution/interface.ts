import { Rule } from "../rule";
import { RequirementContext, ClaimAttempt } from "../requirement";

export interface Solution {
	state(): "solution";
	claims(): ReadonlyArray<ClaimAttempt>;
	rank(): 0;
	ok(): boolean;
	audit(_: { ctx: RequirementContext; path: (string | number)[] }): any;
}
