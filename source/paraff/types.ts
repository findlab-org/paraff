
import { Fraction } from "../fraction";



interface TokenGen {
	n_seq: number;

	deduce (input_ids: number[]): Promise<number[]>;
};


type LatentVector = Float32Array;


interface SentenceEncoder {
	n_seq: number;

	encode (ids: number[], sigma: number): Promise<LatentVector>;
};


interface SentenceDecoder {
	n_seq: number;

	decode (premier: number[], latent: LatentVector): Promise<number[]>;
	decodeScore (scorePremier: number[], premier: number[], latent: LatentVector|null): Promise<number[]>;
};


enum ExpressiveMark {
	SlurL			= "slurL",
	SlurR			= "slurR",
	Tie				= "tie",
	Arpeggio		= "arp",
	Trill			= "tr",
	Fermata			= "fer",
	ShortFermata	= "sf",
	Staccato		= "st",
	Staccatissimo	= "stm",
	Accent			= "ac",
	Mordent			= "mor",
	Prall			= "pr",
	Turn			= "turn",
	Portato			= "por",
	Tenuto			= "ten",
	Marcato			= "mar",
	Crescendo		= "cre",
	Diminuendo		= "dim",
	CreDimStop		= "cds",
	f				= "Df",
	p				= "Dp",
	m				= "Dm",
	r				= "Dr",
	s				= "Ds",
	z				= "Dz",
	SustainOn		= "susOn",
	SustainOff		= "susOff",
};



export {
	TokenGen,
	Fraction,
	LatentVector,
	SentenceEncoder,
	SentenceDecoder,
	ExpressiveMark,
};
