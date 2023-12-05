import express, { Request, Response } from 'express';
import { transporter } from '../middlewares/email';
import { environmentConfig } from '../config/environmentConfig';
import fs from 'fs';
import path from 'path';
import cron, { ScheduledTask } from 'node-cron';
import moment from 'moment-timezone';
import Cron from '../models/cronModels';
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
const stopScheduledEmailJob = async (uniqueCronName: string) => {
    try {
        if (scheduledEmailJob) {
            scheduledEmailJob.stop();

            const updatedCron = await Cron.findOneAndUpdate(
                { uniqueCronName: uniqueCronName },
                { $set: { cronRunningStatus: 'stop' } },
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


// get all user email 
export const getAllUserEmail = async (req: Request, res: Response) => {
    try {
        const findUser = await User.find({});
        if (findUser.length === 0) {
            return res.status(400).json({ message: 'Emails not found' });
        } else {
            return res.status(200).json({ message: 'User founds', findUser });
        }
    } catch (error) {
        console.error("Error updating cron status:", error);
        return res.status(500).json({ message: 'Internal server error' });
    }
}


// New API endpoint for sending emails with customizable options
export const sendEmails = async (req: Request, res: Response) => {
    try {
        // Extract template file name, cron schedule, and email array from request body
        const { templateType, dateAndTimeFrom, dateAndTimeTo, uniqueCronName, emails, date, time, mapType, gameType } = req.body;

        // Validate templateFile and cronSchedule fields
        if (!templateType) {
            return res.status(400).json({ message: 'Template file or cron schedule not specified' });
        }

        const validDateAndTimeFrom = convertToFrontendSchedule(dateAndTimeFrom);
        const validDateAndTimeTo = convertToFrontendSchedule(dateAndTimeTo);

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

                // Save the data to the database
                const cronData = await Cron.create({
                    dateAndTimeFrom,
                    dateAndTimeTo,
                    uniqueCronName,
                    userEmail: emails,
                    cronRunningStatus: 'start',
                });

                cron.schedule(validDateAndTimeTo, async () => {
                    await stopScheduledEmailJob(uniqueCronName);
                });

                return res.status(200).json({ message: 'Emails scheduled', cronData: { _id: cronData._id, ...cronData._doc } });
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

            // Save the data to the database
            const cronData = await Cron.create({
                dateAndTimeFrom,
                dateAndTimeTo,
                uniqueCronName,
                userEmail: emails,
                cronRunningStatus: 'start',
            });
            cron.schedule(validDateAndTimeTo, () => {
                stopScheduledEmailJob(uniqueCronName);
            });

            return res.status(200).json({ message: 'Emails scheduled', cronData: { _id: cronData._id, ...cronData._doc } });
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
        const { dateAndTimeTo, uniqueCronName } = req.body
        if (!dateAndTimeTo || !uniqueCronName) {
            return res.status(404).json({ message: 'Cron Date and time or Cron unique name not found' });
        } else {
            // Stop the scheduled email job based on the provided uniqueCronName
            await stopScheduledEmailJob(uniqueCronName);
            // Update the 'cronStatus' to false in the database for the provided uniqueCronName
            const updatedCron = await Cron.findOneAndUpdate(
                { uniqueCronName },
                { $set: { cronRunningStatus: 'stop', dateAndTimeTo } },
                { new: true }
            );
            if (updatedCron) {
                return res.status(200).json({ message: 'Cron job stopped and status updated', updatedCron });
            } else {
                return res.status(404).json({ message: 'Cron not found with the provided uniqueCronName' });
            }
        }
    } catch (error) {
        console.error('Internal server error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
}


// softe delete functionality
export const softDeleteCronById = async (req: Request, res: Response) => {
    try {
        const { cronId } = req.params;

        if (!cronId) {
            return res.status(404).json({ message: 'Cron ID not found' });
        } else {
            // Find the cron by ID
            const foundCron = await Cron.findById({ _id: cronId });

            if (foundCron) {
                // Update the cronStatus to false to simulate soft delete
                const updatedCron = await Cron.findByIdAndUpdate(
                    cronId,
                    { $set: { cronStatus: false, cronRunningStatus: 'stop' } },
                    { new: true }
                );

                return res.status(200).json({ message: 'Cron soft deleted', updatedCron });
            } else {
                return res.status(404).json({ message: 'Cron not found with the provided ID' });
            }
        }
    } catch (error) {
        console.error('Internal server error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
}


// re scheule the same cron
export const rescheduleCron = async (req: Request, res: Response) => {
    try {
        const { uniqueCronName, dateAndTimeFrom, dateAndTimeTo, templateType, date, time, mapType, gameType } = req.body;

        const validDateAndTimeFrom = convertToFrontendSchedule(dateAndTimeFrom);
        const validDateAndTimeStop = convertToFrontendSchedule(dateAndTimeTo);

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
        // Find the stopped cron based on the provided uniqueCronName
        const stoppedCron = await Cron.findOne({ uniqueCronName, cronStatus: false, cronRunningStatus: 'stop' });

        if (stoppedCron) {
            if (stoppedCron.userEmail && stoppedCron.userEmail.length > 0) {
                const userMail = stoppedCron.userEmail;
                // Re-schedule the cron job
                scheduledEmailJob = cron.schedule(validDateAndTimeFrom, async () => {
                    for (const email of userMail) {
                        // Prepare email data 
                        const emailToSend = {
                            from: environmentConfig.EMAIL_FROM,
                            subject: 'Newsletter',
                            to: email,
                            html: emailContent,
                        };
                        // Using nodemailer to send the email
                        await transporter.sendMail(emailToSend);
                    }
                });

                // Update the cronStatus and cronRunningStatus to indicate the job has been rescheduled
                const updatedCron = await Cron.findOneAndUpdate(
                    { uniqueCronName },
                    { $set: { cronStatus: true, cronRunningStatus: 'start', dateAndTimeFrom, dateAndTimeTo } },
                    { new: true }
                );

                // Stop the cron job based on the provided dateAndTimeStop
                cron.schedule(validDateAndTimeStop, () => {
                    stopScheduledEmailJob(uniqueCronName);
                });

                return res.status(200).json({ message: 'Cron job rescheduled and status updated', updatedCron });
            } else {
                return res.status(400).json({ message: 'No userEmail found to reschedule the mail' });
            }
        } else {
            return res.status(404).json({ message: 'Provided uniqueCronName status is true or already stop' });
        }
    } catch (error) {
        console.error('Internal server error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
}






