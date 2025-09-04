
const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

const code = `
# function to resize input images if necessary
import io

from PIL import Image

from infra.exifRotate import rotateJpegExif
from infra.heif_images import convert_heif_to_jpeg

MAX_SIZE_DEFAULT = 800


def image_check(img_bytes, max_size):
    try:
        im = Image.open(io.BytesIO(img_bytes))
    except Exception:
        print('PIL could not open image, now trying HEIF decode')

        decoded = convert_heif_to_jpeg(img_bytes)
        im = Image.open(io.BytesIO(decoded))
        print('HEIF decode successful!')

    im = rotateJpegExif(im)
    im_rgb = im.convert('RGB')

    initial_width, initial_height = im.size

    max_size = int(round(max_size))
    im_rgb.thumbnail((max_size, max_size),
                     Image.LANCZOS,
                     reducing_gap=None)  # this resizes to fit in a square keeping aspect ratio and no cropping.

    final_width, final_height = im_rgb.size

    # print("final size: {}, {}", final_width, final_height)
    scale_applied = float(final_width) / float(initial_width)

    with io.BytesIO() as output:
        im_rgb.save(output, format="JPEG", subsampling=0, quality=98)
        contents = output.getvalue()
        im_rgb.close()
        im.close()
        return (contents, scale_applied)


def make_image_jpg_in_memory(image_bytes):
    im = Image.open(io.BytesIO(image_bytes))
    im_rgb = im.convert('RGB')
    with io.BytesIO() as output:
        im_rgb.save(output, format="JPEG", subsampling=0, quality=98)
        contents = output.getvalue()
        im_rgb.close()
        im.close()
        return contents
`;

console.log('Testing: parses real-world Python image processing code');
console.log('Code length:', code.length);

const timeout = setTimeout(() => {
  console.log('TIMEOUT - Parser stuck!');
  process.exit(1);
}, 2000);

try {
  const lexer = new Lexer(code);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  clearTimeout(timeout);
  
  console.log(`Success! AST body length: ${ast.body.length}`);
} catch (e) {
  clearTimeout(timeout);
  console.log('Parse error:', e.message);
}
