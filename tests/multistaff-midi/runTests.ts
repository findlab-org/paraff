// Multi-staff MIDI verification test runner
// Compares Paraff→LilyPond→MIDI vs Paraff→MEI→MIDI

import * as fs from "fs";
import * as path from "path";
import { execSync, exec } from "child_process";

import * as paraff from "../../source/paraff";
import * as meiEncoder from "../../source/paraff/meiEncoder";
import { testCases, TestCase } from "./testCases";
import { parseMIDIFile, parseMIDIBase64, extractOnsets, compareOnsets, pitchToName, ComparisonResult } from "./midiComparator";

const OUTPUT_DIR = path.join(__dirname, "output");

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
	fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Convert Paraff to LilyPond with MIDI output enabled
async function paraffToLilypond(paraffCode: string): Promise<string> {
	const doc = await paraff.parseCode(paraffCode);
	const measure = doc as paraff.ParaffDocument.Measure;

	// Generate LilyPond with MIDI output
	const lyContent = paraff.lilypondEncoder.renderDoc(
		paraff.lilypondEncoder.encodeMusic(measure),
		{
			paper: { width: 200, height: 100 },
			fontSize: 20,
			withMIDI: "\n\t\t\\tempo 4 = 60\n\t",  // Fixed tempo for consistent comparison
		}
	);

	return lyContent;
}

// Convert Paraff to MEI
async function paraffToMEI(paraffCode: string): Promise<string> {
	const doc = await paraff.parseCode(paraffCode);
	return meiEncoder.encode(doc);
}

// Generate MIDI from LilyPond file
function lilypondToMIDI(lyPath: string, midiPath: string): boolean {
	try {
		const dir = path.dirname(midiPath);
		const baseName = path.basename(midiPath, ".midi");

		// Run lilypond
		execSync(`lilypond -dbackend=null -o "${dir}/${baseName}" "${lyPath}"`, {
			stdio: ["pipe", "pipe", "pipe"],
			timeout: 30000,
		});

		return fs.existsSync(midiPath);
	} catch (error) {
		console.error(`LilyPond error: ${error}`);
		return false;
	}
}

// Verovio toolkit instance (lazy initialized)
let verovioToolkit: any = null;

async function initVerovio() {
	if (verovioToolkit) return verovioToolkit;

	// Use eval to avoid TypeScript compilation issues with ESM modules
	const createVerovioModule = (await eval(`import("verovio/wasm")`)).default;
	const { VerovioToolkit } = await eval(`import("verovio/esm")`);

	const VerovioModule = await createVerovioModule();
	verovioToolkit = new VerovioToolkit(VerovioModule);

	return verovioToolkit;
}

// Generate MIDI from MEI using Verovio
async function meiToMIDI(meiContent: string): Promise<string | null> {
	try {
		const toolkit = await initVerovio();

		// Set options
		toolkit.setOptions({
			scale: 40,
			pageWidth: 2100,
			pageHeight: 2970,
			adjustPageWidth: true,
		});

		// Load MEI
		const loaded = toolkit.loadData(meiContent);
		if (!loaded) {
			console.error("Verovio failed to load MEI");
			console.error("Verovio log:", toolkit.getLog());
			return null;
		}

		// Render to MIDI (returns base64)
		const midiBase64 = toolkit.renderToMIDI();
		return midiBase64;
	} catch (error) {
		console.error(`Verovio error: ${error}`);
		return null;
	}
}

// Run a single test case
async function runTestCase(testCase: TestCase): Promise<{
	name: string;
	success: boolean;
	comparison?: ComparisonResult;
	error?: string;
	lilypondNotes?: number;
	meiNotes?: number;
}> {
	console.log(`\n--- Testing: ${testCase.name} ---`);
	console.log(`Description: ${testCase.description}`);
	console.log(`Paraff: ${testCase.paraff}`);

	const result = {
		name: testCase.name,
		success: false,
		lilypondNotes: 0,
		meiNotes: 0,
	} as any;

	try {
		// Step 1: Convert to LilyPond
		const lyContent = await paraffToLilypond(testCase.paraff);
		const lyPath = path.join(OUTPUT_DIR, `${testCase.name}.ly`);
		fs.writeFileSync(lyPath, lyContent);
		console.log(`  LilyPond saved: ${lyPath}`);

		// Step 2: Convert to MEI
		const meiContent = await paraffToMEI(testCase.paraff);
		const meiPath = path.join(OUTPUT_DIR, `${testCase.name}.mei`);
		fs.writeFileSync(meiPath, meiContent);
		console.log(`  MEI saved: ${meiPath}`);

		// Step 3: Generate MIDI from LilyPond
		const lyMidiPath = path.join(OUTPUT_DIR, `${testCase.name}.midi`);
		const lyMidiSuccess = lilypondToMIDI(lyPath, lyMidiPath);
		if (!lyMidiSuccess) {
			result.error = "Failed to generate MIDI from LilyPond";
			console.log(`  ERROR: ${result.error}`);
			return result;
		}
		console.log(`  LilyPond MIDI saved: ${lyMidiPath}`);

		// Step 4: Generate MIDI from MEI
		const meiMidiBase64 = await meiToMIDI(meiContent);
		if (!meiMidiBase64) {
			result.error = "Failed to generate MIDI from MEI";
			console.log(`  ERROR: ${result.error}`);
			return result;
		}
		const meiMidiPath = path.join(OUTPUT_DIR, `${testCase.name}_mei.midi`);
		fs.writeFileSync(meiMidiPath, Buffer.from(meiMidiBase64, "base64"));
		console.log(`  MEI MIDI saved: ${meiMidiPath}`);

		// Step 5: Parse both MIDI files
		const lyMidi = parseMIDIFile(lyMidiPath);
		const meiMidi = parseMIDIBase64(meiMidiBase64);

		result.lilypondNotes = lyMidi.notes.length;
		result.meiNotes = meiMidi.notes.length;

		console.log(`  LilyPond notes: ${result.lilypondNotes}`);
		console.log(`  MEI notes: ${result.meiNotes}`);

		// Step 6: Extract onsets and compare
		const lyOnsets = extractOnsets(lyMidi);
		const meiOnsets = extractOnsets(meiMidi);

		console.log(`  LilyPond onsets: ${lyOnsets.length}`);
		console.log(`  MEI onsets: ${meiOnsets.length}`);

		// Compare with tick normalization (LilyPond uses 384 tpq, Verovio uses 120 tpq)
		result.comparison = compareOnsets(lyOnsets, meiOnsets, lyMidi.ticksPerQuarter, meiMidi.ticksPerQuarter);
		result.success = result.comparison.match;

		if (result.success) {
			console.log(`  RESULT: MATCH`);
		} else {
			console.log(`  RESULT: MISMATCH`);
			for (const diff of result.comparison.differences) {
				console.log(`    - ${diff.detail}`);
			}
		}

		// Print note details for debugging
		console.log(`  LilyPond MIDI notes:`);
		for (const onset of lyOnsets.slice(0, 10)) {
			console.log(`    tick ${onset.tick}: [${onset.pitches.map(pitchToName).join(", ")}]`);
		}
		if (lyOnsets.length > 10) console.log(`    ... and ${lyOnsets.length - 10} more onsets`);

		console.log(`  MEI MIDI notes:`);
		for (const onset of meiOnsets.slice(0, 10)) {
			console.log(`    tick ${onset.tick}: [${onset.pitches.map(pitchToName).join(", ")}]`);
		}
		if (meiOnsets.length > 10) console.log(`    ... and ${meiOnsets.length - 10} more onsets`);

	} catch (error) {
		result.error = `Exception: ${error}`;
		console.log(`  ERROR: ${result.error}`);
	}

	return result;
}

// Main test runner
async function main() {
	console.log("===========================================");
	console.log("Multi-Staff MIDI Verification Test Suite");
	console.log("===========================================");
	console.log(`Testing ${testCases.length} cases`);
	console.log(`Output directory: ${OUTPUT_DIR}`);

	const results = [];

	for (const testCase of testCases) {
		const result = await runTestCase(testCase);
		results.push(result);
	}

	// Summary
	console.log("\n\n===========================================");
	console.log("SUMMARY");
	console.log("===========================================");

	const passed = results.filter(r => r.success).length;
	const failed = results.filter(r => !r.success).length;

	console.log(`Passed: ${passed}/${results.length}`);
	console.log(`Failed: ${failed}/${results.length}`);

	if (failed > 0) {
		console.log("\nFailed tests:");
		for (const result of results.filter(r => !r.success)) {
			console.log(`  - ${result.name}: ${result.error || "Mismatch"}`);
			if (result.comparison && result.comparison.differences.length > 0) {
				for (const diff of result.comparison.differences.slice(0, 3)) {
					console.log(`      ${diff.detail}`);
				}
				if (result.comparison.differences.length > 3) {
					console.log(`      ... and ${result.comparison.differences.length - 3} more differences`);
				}
			}
		}
	}

	// Save detailed results to JSON
	const resultsPath = path.join(OUTPUT_DIR, "results.json");
	fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
	console.log(`\nDetailed results saved to: ${resultsPath}`);
}

main().catch(console.error);
