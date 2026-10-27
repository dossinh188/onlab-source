export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_TEXT_CHARACTERS = 1000000;

export function validateFileSize(size: number) {
  if (!Number.isSafeInteger(size) || size <= 0) throw new Error('Tệp không có nội dung.');
  if (size > MAX_FILE_BYTES) throw new Error('Tệp vượt quá 5 MB. Vui lòng chọn tệp nhỏ hơn.');
}
