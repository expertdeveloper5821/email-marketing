import express from "express";
import { uploadCSV } from '../controllers/authController';
import multer from 'multer';
// import authMiddleware from "../middlewares/verifyToken";

const router = express.Router();


const storage = multer.diskStorage({
    filename: (req, file, cb) => {
        const name = Date.now() + '_' + file.originalname;
        cb(null, name);
    }
});
const upload = multer({ storage: storage });


// // post api 
router.post('/upload-csv', upload.single('csvFile'), uploadCSV);


export default router;
