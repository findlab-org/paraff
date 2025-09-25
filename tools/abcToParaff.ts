
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
	const paraffGrammar = await import("../source/paraff/grammar.jison.js");

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
		const samples = abcToParaff(doc);

		// TODO: append author descriptor

		const score = samples.map(s => [s.description.join(" "), paraff.combineSpaces(paraff.stringifyTokens(s.sentence))]);

		// validate score
		score.forEach(([_, sentence], index) => {
			try {
				const doc = paraffGrammar.parse(sentence) as paraff.ParaffDocument.Measure;
				if (doc.ill)
					console.warn("invalid sentence:", scoreName, index + 1, sentence);
			}
			catch (err) {
				console.log("error to parse sentence:", index + 1, sentence, err);
			}
		});

		scores[scoreName] = Object.fromEntries(score.map((ds, i) => [i + 1, ds.join("\n")]));
	});

	const outputPath = path.resolve(sourceDir, "./paraff.yaml");

	fs.writeFileSync(outputPath, YAML.stringify(scores));

	console.log("Done.");
};


main();
