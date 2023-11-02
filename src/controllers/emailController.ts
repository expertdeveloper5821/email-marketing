import Email from '../models/emailModels';
import express, { Request, Response } from 'express';
import { transporter } from '../middlewares/email';
import { environmentConfig } from '../config/environmentConfig';
import csv from 'csv-parser';
import fs from 'fs';
import path from 'path';
import cron from 'node-cron';
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

// Handle CSV file upload
export const uploadCSV = async (req: Request, res: Response) => {
  try {
    // Check if a file has been uploaded
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Extract template file name from request body
    const { templateType, date, time, mapType, gameType } = req.body;

    // Validate templateFile field
    if (!templateType) {
      return res.status(400).json({ message: 'Template file not specified' });
    }

    // Validate if the specified template file exists
    const templateFiles = ['bgmi.html', 'hiring.html', 'marketing.html'];

    // Construct template file path using template literal
    const templateFilePath = path.join(__dirname, `../views/mail-template/${templateFiles[templateType - 1]}`);

    // Read the specified mail template file
    const mailTemplate = fs.readFileSync(templateFilePath, 'utf-8');

    // Initialize results array to store extracted emails
    const results: string[] = [];

    // Read and process the CSV file 
    fs.createReadStream(req.file.path)
      .pipe(csv())
      .on('data', async (data: { [key: string]: string }) => {
        try {
          const email = data['E_mail']; // Extract email from the CSV data
          if (email) {
            results.push(email); // Add the extracted email to the results array
          }
        } catch (error) {
          console.error('Error extracting email from CSV:', error);
        }
      })
      .on('end', async () => {
        try {
          // Find existing emails in the database 
          const existingEmails = await Email.find({ email: { $in: results } });

          if (existingEmails && existingEmails.length > 0) {
            // Create a set of existing emails
            const existingEmailSet = existingEmails[0].email;

            // Initialize a set for updated emails
            const updatedEmailSet = []

            // Filter out existing emails from the results 
            for (const item of results) {
              if (!existingEmailSet.includes(item)) {
                updatedEmailSet.push(item); // Add non-existing emails to the updatedEmailSet
              }
            }

            try {
              await Email.updateOne(
                { _id: existingEmails[0]._id },
                { $addToSet: { email: { $each: updatedEmailSet } } }
              );
            } catch (error) {
              console.error('Error updating email:', error);
              return res.status(500).json({ message: 'Error updating email' });
            }
          } else {
            try {
              const newEmail = new Email({
                email: results,
              })
              await newEmail.save();
            } catch (error) {
              console.error('Error saving email:', error);
              return res.status(500).json({ message: 'Error saving email' });
            }
          }

          // after saving the email in db, scheduled the cron job for email
          scheduleEmails(results, req.body.dateAndTime, mailTemplate, date, time, mapType, gameType);

          // Delete the uploaded file after processing it
          if (req.file) {
            fs.unlink(req.file.path, (err) => {
              if (err) {
                console.error('Error occurred while trying to delete the file:', err);
              } else {
                return 'File has been successfully deleted.';
              }
            });
          }

          return res.status(200).json({ message: 'CSV file uploaded and processed successfully' });

        } catch (error) {
          console.error('Error processing email:', error);
          return res.status(500).json({ message: 'Error processing email' });
        }
      });
  } catch (error) {
    console.error('Internal server error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};


// Schedule email sending
const scheduleEmails = async (emails: string[], dateAndTime: string, mailTemplate: string, date: string, time: string, mapType: string, gameType: string) => {
  try {

    // Replace placeholders with actual data
    const emailContent = mailTemplate
      .replace('{{gameType}}', gameType)
      .replace('{{mapType}}', mapType)
      .replace('{{date}}', date)
      .replace('{{time}}', `${time}`);

    // Convert the frontend cron schedule to the cron format
    const validDateAndTime = convertToFrontendSchedule(dateAndTime);
    // Schedule the sending of emails based on the cron schedule given in body 48 11 * * 3 
    cron.schedule(validDateAndTime, async () => {
      try {

        // take the emails and template
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
      } catch (error) {
        console.error('Error sending emails:', error);
      }
    });
  } catch (error) {
    console.error('Cron job scheduling error:', error);
  }
};


// New API endpoint for sending emails with customizable options
export const sendEmails = async (req: Request, res: Response) => {
  try {
    // Extract template file name, cron schedule, and email array from request body
    const { templateType, dateAndTime, emails, date, time, mapType, gameType } = req.body;

    // Validate templateFile and cronSchedule fields
    if (!templateType || !dateAndTime) {
      return res.status(400).json({ message: 'Template file or cron schedule not specified' });
    }

    // Convert the frontend cron schedule to the cron format
    const validDateAndTime = convertToFrontendSchedule(dateAndTime);

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
      // Schedule the cron job for sending emails based on the specified cron schedule
      cron.schedule(validDateAndTime, async () => {
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

      return res.status(200).json({ message: 'Emails scheduled' });
    } else {
      // Replace placeholders with actual data
      const emailContent = mailTemplate
        .replace('{{gameType}}', gameType)
        .replace('{{mapType}}', mapType)
        .replace('{{date}}', date)
        .replace('{{time}}', `${time}`);

      // if not email body provided then Schedule the cron job for sending emails to all email in db
      cron.schedule(validDateAndTime, async () => {
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

      return res.status(200).json({ message: 'Emails scheduled' });
    }
  } catch (error) {
    console.error('Internal server error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};


export default router;


