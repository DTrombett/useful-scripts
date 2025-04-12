import { once } from "node:events";
import { stdin, stdout } from "node:process";

export const ask = async (question: string): Promise<string> => {
	stdin.resume();
	stdin.setRawMode(false);
	stdout.write(question);
	const [answer] = await once(stdin, "data");
	stdin.setRawMode(true);
	stdin.pause();
	return answer.toString().trim();
};
