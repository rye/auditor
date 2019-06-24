import { RequirementContext, ClaimAttempt } from "../requirement";
import { Result } from "../result";

export interface Solution {
	state(): "solution";
	claims(): ReadonlyArray<ClaimAttempt>;
	rank(): 0;
	ok(): boolean;
	audit(_: { ctx: RequirementContext; path: (string | number)[] }): Result;
}
