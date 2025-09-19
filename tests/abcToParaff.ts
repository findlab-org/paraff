
import fs from "fs";
import YAML from "yaml";

import { ABC, abcToParaff } from "../source/abc";
import * as paraff from "../source/paraff";



const main = async (abc_doc_path: string): Promise<void> => {
	const sourceText = fs.readFileSync(abc_doc_path, {encoding: "utf-8"});
	const doc = YAML.parse(sourceText) as ABC.Document;
	const sentences = abcToParaff(doc);
	//console.log(JSON.stringify(sentences, null, 2));
	console.log(sentences.map(s => paraff.stringifyTokens(s.sentence)).join("\n"));
};


main(process.argv[2] || "./tests/assets/cooley.local.yaml");
