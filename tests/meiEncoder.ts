
import fs from "fs";
import YAML from "yaml";

import * as paraff from "../source/paraff";


const testBasic = async (): Promise<void> => {
	console.log("=== Testing basic MEI encoding ===\n");

	// Test with basic.yaml
	const code = "BOM K0 TN4 TD4 S1 Cg c D1 EOM";
	console.log("Paraff code:", code);

	const doc = await paraff.parseCode(code);
	console.log("\nParsed document:", JSON.stringify(doc, null, 2));

	const mei = paraff.meiEncoder.encode(doc);
	console.log("\nMEI output:\n", mei);
};


const testFromFile = async (source: string): Promise<void> => {
	console.log(`=== Testing MEI encoding from ${source} ===\n`);

	const sourceText = fs.readFileSync(source).toString();
	const data = YAML.parse(sourceText);

	// Handle different YAML structures
	if (data.scores) {
		// Format: { scores: { scoreName: { measureKey: paraffCode } } }
		for (const [scoreName, score] of Object.entries(data.scores)) {
			console.log(`\nScore: ${scoreName}`);
			const measures: paraff.ParaffDoc[] = [];

			for (const [key, value] of Object.entries(score as Record<string, string>)) {
				if (key.startsWith("_")) continue; // Skip metadata like _descriptors

				try {
					const doc = await paraff.parseCode(value);
					if ((doc as any).staffN !== undefined) {
						measures.push(doc);
					}
				} catch (err) {
					console.error(`  Error parsing ${key}:`, err);
				}
			}

			if (measures.length > 0) {
				console.log(`  Parsed ${measures.length} measures`);
				const mei = paraff.meiEncoder.encodeMultiple(measures);

				// Output first 2000 chars
				console.log("\n  MEI output (truncated):\n");
				console.log(mei.slice(0, 2000));
				if (mei.length > 2000) {
					console.log(`\n  ... (${mei.length - 2000} more characters)`);
				}
			}

			// Only process first score for demo
			break;
		}
	} else {
		// Single score format
		const code = Object.values(data)[0] as any;
		if (typeof code === "object" && code["0"]) {
			const doc = await paraff.parseCode(code["0"]);
			const mei = paraff.meiEncoder.encode(doc);
			console.log("MEI output:\n", mei);
		}
	}
};


const main = async (): Promise<void> => {
	const args = process.argv.slice(2);

	if (args.length === 0) {
		await testBasic();
	} else {
		await testFromFile(args[0]);
	}
};


main().catch(console.error);
