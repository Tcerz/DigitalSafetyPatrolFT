export const uploadConfig = {
  uploadDir: process.env.UPLOAD_DIR || 'uploads',
  maxFileMb: Number(process.env.MAX_FILE_SIZE_MB || 5),
  maxPhotos: Number(process.env.MAX_PHOTOS_PER_REPORT || 10),
}
