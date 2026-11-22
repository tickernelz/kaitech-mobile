package io.kaitech.videoeffects;

public final class BackgroundBlur {
  public static final int SEGMENT_SIDE = 256;

  private int[] small = new int[0];
  private int[] spare = new int[0];
  private int[] x0 = new int[0];
  private int[] x1 = new int[0];
  private int[] wx = new int[0];
  private int[] y0 = new int[0];
  private int[] y1 = new int[0];
  private int[] wy = new int[0];

  public static int[] uprightSize(int width, int height, int rotation) {
    return rotation == 90 || rotation == 270 ? new int[] {height, width} : new int[] {width, height};
  }

  public static int[] segmentSize(int width, int height, int rotation) {
    int[] upright = uprightSize(width, height, rotation);
    float scale = (float) SEGMENT_SIDE / Math.max(upright[0], upright[1]);
    return new int[] {Math.max(1, Math.round(upright[0] * scale)), Math.max(1, Math.round(upright[1] * scale))};
  }

  public static int bufferX(int ux, int uy, int width, int height, int rotation) {
    switch (rotation) {
      case 90: return uy;
      case 180: return width - 1 - ux;
      case 270: return width - 1 - uy;
      default: return ux;
    }
  }

  public static int bufferY(int ux, int uy, int width, int height, int rotation) {
    switch (rotation) {
      case 90: return height - 1 - ux;
      case 180: return height - 1 - uy;
      case 270: return ux;
      default: return uy;
    }
  }

  public static int[] uprightArgb(byte[] y, byte[] u, byte[] v, int width, int height, int rotation, int sw, int sh) {
    int[] upright = uprightSize(width, height, rotation);
    int chromaWidth = (width + 1) / 2;
    int[] pixels = new int[sw * sh];
    for (int sy = 0; sy < sh; sy++) {
      int uy = Math.min(upright[1] - 1, (int) ((sy + 0.5f) * upright[1] / sh));
      for (int sx = 0; sx < sw; sx++) {
        int ux = Math.min(upright[0] - 1, (int) ((sx + 0.5f) * upright[0] / sw));
        int bx = bufferX(ux, uy, width, height, rotation);
        int by = bufferY(ux, uy, width, height, rotation);
        int luma = (y[by * width + bx] & 0xff) - 16;
        int chroma = (by / 2) * chromaWidth + bx / 2;
        int cb = (u[chroma] & 0xff) - 128;
        int cr = (v[chroma] & 0xff) - 128;
        int c = 298 * Math.max(0, luma);
        int r = clamp((c + 409 * cr + 128) >> 8);
        int g = clamp((c - 100 * cb - 208 * cr + 128) >> 8);
        int b = clamp((c + 516 * cb + 128) >> 8);
        pixels[sy * sw + sx] = 0xff000000 | (r << 16) | (g << 8) | b;
      }
    }
    return pixels;
  }

  public static byte[] maskFrom(float[] confidence, int sw, int sh) {
    int[] alpha = new int[sw * sh];
    for (int i = 0; i < alpha.length; i++) {
      float value = (confidence[i] - 0.3f) / 0.4f;
      alpha[i] = Math.round(Math.max(0f, Math.min(1f, value)) * 255f);
    }
    int[] spare = new int[alpha.length];
    for (int pass = 0; pass < 2; pass++) boxBlur(alpha, spare, sw, sh, 1);
    byte[] mask = new byte[alpha.length];
    for (int i = 0; i < alpha.length; i++) mask[i] = (byte) alpha[i];
    return mask;
  }

  public static void maskIndex(int width, int height, int rotation, int sw, int sh, int[] column, int[] row) {
    int[] upright = uprightSize(width, height, rotation);
    for (int bx = 0; bx < width; bx++) {
      switch (rotation) {
        case 90: column[bx] = scaled(bx, upright[1], sh) * sw; break;
        case 180: column[bx] = scaled(width - 1 - bx, upright[0], sw); break;
        case 270: column[bx] = scaled(width - 1 - bx, upright[1], sh) * sw; break;
        default: column[bx] = scaled(bx, upright[0], sw);
      }
    }
    for (int by = 0; by < height; by++) {
      switch (rotation) {
        case 90: row[by] = scaled(height - 1 - by, upright[0], sw); break;
        case 180: row[by] = scaled(height - 1 - by, upright[1], sh) * sw; break;
        case 270: row[by] = scaled(by, upright[0], sw); break;
        default: row[by] = scaled(by, upright[1], sh) * sw;
      }
    }
  }

  public void blendPlane(byte[] source, int width, int height, int factor, int step, byte[] mask, int[] column, int[] row, byte[] out) {
    int sw = (width + factor - 1) / factor;
    int sh = (height + factor - 1) / factor;
    if (small.length < sw * sh) {
      small = new int[sw * sh];
      spare = new int[sw * sh];
    }
    for (int sy = 0; sy < sh; sy++) {
      int top = sy * factor;
      int bottom = Math.min(height, top + factor);
      for (int sx = 0; sx < sw; sx++) {
        int left = sx * factor;
        int right = Math.min(width, left + factor);
        int sum = 0;
        for (int yy = top; yy < bottom; yy++) {
          int base = yy * width;
          for (int xx = left; xx < right; xx++) sum += source[base + xx] & 0xff;
        }
        small[sy * sw + sx] = sum / ((bottom - top) * (right - left));
      }
    }
    for (int pass = 0; pass < 2; pass++) boxBlur(small, spare, sw, sh, 2);
    weights(width, factor, sw, true);
    weights(height, factor, sh, false);
    for (int y = 0; y < height; y++) {
      int rowBase = y * width;
      int maskRow = row == null ? 0 : row[Math.min(row.length - 1, y * step)];
      int top = y0[y] * sw;
      int bottom = y1[y] * sw;
      int fy = wy[y];
      for (int x = 0; x < width; x++) {
        int a = mask == null ? 0 : mask[maskRow + column[Math.min(column.length - 1, x * step)]] & 0xff;
        int original = source[rowBase + x] & 0xff;
        if (a == 255) {
          out[rowBase + x] = (byte) original;
          continue;
        }
        int fx = wx[x];
        int upper = small[top + x0[x]] * (256 - fx) + small[top + x1[x]] * fx;
        int lower = small[bottom + x0[x]] * (256 - fx) + small[bottom + x1[x]] * fx;
        int background = (upper * (256 - fy) + lower * fy + 32768) >> 16;
        out[rowBase + x] = (byte) (a == 0 ? background : (original * a + background * (255 - a) + 127) / 255);
      }
    }
  }

  private void weights(int length, int factor, int smallLength, boolean horizontal) {
    int[] first = horizontal ? x0 : y0;
    if (first.length < length) {
      first = new int[length];
      int[] second = new int[length];
      int[] weight = new int[length];
      if (horizontal) {
        x0 = first;
        x1 = second;
        wx = weight;
      } else {
        y0 = first;
        y1 = second;
        wy = weight;
      }
    }
    int[] lo = horizontal ? x0 : y0;
    int[] hi = horizontal ? x1 : y1;
    int[] w = horizontal ? wx : wy;
    for (int i = 0; i < length; i++) {
      float position = Math.max(0f, (i + 0.5f) / factor - 0.5f);
      int base = Math.min(smallLength - 1, (int) position);
      lo[i] = base;
      hi[i] = Math.min(smallLength - 1, base + 1);
      w[i] = Math.round((position - base) * 256f);
    }
  }

  static void boxBlur(int[] values, int[] spare, int width, int height, int radius) {
    for (int y = 0; y < height; y++) {
      int base = y * width;
      for (int x = 0; x < width; x++) {
        int sum = 0;
        int count = 0;
        for (int k = Math.max(0, x - radius); k <= Math.min(width - 1, x + radius); k++) {
          sum += values[base + k];
          count++;
        }
        spare[base + x] = sum / count;
      }
    }
    for (int x = 0; x < width; x++) {
      for (int y = 0; y < height; y++) {
        int sum = 0;
        int count = 0;
        for (int k = Math.max(0, y - radius); k <= Math.min(height - 1, y + radius); k++) {
          sum += spare[k * width + x];
          count++;
        }
        values[y * width + x] = sum / count;
      }
    }
  }

  private static int scaled(int value, int length, int smallLength) {
    return Math.min(smallLength - 1, (int) ((long) value * smallLength / length));
  }

  private static int clamp(int value) {
    return value < 0 ? 0 : Math.min(255, value);
  }
}
