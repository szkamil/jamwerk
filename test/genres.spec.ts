import { describe, it, expect } from 'vitest';
import { normGenres, genreLabel, GENRES } from '../src/genres';

describe('Genres', () => {
	it('maps legacy free text and labels in any language to slugs, dedupes, drops junk', () => {
		expect(normGenres(['classic', 'jazz', 'contemporaine'])).toEqual(['classical', 'jazz', 'contemporary']);
		expect(normGenres(['pop-rock', 'metal', 'Rock'])).toEqual(['pop', 'rock', 'metal']);
		expect(normGenres(['Klassik', 'musiques du monde', 'R&B', 'bossa nova', 'whatever-this-is'])).toEqual(['classical', 'world', 'rnb', 'samba_bossa']);
		expect(normGenres('not an array')).toEqual([]);
	});
	it('has a label in all four languages for every slug', () => {
		for (const g of GENRES) for (const l of ['en', 'fr', 'de', 'it'] as const) expect(genreLabel(l, g)).toBeTruthy();
		expect(genreLabel('fr', 'classical')).toBe('classique');
		expect(genreLabel('de', 'electronic')).toBe('Elektro');
	});
});
