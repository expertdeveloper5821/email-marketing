import express from "express";
import { uploadCSV } from '../controllers/authController';
import multer from 'multer';
import authMiddleware from "../middlewares/verifyToken";

const router = express.Router();


const upload = multer({ dest: '../uploads/' });


// // post api 
router.post('/upload-csv', upload.single('csvFile'), authMiddleware,uploadCSV);


export default router;
