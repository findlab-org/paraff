
import fs from "fs";
import path from "path";
import YAML from "yaml";

import {parseCode} from "../source/abc/parser";



const main = async (abc_path: string): Promise<void> => {
	const sourceText = fs.readFileSync(abc_path).toString();
	const raw = await parseCode(sourceText);
	console.log("result:", raw);

	const stem = path.basename(abc_path);
	fs.writeFileSync(path.join("./tests/assets/", stem.substring(0, stem.length - 4).replace(/\s/g, "") + ".local.yaml"), YAML.stringify(raw));
};


main(process.argv[2] || "./tests/assets/simple.abc");
