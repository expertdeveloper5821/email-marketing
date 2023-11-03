import Email from '../models/emailModels';
import express, { Request, Response } from 'express';
import { transporter } from '../middlewares/email';
import { environmentConfig } from '../config/environmentConfig';
import fs from 'fs';
import path from 'path';
import cron, { ScheduledTask } from 'node-cron';
import moment from 'moment-timezone';



const router = express.Router(); // Initialize Express router
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
const stopScheduledEmailJob = () => {
    if (scheduledEmailJob) {
        scheduledEmailJob.stop();
    }
};

// New API endpoint for sending emails with customizable options
export const sendEmailsTO = async (req: Request, res: Response) => {
    try {
        // Extract template file name, cron schedule, and email array from request body
        const { templateType, dateAndTimeFrom, dateAndTimeTo, dateAndTimeStop, emails, date, time, mapType, gameType } = req.body;

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
            const findEmailPromises = emails.map(async (email: string) => {
                const findEmail = await Email.findOne({ email });
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
                            subject: 'PattseHeadshot Newsletter: Join Us for a BGMI Match',
                            to: email,
                            html: emailContent,
                        };
                        // using nodemailer to send the email
                        await transporter.sendMail(emailToSend);
                    }
                });

                cron.schedule(validDateAndTimeTo, () => {
                    stopScheduledEmailJob();
                });

                cron.schedule(validDateAndTimeStop, () => {
                    stopScheduledEmailJob();
                });
                return res.status(200).json({ message: 'Emails scheduled' });
            }
        } else {
            // Replace placeholders with actual data
            const emailContent = mailTemplate
                .replace('{{gameType}}', gameType)
                .replace('{{mapType}}', mapType)
                .replace('{{date}}', date)
                .replace('{{time}}', `${time}`);

            // if not email body provided then Schedule the cron job for sending emails to all email in db
            scheduledEmailJob = cron.schedule(validDateAndTimeFrom, async () => {
                const allEmails = await Email.find({}, 'email');
                const allEmailAddresses = allEmails.map((item) => item.email).flat();

                for (const email of allEmailAddresses) {

                    // Prepare email data 
                    const emailToSend = {
                        from: environmentConfig.EMAIL_FROM,
                        subject: 'PattseHeadshot Newsletter: Join Us for a BGMI Match',
                        to: email,
                        html: emailContent,
                    };

                    // using nodemailer to send the email
                    await transporter.sendMail(emailToSend);
                }
            });
            cron.schedule(validDateAndTimeTo, () => {
                stopScheduledEmailJob();
            });

            cron.schedule(validDateAndTimeStop, () => {
                stopScheduledEmailJob();
            });
            return res.status(200).json({ message: 'Emails scheduled' });
        }
    } catch (error) {
        console.error('Internal server error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};



export default router;


