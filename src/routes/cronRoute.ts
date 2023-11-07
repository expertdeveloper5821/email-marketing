import express from "express";
import { sendEmails, getAllCronDetails, getCronsById, stopCronSchedule } from "../controllers/cronController";


const router = express.Router();


// post api
router.post('/send-email', sendEmails);

// get all crons
router.get('/getAll-crons', getAllCronDetails)

// get cron by id
router.get('/getCrons/:id', getCronsById)

// stop cron by cronUuid
router.post('/stop-cron', stopCronSchedule)

export default router;
