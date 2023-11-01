import express from "express";
import { uploadCSV, sendEmails } from '../controllers/emailController';
import multer from 'multer';

const router = express.Router();


const upload = multer({ dest: '../uploads/' });


// post api 
router.post('/upload-csv', upload.single('csvFile'), uploadCSV);

// post api 
router.post('/send-email', sendEmails);


export default router;
