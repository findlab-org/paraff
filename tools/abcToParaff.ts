
import fs from "fs";
import path from "path";
import YAML from "yaml";
import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";

import { ABC, abcToParaff } from "../source/abc";
import * as paraff from "../source/paraff";
import walkDir from "./walkDir";



const argv = yargs(hideBin(process.argv)).command(
	"$0 source [options]",
	"Convert lilypond files to paraff yaml.",
	yargs => yargs
		.positional("source", {
			describe: "ABC files source path",
			type: "string",
		})
		.demandOption("source")
	,
).help().argv;


const main = async (): Promise<void> => {
	const source = (argv as any).source as string;

	const abcGrammar = await import("../source/abc/grammar.jison.js");

	const realSource = fs.realpathSync(source);
	const isFile = fs.lstatSync(realSource).isFile();
	const sourceDir = isFile ? path.dirname(source) : source;
	const scoreFiles = isFile ? [source] : walkDir(sourceDir, /Keyboard.*\.abc$/, { recursive: true });

	const scores: Record<string, Record<number, string>> = {};

	scoreFiles.forEach(filePath => {
		console.log("Processing:", filePath);

		const scoreName = path.basename(filePath).replace(/\.\w+$/, "").replace(/\s+/g, "_");

		const sourceText = fs.readFileSync(filePath, { encoding: "utf-8" });
		const doc = abcGrammar.parse(sourceText) as ABC.Document;
		const sentences = abcToParaff(doc);

		scores[scoreName] = Object.fromEntries(sentences.map((s, idx) => [idx + 1, paraff.stringifyTokens(s.sentence)]));
	});

	const outputPath = path.resolve(sourceDir, "./paraff.yaml");

	fs.writeFileSync(outputPath, YAML.stringify(scores));

	console.log("Done.");
};


main();
