import express from "express";
import { sendEmails, getAllCronDetails, getCronsById, stopCronSchedule, rescheduleCron, softDeleteCronById, getAllUserEmail } from "../controllers/cronController";


const router = express.Router();


// post api
router.post('/send-email', sendEmails);

// get all crons
router.get('/getAll-crons', getAllCronDetails)

// get cron by id
router.get('/getCrons/:id', getCronsById)

// stop cron by cron Unique name
router.post('/stop-cron', stopCronSchedule)

// delete cron by cron Unique name
router.post('/delete-cron/:cronId', softDeleteCronById)

// re schedule cron by cron Unique name
router.post('/re-send-cron', rescheduleCron)

// re schedule cron by cron Unique name
router.get('/getUser-mails', getAllUserEmail)

export default router;
