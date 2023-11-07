import express, { Request, Response } from 'express';
import { transporter } from '../middlewares/email';
import { environmentConfig } from '../config/environmentConfig';
import fs from 'fs';
import path from 'path';
import cron, { ScheduledTask } from 'node-cron';
import moment from 'moment-timezone';
import Cron from '../models/cronModels';
import { v4 as uuidv4 } from "uuid";
import User from '../models/authModel';


export const router = express.Router(); // Initialize Express router
router.use(express.static('views')); // Serve static files from the public directory


// Function to convert frontend schedule format to cron schedule format
const convertToFrontendSchedule = (frontendSchedule = '2023-11-02T16:45:00+05:30') => {
    const frontendDate = new Date(frontendSchedule);
    const ISTDate = moment(frontendDate).format("DD-MM-YYYY HH:mm");
    const dateTimeFormat = ISTDate.split(" ");
    const time = dateTimeFormat[1];
    const [date] = ISTDate.split(' ')
    const [dayOfMonth, month, year] = date.split('-')
    const [hour, minute, ...rest] = time.split(":")
    const dayOfWeek = frontendDate.getDay();
    return `${minute} ${hour} ${dayOfMonth} ${month} ${dayOfWeek}`;
};


let scheduledEmailJob: ScheduledTask | undefined;
const stopScheduledEmailJob = async (cronUuid: string) => {
    try {
        if (scheduledEmailJob) {
            scheduledEmailJob.stop();

            const updatedCron = await Cron.findOneAndUpdate(
                { cronUuid: cronUuid },
                { $set: { cronStatus: false } },
                { new: true }
            );

            if (updatedCron) {
                return "Cron status updated to false:";
            } 
            scheduledEmailJob.stop();
        }
    } catch (error) {
        console.error("Error updating cron status:", error);
    }
};



// New API endpoint for sending emails with customizable options
export const sendEmails = async (req: Request, res: Response) => {
    try {
        // Extract template file name, cron schedule, and email array from request body
        const { templateType, dateAndTimeFrom, dateAndTimeTo, dateAndTimeStop, uniqueCronName, emails, date, time, mapType, gameType } = req.body;

        // Validate templateFile and cronSchedule fields
        if (!templateType) {
            return res.status(400).json({ message: 'Template file or cron schedule not specified' });
        }

        const validDateAndTimeFrom = convertToFrontendSchedule(dateAndTimeFrom);
        const validDateAndTimeTo = convertToFrontendSchedule(dateAndTimeTo);
        const validDateAndTimeStop = convertToFrontendSchedule(dateAndTimeStop);

        // Validate if the specified template file exists
        const templateFiles = ['bgmi.html', 'hiring.html', 'marketing.html'];

        // Construct template file path using template literal
        const templateFilePath = path.join(__dirname, `../views/mail-template/${templateFiles[templateType - 1]}`);

        // Read the specified mail template file
        const mailTemplate = fs.readFileSync(templateFilePath, 'utf-8');

        // Replace placeholders with actual data
        const emailContent = mailTemplate
            .replace('{{gameType}}', gameType)
            .replace('{{mapType}}', mapType)
            .replace('{{date}}', date)
            .replace('{{time}}', `${time}`);

        // If emails are provided in the request body, send emails to those specific addresses
        if (emails && emails.length > 0) {
            const findEmailPromises = emails.map(async (emails: string) => {
                const findEmail = await User.findOne({ email: emails });
                return findEmail;
            });
            const foundEmails = await Promise.all(findEmailPromises);
            if (!foundEmails.every((email) => email)) {
                return res.status(200).json({ message: 'Emails not found' });
            } else {
                // Schedule the cron job for sending emails based on the specified cron schedule
                scheduledEmailJob = cron.schedule(validDateAndTimeFrom, async () => {
                    for (const email of emails) {
                        // Prepare email data 
                        const emailToSend = {
                            from: environmentConfig.EMAIL_FROM,
                            subject: 'Newsletter',
                            to: email,
                            html: emailContent,
                        };
                        // using nodemailer to send the email
                        await transporter.sendMail(emailToSend);
                    }
                });
                const newUuid = uuidv4();
                // Save the data to the database
                const cronData = await Cron.create({
                    dateAndTimeFrom,
                    dateAndTimeTo,
                    dateAndTimeStop,
                    uniqueCronName,
                    cronUuid: newUuid,
                });

                cron.schedule(validDateAndTimeTo, async () => {
                    await stopScheduledEmailJob(newUuid);
                });

                cron.schedule(validDateAndTimeStop, async () => {
                    await stopScheduledEmailJob(newUuid);
                });
                return res.status(200).json({ message: 'Emails scheduled', cronData });
            }
        } else {
            // Replace placeholders with actual data
            const emailContent = mailTemplate
                .replace('{{gameType}}', gameType)
                .replace('{{mapType}}', mapType)
                .replace('{{date}}', date)
                .replace('{{time}}', time);

            // if not email body provided then Schedule the cron job for sending emails to all email in db
            scheduledEmailJob = cron.schedule(validDateAndTimeFrom, async () => {
                const allEmails = await User.find({}, 'email');
                const allEmailAddresses = allEmails.map((item) => item.email).flat();

                for (const email of allEmailAddresses) {

                    // Prepare email data 
                    const emailToSend = {
                        from: environmentConfig.EMAIL_FROM,
                        subject: 'Newsletter',
                        to: email,
                        html: emailContent,
                    };

                    // using nodemailer to send the email
                    await transporter.sendMail(emailToSend);
                }
            });

            const newUuid = uuidv4();
            // Save the data to the database
            const cronData = await Cron.create({
                dateAndTimeFrom,
                dateAndTimeTo,
                dateAndTimeStop,
                uniqueCronName,
                cronUuid: newUuid,
            });
            cron.schedule(validDateAndTimeTo, () => {
                stopScheduledEmailJob(newUuid);
            });

            cron.schedule(validDateAndTimeStop, () => {
                stopScheduledEmailJob(newUuid);
            });

            return res.status(200).json({ message: 'Emails scheduled', cronData });
        }
    } catch (error) {
        console.error('Internal server error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};


// get all crons details
export const getAllCronDetails = async (req: Request, res: Response) => {
    try {
        const findCron = await Cron.find({ cronStatus: true })
        if (findCron.length === 0) {
            return res.status(404).json({ message: 'No active cron found' });
        } else {
            return res.status(200).json({ data: findCron });
        }
    } catch (error) {
        console.error('Internal server error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
}


// get cron details by id
export const getCronsById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const isFindCron = await Cron.findById({ _id: id })
        if (!isFindCron) {
            return res.status(404).json({ message: 'cron not found' });
        } else {
            return res.status(200).json({ data: isFindCron });
        }
    } catch (error) {
        console.error('Internal server error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
}


// stopr cron job manual
export const stopCronSchedule = async (req: Request, res: Response) => {
    try {
        const { dateAndTimeStop, cronUuid } = req.body
        if (!dateAndTimeStop || !cronUuid) {
            return res.status(404).json({ message: 'Cron Date and time or Cron id not found' });
        } else {
            // Stop the scheduled email job based on the provided cronUuid
            await stopScheduledEmailJob(cronUuid);
            // Update the 'cronStatus' to false in the database for the provided cronUuid
            const updatedCron = await Cron.findOneAndUpdate(
                { cronUuid },
                { $set: { cronStatus: false, dateAndTimeStop } },
                { new: true }
            );
            if (updatedCron) {
                return res.status(200).json({ message: 'Cron job stopped and status updated', updatedCron });
            } else {
                return res.status(404).json({ message: 'Cron not found with the provided cronUuid' });
            }
        }
    } catch (error) {
        console.error('Internal server error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
}







