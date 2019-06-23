import { ClaimAttempt } from "../requirement";

export interface Result {
	state(): "result";
	claims(): readonly ClaimAttempt[];
	ok(): boolean;
	rank(): number;
}
