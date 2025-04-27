// Tạo file ví dụ: src/types/image-decode.d.ts
declare module 'image-decode' {
  export default function imageDecode(data: Uint8Array): { data: Uint8Array; width: number; height: number };
}
