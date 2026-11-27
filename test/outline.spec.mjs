import assert from 'assert';
import { parse } from '../src/opentype.mjs';
import { readFileSync } from 'fs';

// DEBUG is normally defined by esbuild at build time; define it for tests.
globalThis.DEBUG = false;

const loadSync = (url, opt) => parse(readFileSync(url), opt);

const typeString = commands => commands.map(c => c.type).join('');

function assertAlmostEqual(actual, expected, message) {
    assert.ok(Math.abs(actual - expected) < 1e-9, message + ': expected ' + expected + ', got ' + actual);
}

describe('outline folding', function() {
    describe('Roboto (quadratic TrueType outline)', function() {
        let font;
        let glyph;

        beforeEach(function() {
            font = loadSync('./test/fonts/Roboto-Black.ttf');
            glyph = font.charToGlyph('B');
        });

        it('keeps the placed canvas commands and the default SVG on the same outline', function() {
            const path = glyph.getPath(0, 80, 48, {}, font);
            assert.equal(path.commands.length, 35);
            assert.equal(typeString(path.commands), 'MLLLQQLQQLQQLQQLMLLLQQLQLMLLQQLQQLL');
            // No stroke: the canvas path must not contain close commands.
            assert.equal(path.commands.filter(c => c.type === 'Z').length, 0);
            assert.equal(path.commands[0].x, 16.4296875);
            assert.equal(path.commands[0].y, 80);

            const box = path.getBoundingBox();
            assert.equal(box.x1, 2.578125);
            assert.equal(box.y1, 45.875);
            assert.equal(box.x2, 29.015625);
            assert.equal(box.y2, 80);

            const pathData = path.toPathData();
            assert.ok(pathData.startsWith('M16.43 45.88'));
            assert.ok(pathData.includes('Q21.42 80 24.86 77.59'));
            assert.ok(pathData.includes('Q29.02 58.74 29.02 55.98'));
            assert.equal(pathData.includes('Z'), false);

            // Exporting the glyph with placement must serialize that same outline.
            assert.equal(glyph.toSVG({ x: 0, y: 80, fontSize: 48 }, font), path.toSVG());
            assert.equal(glyph.toPathData({ x: 0, y: 80, fontSize: 48 }, font), pathData);
        });

        it('keeps the font-unit outline in font coordinates', function() {
            assert.equal(glyph.path.commands.length, 38);
            assert.equal(typeString(glyph.path.commands), 'MLLLQQLQQLQQLQQLZMLLLQQLQLZMLLQQLQQLLZ');
            assert.equal(glyph.path.commands.filter(c => c.type === 'Z').length, 3);

            const pathData = glyph.path.toPathData();
            assert.ok(pathData.includes('1060.50'));
            assert.equal((pathData.match(/Z/g) || []).length, 3);

            // The font-unit export keeps its own coordinates.
            assert.equal(glyph.toPathData(undefined, font), pathData);
            assert.equal(glyph.toSVG(undefined, font), '<path d="' + pathData + '"/>');
        });

        it('moves the canvas commands and the SVG together when hinting is enabled', function() {
            const unhinted = glyph.getPath(0, 80, 48, {}, font);
            const hinted = glyph.getPath(0, 80, 48, { hinting: true }, font);

            assert.equal(hinted.commands.length, 35);
            assert.equal(typeString(hinted.commands), typeString(unhinted.commands));
            assert.equal(hinted.commands[0].x, 16.4375);
            assert.equal(hinted.commands[0].y, 80);

            const hintedBox = hinted.getBoundingBox();
            const unhintedBox = unhinted.getBoundingBox();
            assert.equal(hintedBox.x1, unhintedBox.x1);
            assert.equal(hintedBox.y1, unhintedBox.y1);
            assert.equal(hintedBox.x2, unhintedBox.x2);
            assert.equal(hintedBox.y2, unhintedBox.y2);

            const hintedPathData = hinted.toPathData();
            assert.ok(hintedPathData.startsWith('M16.44 45.88'));
            assert.ok(hintedPathData.includes('Q29.02 58.82 29.02 56.04'));

            // 16.4375 in the commands and M16.44 in the SVG always come together.
            assert.equal(glyph.toSVG({ x: 0, y: 80, fontSize: 48, hinting: true }, font), hinted.toSVG());
            assert.equal(glyph.toPathData({ x: 0, y: 80, fontSize: 48, hinting: true }, font), hintedPathData);

            // Turning hinting back off restores the unhinted outline.
            const restored = glyph.getPath(0, 80, 48, {}, font);
            assert.equal(restored.commands[0].x, 16.4296875);
            assert.ok(restored.toPathData().startsWith('M16.43 45.88'));
        });
    });

    describe('Source Sans Pro (cubic CFF outline)', function() {
        let font;
        let glyph;

        beforeEach(function() {
            font = loadSync('./test/fonts/SourceSansPro-Regular.otf');
            glyph = font.charToGlyph('B');
        });

        it('keeps the placed canvas commands and the default SVG on the same outline', function() {
            const path = glyph.getPath(0, 80, 48, {}, font);
            assert.equal(path.commands.length, 18);
            assert.equal(typeString(path.commands), 'MLCCLCCLMLLCCMLLCC');
            assert.equal(path.commands[0].x, 4.32);
            assert.equal(path.commands[0].y, 80);

            const curve = path.commands[2];
            assert.equal(curve.type, 'C');
            assert.equal(curve.x1, 21.408);
            assert.equal(curve.y1, 80);
            assertAlmostEqual(curve.x2, 26.304, 'first cubic x2');
            assert.equal(curve.y2, 76.976);
            assertAlmostEqual(curve.x, 26.304, 'first cubic x');
            assert.equal(curve.y, 70.78399999999999);

            const pathData = path.toPathData();
            assert.ok(pathData.startsWith('M4.32 48.51'));
            assert.ok(pathData.includes('C21.41 48.51 26.30 51.54 26.30 57.73'));

            assert.equal(glyph.toSVG({ x: 0, y: 80, fontSize: 48 }, font), path.toSVG());
            assert.equal(glyph.toPathData({ x: 0, y: 80, fontSize: 48 }, font), pathData);
        });

        it('keeps the font-unit outline in font coordinates', function() {
            assert.equal(glyph.path.commands.length, 21);
            assert.equal(typeString(glyph.path.commands), 'MLCCLCCLZMLLCCZMLLCCZ');
            assert.equal(glyph.path.commands.filter(c => c.type === 'C').length, 8);
            assert.equal(glyph.toPathData(undefined, font), glyph.path.toPathData());
        });
    });

    describe('Changa (variable TrueType outline)', function() {
        let font;
        let glyph;

        beforeEach(function() {
            font = loadSync('./test/fonts/Changa-VariableFont_wght.ttf');
            glyph = font.charToGlyph('g');
        });

        const cases = [
            {
                wght: 200,
                firstX: 8.46,
                firstY: 84.708,
                box: [1.8720000000000003, 70.416, 16.524, 95.796],
                pathStart: 'M8.46 81.50',
                pathMid: '15.30 95.80',
                lastX: 16.524,
                lastY: 71.676
            },
            {
                wght: 700,
                firstX: 9.252,
                firstY: 84.816,
                box: [1.08, 69.47999999999999, 19.008000000000003, 96.228],
                pathStart: 'M9.25 80.89',
                pathMid: '15.98 96.23',
                lastX: 19.008000000000003,
                lastY: 72.396
            }
        ];

        for (const expected of cases) {
            it('uses the same outline for canvas, SVG and bounding box at wght ' + expected.wght, function() {
                const path = glyph.getPath(0, 90, 36, { variation: { wght: expected.wght } }, font);
                assert.equal(path.commands.length, 60);
                assert.equal(typeString(path.commands), 'MLQQQLQQQLQQQLQQQMLLQQLLLQQLMLQQQLQQLLQQLQQLLQQLLLLQQQQMLLLL');
                assert.equal(path.commands[0].x, expected.firstX);
                assert.equal(path.commands[0].y, expected.firstY);

                const box = path.getBoundingBox();
                assert.equal(box.x1, expected.box[0]);
                assert.equal(box.y1, expected.box[1]);
                assert.equal(box.x2, expected.box[2]);
                assert.equal(box.y2, expected.box[3]);

                const pathData = path.toPathData();
                assert.ok(pathData.startsWith(expected.pathStart));
                assert.ok(pathData.includes(expected.pathMid));

                const last = path.commands[path.commands.length - 1];
                assert.equal(last.x, expected.lastX);
                assert.equal(last.y, expected.lastY);

                assert.equal(glyph.toSVG({ x: 0, y: 90, fontSize: 36, variation: { wght: expected.wght } }, font), path.toSVG());
                assert.equal(glyph.toPathData({ x: 0, y: 90, fontSize: 36, variation: { wght: expected.wght } }, font), pathData);
            });
        }

        it('follows the font default and variation.set(), and switches cleanly back', function() {
            assert.deepEqual(font.defaultRenderOptions.variation, { wght: 200 });

            let path = glyph.getPath(0, 90, 36, {}, font);
            assert.equal(path.commands[0].x, 8.46);
            assert.equal(path.getBoundingBox().x1, 1.8720000000000003);

            font.variation.set({ wght: 700 });
            path = glyph.getPath(0, 90, 36, {}, font);
            assert.equal(path.commands[0].x, 9.252);
            assert.equal(path.getBoundingBox().x1, 1.08);

            font.variation.set({ wght: 200 });
            path = glyph.getPath(0, 90, 36, {}, font);
            assert.equal(path.commands[0].x, 8.46);
            assert.equal(path.getBoundingBox().x1, 1.8720000000000003);
        });
    });

    describe('placed glyphs and advance widths', function() {
        let font;

        beforeEach(function() {
            font = loadSync('./test/fonts/Roboto-Black.ttf');
        });

        it('keeps the "é" placement and outline', function() {
            const glyph = font.charToGlyph('é');
            const path = glyph.getPath(12, 100, 64, {}, font);
            assert.equal(path.commands.length, 36);
            const box = path.getBoundingBox();
            assert.equal(box.x1, 13.90625);
            assert.equal(box.y1, 51.96875);
            assert.equal(box.x2, 45.5625);
            assert.equal(box.y2, 100.625);

            const pathData = path.toPathData();
            assert.ok(pathData.startsWith('M31.31 51.97'));
            assert.ok(pathData.endsWith('L32.44 90.81'));
            assert.equal(glyph.toSVG({ x: 12, y: 100, fontSize: 64 }, font), path.toSVG());
        });

        it('keeps the "AV" pair outline and advance width', function() {
            assert.equal(font.getAdvanceWidth('AV', 48), 62.6015625);

            const path = font.getPath('AV', 0, 80, 48);
            assert.equal(path.commands.length, 21);
            assert.equal(path.getBoundingBox().x1, -0.0703125);

            const pathData = path.toPathData();
            assert.ok(pathData.includes('M39.94 80'));
            assert.equal(path.toSVG(), '<path d="' + pathData + '"/>');
        });
    });

    describe('no scaled outlines are cached on the glyph', function() {
        it('does not touch the font-unit path when exporting at several sizes', function() {
            const font = loadSync('./test/fonts/Roboto-Black.ttf');
            const glyph = font.charToGlyph('B');
            const fontPathBefore = JSON.stringify(glyph.path.commands);

            glyph.getPath(0, 80, 12, {}, font);
            glyph.toSVG({ x: 0, y: 80, fontSize: 24 }, font);
            glyph.getPath(0, 80, 48, {}, font);
            glyph.toSVG({ x: 0, y: 80, fontSize: 96 }, font);

            assert.equal(JSON.stringify(glyph.path.commands), fontPathBefore);
            assert.equal(glyph.path.commands.length, 38);
            assert.equal(glyph.path.commands.filter(c => c.type === 'Z').length, 3);
        });
    });
});
