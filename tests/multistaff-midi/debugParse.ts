// Debug script to inspect parsed Paraff structure

import * as paraff from "../../source/paraff";

const testCode = "BOM K1 TN3 TD4 S1 Cg Md d Osup D4 Mu g Osub D8 a D8 b D8 c D8 VB S2 Cf Md g b d D2 a D4 EOM";

async function main() {
	const doc = await paraff.parseCode(testCode);
	const measure = doc as paraff.ParaffDocument.Measure;

	console.log("Paraff code:", testCode);
	console.log("\nParsed Measure:");
	console.log("  staffN:", measure.staffN);
	console.log("  key:", measure.key);
	console.log("  timeSig:", measure.timeSig);
	console.log("  voices:", measure.voices.length);

	for (let vi = 0; vi < measure.voices.length; vi++) {
		const voice = measure.voices[vi];
		console.log(`\n  Voice ${vi + 1}:`);
		console.log(`    staff: ${voice.staff}`);
		console.log(`    headClef: ${voice.headClef}`);
		console.log(`    octaveShiftIn: ${voice.octaveShiftIn}`);
		console.log(`    octaveShiftOut: ${voice.octaveShiftOut}`);
		console.log(`    terms: ${voice.terms.length}`);

		for (let ti = 0; ti < voice.terms.length; ti++) {
			const term = voice.terms[ti] as any;
			if (term.chord) {
				const event = term as paraff.ParaffDocument.EventTerm;
				console.log(`      Event ${ti}:`);
				console.log(`        stem: ${event.stem}`);
				console.log(`        duration: div=${event.duration.division}, dots=${event.duration.dots}`);
				console.log(`        chord:`);
				for (const pitch of event.chord) {
					console.log(`          ${pitch.phonet}${pitch.acc} octaves=${pitch.octaves} note=${pitch.note}`);
				}
			} else if (term.context) {
				const ctx = term as paraff.ParaffDocument.ContextTerm;
				console.log(`      Context ${ti}:`, JSON.stringify(ctx.context));
			}
		}
	}
}

main().catch(console.error);
