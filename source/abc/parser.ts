
import { ABC } from "./abc";


const parseCode = async (code: string): Promise<ABC.Document> => {
	const grammar = await import("./grammar.jison.js");
	const raw = grammar.parse(code);

	return raw;
};



export {
	parseCode,
};
