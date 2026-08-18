import multer from "multer";

// Configure Multer
const storage = multer.memoryStorage();
export const upload = multer({ storage: storage });
