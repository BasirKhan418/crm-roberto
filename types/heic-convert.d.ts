declare module "heic-convert" {
  type HeicConvertOptions = {
    buffer: Buffer | ArrayBuffer | Uint8Array;
    format: "JPEG" | "PNG";
    quality?: number;
  };

  export default function heicConvert(options: HeicConvertOptions): Promise<ArrayBuffer | Buffer>;
}