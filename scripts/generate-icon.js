// Generates a 128x128 PNG icon with "AFSIM" text for the WSF extension
const zlib = require('zlib');
const fs = require('fs');

const WIDTH = 128;
const HEIGHT = 128;

// Create RGBA pixel buffer
const pixels = Buffer.alloc(WIDTH * HEIGHT * 4);

function setPixel(x, y, r, g, b, a = 255) {
    if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT) return;
    const idx = (y * WIDTH + x) * 4;
    pixels[idx] = r;
    pixels[idx + 1] = g;
    pixels[idx + 2] = b;
    pixels[idx + 3] = a;
}

function fillRect(x0, y0, w, h, r, g, b) {
    const x1 = Math.min(x0 + w, WIDTH);
    const y1 = Math.min(y0 + h, HEIGHT);
    for (let y = Math.max(y0, 0); y < y1; y++) {
        for (let x = Math.max(x0, 0); x < x1; x++) {
            setPixel(x, y, r, g, b);
        }
    }
}

// ========== Background ==========
// Solid dark blue background
fillRect(0, 0, WIDTH, HEIGHT, 18, 22, 75);

// Subtle gradient overlay: lighter at center
for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
        const dx = (x - WIDTH / 2) / (WIDTH / 2);
        const dy = (y - HEIGHT / 2) / (HEIGHT / 2);
        const dist = Math.sqrt(dx * dx + dy * dy);
        const glow = Math.max(0, 1 - dist * 1.3) * 0.12;
        const idx = (y * WIDTH + x) * 4;
        if (glow > 0) {
            pixels[idx] = Math.min(255, pixels[idx] + Math.round(glow * 40));
            pixels[idx + 1] = Math.min(255, pixels[idx + 1] + Math.round(glow * 50));
            pixels[idx + 2] = Math.min(255, pixels[idx + 2] + Math.round(glow * 60));
        }
    }
}

// ========== Bitmap font ==========
// Each character is a 9x14 grid (width x height), stored as array of strings
// '#' = foreground, ' ' = background
const fontData = {
    'A': [
        '    #    ',
        '   # #   ',
        '  #   #  ',
        '  #   #  ',
        ' #     # ',
        ' #     # ',
        ' ####### ',
        ' #     # ',
        ' #     # ',
        ' #     # ',
        '#       #',
        '#       #',
        '#       #',
        '#       #',
    ],
    'F': [
        '######## ',
        '#        ',
        '#        ',
        '#        ',
        '#        ',
        '######   ',
        '#        ',
        '#        ',
        '#        ',
        '#        ',
        '#        ',
        '#        ',
        '#        ',
        '#        ',
    ],
    'S': [
        '  #####  ',
        ' #     # ',
        '#       #',
        '#        ',
        '#        ',
        ' #       ',
        '  ####   ',
        '      ## ',
        '        #',
        '        #',
        '        #',
        '#       #',
        ' #     # ',
        '  #####  ',
    ],
    'I': [
        '  #####  ',
        '    #    ',
        '    #    ',
        '    #    ',
        '    #    ',
        '    #    ',
        '    #    ',
        '    #    ',
        '    #    ',
        '    #    ',
        '    #    ',
        '    #    ',
        '    #    ',
        '  #####  ',
    ],
    'M': [
        '#       #',
        '#       #',
        '##     ##',
        '##     ##',
        '# #   # #',
        '# #   # #',
        '#  # #  #',
        '#  # #  #',
        '#   #   #',
        '#       #',
        '#       #',
        '#       #',
        '#       #',
        '#       #',
    ],
};

const SCALE = 2;                  // pixel scale factor
const CHAR_W = 9 * SCALE;         // 18px per character
const CHAR_H = 14 * SCALE;        // 28px tall
const SPACING = 3 * SCALE;        // 6px between chars

const text = 'AFSIM';
const totalW = text.length * CHAR_W + (text.length - 1) * SPACING;
const startX = Math.round((WIDTH - totalW) / 2);
const startY = Math.round((HEIGHT - CHAR_H) / 2);

const fgColor = [220, 235, 255];   // light blue-white text
const bgColor = [18, 22, 75];      // dark blue

// Anti-alias factor: 1x (no supersampling)
const SS = 1;

function drawChar(ch, originX, originY) {
    const pattern = fontData[ch];
    if (!pattern) return;

    for (let row = 0; row < 14; row++) {
        const line = pattern[row];
        for (let col = 0; col < 9; col++) {
            if (line[col] !== '#') continue;

            // Draw scaled pixel block
            for (let dy = 0; dy < SCALE * SS; dy++) {
                for (let dx = 0; dx < SCALE * SS; dx++) {
                    const px = originX + col * SCALE * SS + dx;
                    const py = originY + row * SCALE * SS + dy;
                    setPixel(Math.floor(px / SS), Math.floor(py / SS),
                        fgColor[0], fgColor[1], fgColor[2]);
                }
            }
        }
    }
}

// Draw text with supersampling
const ssStartX = startX * SS;
const ssStartY = startY * SS;

let cursorX = 0;
for (const ch of text) {
    drawChar(ch, ssStartX + cursorX * SS, ssStartY);
    cursorX += CHAR_W + SPACING;
}

// ========== Subtle underline accent ==========
const underlineY = startY + CHAR_H + 6;
const underlineW = totalW - 10;
const underlineX = startX + 5;
for (let y = underlineY; y < underlineY + 2; y++) {
    for (let x = underlineX; x < underlineX + underlineW; x++) {
        if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT) continue;
        const idx = (y * WIDTH + x) * 4;
        const alpha = 0.5;
        pixels[idx] = Math.round(pixels[idx] * (1 - alpha) + 220 * alpha);
        pixels[idx + 1] = Math.round(pixels[idx + 1] * (1 - alpha) + 235 * alpha);
        pixels[idx + 2] = Math.round(pixels[idx + 2] * (1 - alpha) + 255 * alpha);
    }
}

// ========== Build PNG ==========
const rawData = Buffer.alloc(HEIGHT * (1 + WIDTH * 4));
for (let y = 0; y < HEIGHT; y++) {
    rawData[y * (1 + WIDTH * 4)] = 0; // filter: none
    pixels.copy(rawData, y * (1 + WIDTH * 4) + 1, y * WIDTH * 4, (y + 1) * WIDTH * 4);
}

const compressed = zlib.deflateSync(rawData);

const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function crc32(buf) {
    let c = 0xffffffff;
    const table = [];
    for (let n = 0; n < 256; n++) {
        let cval = n;
        for (let k = 0; k < 8; k++) {
            cval = (cval & 1) ? (0xedb88320 ^ (cval >>> 1)) : (cval >>> 1);
        }
        table[n] = cval;
    }
    for (let i = 0; i < buf.length; i++) {
        c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    }
    return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
    const typeData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = crc32(typeData);
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc);
    return Buffer.concat([len, typeData, crcBuf]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(WIDTH, 0);
ihdr.writeUInt32BE(HEIGHT, 4);
ihdr[8] = 8;  // bit depth
ihdr[9] = 6;  // color type: RGBA
ihdr[10] = 0; // compression
ihdr[11] = 0; // filter
ihdr[12] = 0; // interlace

const png = Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0)),
]);

fs.writeFileSync('images/icon.png', png);
console.log(`Icon generated: ${png.length} bytes`);
