
import fs from "fs";
import path from "path";
import YAML from "yaml";

import { ABC, abcToParaff } from "../source/abc";



const main = async (abc_doc_path: string): Promise<void> => {
	const sourceText = fs.readFileSync(abc_doc_path, {encoding: "utf-8"});
	const doc = YAML.parse(sourceText) as ABC.Document;
	const measures = abcToParaff(doc[0]);
	console.log(JSON.stringify(measures, null, 2));
};


main(process.argv[2] || "./tests/assets/cooley.local.yaml");
